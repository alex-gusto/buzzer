import "./loadEnv.js";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import WebSocket, { type RawData } from "ws";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

import { GameStore } from "./store.js";
import { fetchTriviaCategories, fetchTriviaQuestions } from "./triviaApi.js";
import type { ConnectionRole } from "./types.js";
import {
  IncomingMessageSchema,
  RegisterMessageSchema,
  type RegisterMessage,
  type OutgoingMessage,
} from "./messages.js";

const fastify = Fastify({
  logger: true,
});

const store = new GameStore(fastify.log.child({ scope: "game-store" }));

await fastify.register(cors, {
  origin: true,
});

await fastify.register(websocket);

const JoinBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(32, { message: "Name must be 32 characters or fewer" }),
});

const HostAuthSchema = z.object({
  hostSecret: z.string().trim().min(1),
});

const SetTurnBodySchema = HostAuthSchema.extend({
  playerId: z.string().trim().min(1),
});

const ActivateQuestionBodySchema = HostAuthSchema.extend({
  category: z.string().trim().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const MarkAnswerBodySchema = HostAuthSchema.extend({
  result: z.enum(["correct", "incorrect"]),
  playerId: z.string().trim().min(1).optional(),
  openBuzzers: z.boolean().optional(),
});

const LeaveRoomBodySchema = z.object({
  playerId: z.string().trim().min(1),
});

const ShareClaimBodySchema = z.object({
  shareCode: z.string().trim().regex(/^[0-9]{4}$/),
});

function handleHostError(
  error: unknown,
  reply: FastifyReply,
  log: typeof fastify.log
) {
  const message = error instanceof Error ? error.message : String(error);

  const errorMap: Record<string, { status: number; body: string }> = {
    "Room not found": { status: 404, body: "Session not found" },
    Forbidden: { status: 403, body: "Invalid host secret" },
    "Player not found": { status: 404, body: "Player not found" },
    "Question already in play": {
      status: 409,
      body: "Question already in play",
    },
    "Invalid question": { status: 400, body: "Invalid question" },
    "No active question": { status: 409, body: "No active question" },
    "Buzzers already open": { status: 409, body: "Buzzers already open" },
    "Buzz not available now": { status: 409, body: "Buzz not available now" },
    "You already attempted this question": {
      status: 409,
      body: "Player already attempted",
    },
    "No answering player to award points": {
      status: 400,
      body: "No answering player",
    },
    "Set a player on turn before activating a question": {
      status: 409,
      body: "Set a player on turn before activating a question",
    },
    "Unable to fetch a unique trivia question": {
      status: 502,
      body: "Unable to fetch a unique trivia question right now",
    },
  };

  const known = errorMap[message];

  if (known) {
    reply.code(known.status);
    return { message: known.body };
  }

  if (message.startsWith("Trivia API request failed")) {
    reply.code(502);
    return { message: "Trivia provider is unavailable. Try again shortly." };
  }

  log.error(error, "Host command failed");
  reply.code(500);
  return { message: "Unexpected error" };
}

fastify.post("/api/session", async (_, reply) => {
  const room = await store.createRoom();
  reply.code(201);
  return { code: room.code, hostSecret: room.hostSecret };
});

fastify.get("/api/rooms", async () => {
  return store.listRooms();
});

fastify.get("/api/session/:code", async (request, reply) => {
  const { code } = request.params as { code: string };

  try {
    return store.snapshot(code);
  } catch (error) {
    fastify.log.warn(error, "Failed to load session snapshot");
    reply.code(404);
    return { message: "Session not found" };
  }
});

fastify.post("/api/session/:code/join", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = JoinBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: body.error.issues.at(0)?.message ?? "Invalid name" };
  }

  try {
    const { player } = store.joinRoom(code, body.data.name);
    reply.code(201);
    return { playerId: player.id };
  } catch (error) {
    fastify.log.warn(error, "Failed to join session");
    reply.code(404);
    return { message: "Session not found" };
  }
});

fastify.post("/api/session/:code/leave", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = LeaveRoomBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    store.removePlayer(code, body.data.playerId);
    reply.code(204);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Room not found") {
      reply.code(404);
      return { message: "Session not found" };
    }

    if (message === "Player not found") {
      reply.code(404);
      return { message: "Player not found" };
    }

    fastify.log.warn(error, "Failed to remove player from session");
    reply.code(500);
    return { message: "Unable to leave session" };
  }
});

fastify.post("/api/session/:code/destroy", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = HostAuthSchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    store.destroyRoom(code, body.data.hostSecret);
    reply.code(204);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Room not found") {
      reply.code(404);
      return { message: "Session not found" };
    }

    if (message === "Forbidden") {
      reply.code(403);
      return { message: "Invalid host secret" };
    }

    fastify.log.warn(error, "Failed to destroy session");
    reply.code(500);
    return { message: "Unable to destroy session" };
  }
});

fastify.post("/api/session/:code/share", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = HostAuthSchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    const result = store.issueShareCode(code, body.data.hostSecret);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Room not found") {
      reply.code(404);
      return { message: "Session not found" };
    }

    if (message === "Forbidden") {
      reply.code(403);
      return { message: "Invalid host secret" };
    }

    fastify.log.warn(error, "Failed to issue share code");
    reply.code(500);
    return { message: "Unable to generate share code" };
  }
});

fastify.post("/api/share/claim", async (request, reply) => {
  const body = ShareClaimBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid share code" };
  }

  try {
    const result = store.claimShareCode(body.data.shareCode);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "Invalid share code") {
      reply.code(400);
      return { message };
    }

    if (message === "Share code not found") {
      reply.code(404);
      return { message: "Share code expired or not found" };
    }

    fastify.log.warn(error, "Failed to claim share code");
    reply.code(500);
    return { message: "Unable to claim share code" };
  }
});

fastify.post("/api/session/:code/turn", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = SetTurnBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    store.setCurrentTurn(code, body.data.hostSecret, body.data.playerId);
    return { ok: true };
  } catch (error) {
    return handleHostError(error, reply, fastify.log);
  }
});

fastify.post("/api/session/:code/question/activate", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = ActivateQuestionBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    await store.activateQuestion(code, body.data.hostSecret, {
      category: body.data.category,
      difficulty: body.data.difficulty,
    });
    return { ok: true };
  } catch (error) {
    return handleHostError(error, reply, fastify.log);
  }
});

fastify.post("/api/session/:code/question/open", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = HostAuthSchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    store.openQuestionToBuzzers(code, body.data.hostSecret);
    return { ok: true };
  } catch (error) {
    return handleHostError(error, reply, fastify.log);
  }
});

fastify.post("/api/session/:code/question/mark", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = MarkAnswerBodySchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    if (body.data.result === "correct") {
      store.markAnswerCorrect(code, body.data.hostSecret, body.data.playerId);
    } else {
      store.markAnswerIncorrect(code, body.data.hostSecret, {
        openBuzzers: body.data.openBuzzers ?? false,
      });
    }

    return { ok: true };
  } catch (error) {
    return handleHostError(error, reply, fastify.log);
  }
});

fastify.post("/api/session/:code/question/cancel", async (request, reply) => {
  const { code } = request.params as { code: string };
  const body = HostAuthSchema.safeParse(request.body);

  if (!body.success) {
    reply.code(400);
    return { message: "Invalid payload" };
  }

  try {
    store.cancelActiveQuestion(code, body.data.hostSecret);
    return { ok: true };
  } catch (error) {
    return handleHostError(error, reply, fastify.log);
  }
});

fastify.get("/api/trivia/categories", async (_, reply) => {
  try {
    return await fetchTriviaCategories();
  } catch (error) {
    fastify.log.error(error, "Failed to load trivia categories");
    reply.code(502);
    return { message: "Failed to load trivia categories" };
  }
});

const TriviaQuestionsQuerySchema = z.object({
  category: z.string().trim().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

fastify.get("/api/trivia/questions", async (request, reply) => {
  const query = TriviaQuestionsQuerySchema.safeParse(request.query);

  if (!query.success) {
    reply.code(400);
    return { message: "Invalid query" };
  }

  try {
    const questions = await fetchTriviaQuestions(query.data);
    return questions;
  } catch (error) {
    fastify.log.error(error, "Failed to load trivia questions");
    reply.code(502);
    return { message: "Failed to load trivia questions" };
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../client");

if (existsSync(clientDistPath)) {
  await fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: "/",
    index: ["index.html"],
  });

  fastify.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? "";
    if (url.startsWith("/api") || url.startsWith("/ws")) {
      reply.callNotFound();
      return;
    }

    reply.type("text/html").sendFile("index.html");
  });
} else {
  fastify.log.warn(
    { clientDistPath },
    "Client dist directory not found; static asset serving disabled"
  );
}

fastify.register(async (app) => {
  const wsHandler = (socket: WebSocket, request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    const log = fastify.log.child({ scope: "ws", code });

    log.debug("Incoming websocket connection");

    const trackedConnection: {
      socket: WebSocket;
      role: ConnectionRole;
      playerId?: string;
    } = {
      socket,
      role: "player",
      playerId: undefined,
    };

    const state = {
      registered: false,
    };

    const send = (payload: OutgoingMessage) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    };

    const sendError = (message: string) => send({ type: "error", message });

    const completeRegistration = (role: ConnectionRole, playerId?: string) => {
      trackedConnection.role = role;
      trackedConnection.playerId = playerId;
      store.registerConnection(code, trackedConnection);
      state.registered = true;
      send({ type: "registered", role, playerId });
    };

    const handleRegister = (data: RegisterMessage) => {
      if (state.registered) {
        sendError("Already registered");
        return;
      }

      const result = RegisterMessageSchema.safeParse(data);
      if (!result.success) {
        sendError("Invalid registration payload");
        return;
      }

      if (result.data.role === "host") {
        if (!result.data.hostSecret) {
          sendError("Host secret required");
          return;
        }

        try {
          store.verifyHost(code, result.data.hostSecret);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          sendError(
            message === "Room not found"
              ? "Session not found"
              : "Invalid host secret"
          );
          log.warn(
            { err: error, hostSecret: result.data.hostSecret },
            "Host verification failed"
          );
          return;
        }

        completeRegistration("host");
        log.info("Host registered");
        return;
      }

      if (!result.data.playerId) {
        sendError("Player id required");
        return;
      }

      try {
        store.reconnectPlayer(code, result.data.playerId);
      } catch (error) {
        sendError("Player not found");
        log.warn(
          { err: error, playerId: result.data.playerId },
          "Player reconnect failed"
        );
        return;
      }

      completeRegistration("player", result.data.playerId);
      log.info({ playerId: result.data.playerId }, "Player registered");
    };

    const ensurePlayerContext = (action: string) => {
      if (!state.registered) {
        sendError("Register before sending other messages");
        return false;
      }

      if (trackedConnection.role !== "player" || !trackedConnection.playerId) {
        sendError(`Only players can ${action}`);
        return false;
      }

      return true;
    };

    const handleBuzz = () => {
      if (!ensurePlayerContext("buzz")) {
        return;
      }

      try {
        store.handleBuzz(code, trackedConnection.playerId!);
        log.info({ playerId: trackedConnection.playerId }, "Player buzzed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendError(message);
        log.warn(
          { err: error, playerId: trackedConnection.playerId },
          "Buzz handling failed"
        );
      }
    };

    socket.on("message", (raw: RawData) => {
      let json: unknown;

      try {
        json = JSON.parse(raw.toString());
      } catch (error) {
        sendError("Invalid JSON payload");
        log.warn({ err: error }, "Failed to parse websocket payload");
        return;
      }

      const parsed = IncomingMessageSchema.safeParse(json);
      if (!parsed.success) {
        sendError("Unsupported message");
        log.warn({ payload: json }, "Received unsupported websocket message");
        return;
      }

      switch (parsed.data.type) {
        case "register":
          handleRegister(parsed.data);
          break;
        case "buzz":
          handleBuzz();
          break;
        default:
          sendError("Unsupported message");
          log.warn({ payload: json }, "Received unsupported websocket message");
      }
    });

    socket.on("close", () => {
      if (state.registered) {
        store.removeConnection(code, trackedConnection);
      }
      log.debug("Websocket connection closed");
    });
  };

  app.get("/ws/:code", { websocket: true }, wsHandler);
});

const port = Number(process.env.PORT ?? 3000);
fastify
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    fastify.log.info(`Server listening on port ${port}`);
  })
  .catch((error) => {
    fastify.log.error(error, "Failed to start server");
    process.exit(1);
  });
