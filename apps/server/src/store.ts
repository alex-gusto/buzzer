import WebSocket from "ws";
import { customAlphabet, nanoid } from "nanoid";
import type { FastifyBaseLogger } from "fastify";

import type {
  GameRoom,
  Player,
  RoomConnection,
  RoomSnapshot,
} from "./types.js";
import { RoomRegistry } from "./roomRegistry.js";
import { fetchTriviaCategories, fetchTriviaQuestion } from "./triviaApi.js";

const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateRoomCode = customAlphabet(roomCodeAlphabet, 4);

const DIFFICULTY_POINTS: Record<string, number> = {
  easy: 150,
  medium: 250,
  hard: 400,
};

const SHARE_CODE_TTL = 5 * 60 * 1000; // 5 minutes

function pointsForDifficulty(difficulty: string | undefined) {
  return DIFFICULTY_POINTS[difficulty ?? "medium"] ?? 200;
}

function shuffleArray<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateShareCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export class GameStore {
  private readonly rooms = new RoomRegistry();
  private readonly log: FastifyBaseLogger;

  constructor(logger: FastifyBaseLogger) {
    this.log = logger;
  }

  async createRoom() {
    let code = "";
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const room: GameRoom = {
      code,
      hostSecret: nanoid(10),
      createdAt: Date.now(),
      questionActive: false,
      turnOrder: [],
      currentTurnIndex: null,
      currentTurnId: null,
      usedQuestions: new Set(),
      usedCategorySlots: new Set(),
      players: new Map(),
      connections: new Set(),
      categories: null,
    };

    try {
      room.categories = await fetchTriviaCategories();
    } catch (error) {
      this.log.warn(
        { code, err: error },
        "Failed to preload trivia categories"
      );
      room.categories = null;
    }

    this.rooms.set(room);
    this.log.info({ code }, "Created new room");
    return room;
  }

  getRoom(code: string) {
    return this.rooms.get(code);
  }

  verifyHost(code: string, hostSecret: string) {
    const room = this.ensureRoom(code);
    if (room.hostSecret !== hostSecret) {
      throw new Error("Forbidden");
    }

    return room;
  }

  joinRoom(code: string, name: string) {
    const room = this.ensureRoom(code);
    const trimmedName = name.trim();
    const player: Player = {
      id: nanoid(10),
      name: trimmedName,
      joinedAt: Date.now(),
      score: 0,
    };

    room.players.set(player.id, player);
    room.turnOrder.push(player.id);

    if (room.currentTurnIndex === null) {
      room.currentTurnIndex = 0;
      room.currentTurnId = player.id;
    }

    this.broadcastState(room);
    this.log.info(
      { code: room.code, playerId: player.id, name: player.name },
      "Player joined room"
    );
    return { room, player };
  }

  reconnectPlayer(code: string, playerId: string) {
    const room = this.ensureRoom(code);
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    this.log.debug({ code: room.code, playerId }, "Player reconnected to room");
    return { room, player };
  }

  setCurrentTurn(code: string, hostSecret: string, playerId: string) {
    const room = this.verifyHost(code, hostSecret);
    const player = this.getPlayer(room, playerId);

    const index = room.turnOrder.indexOf(player.id);
    if (index >= 0) {
      room.currentTurnIndex = index;
    }

    room.currentTurnId = player.id;
    this.broadcastState(room);
    this.log.info({ code, playerId }, "Current turn updated");
  }

  async activateQuestion(
    code: string,
    hostSecret: string,
    options: { category?: string; difficulty?: string }
  ) {
    const room = this.verifyHost(code, hostSecret);

    if (room.activeQuestion) {
      throw new Error("Question already in play");
    }

    const currentTurnId = this.getCurrentTurnPlayerId(room);
    const assignedTo = currentTurnId
      ? this.getPlayer(room, currentTurnId).id
      : null;

    if (!assignedTo) {
      throw new Error("Set a player on turn before activating a question");
    }

    const requestedCategory = options.category ?? null;
    let triviaCategory = requestedCategory;

    if (requestedCategory && room.categories?.[requestedCategory]?.length) {
      const subcategories = room.categories[requestedCategory];
      const shuffled = shuffleArray(subcategories);
      triviaCategory = shuffled[0] ?? requestedCategory;
    }

    const question = await fetchTriviaQuestion({
      category: triviaCategory ?? undefined,
      difficulty: options.difficulty,
      excludeIds: room.usedQuestions,
    });

    const points = pointsForDifficulty(question.difficulty);
    const choices = shuffleArray([
      ...question.incorrectAnswers,
      question.correctAnswer,
    ]);
    const slotCategory = requestedCategory ?? question.category;
    const slotKey = `${slotCategory}|${question.difficulty}`;

    if (room.usedCategorySlots.has(slotKey)) {
      throw new Error("That category and difficulty have already been played");
    }

    room.activeQuestion = {
      id: question.id,
      stage: "awaitingHostDecision",
      assignedTo,
      answeringPlayerId: assignedTo,
      attemptedPlayerIds: new Set([assignedTo]),
      turnIndex: room.currentTurnIndex,
      category: slotCategory,
      difficulty: question.difficulty,
      question: question.question,
      title: question.question,
      correctAnswer: question.correctAnswer,
      incorrectAnswers: [...question.incorrectAnswers],
      choices,
      points,
    };

    room.usedCategorySlots.add(slotKey);

    room.lastResult = undefined;
    room.questionActive = false;
    room.buzzedBy = undefined;
    room.players.forEach((player: Player) => delete player.buzzedAt);

    this.broadcastState(room);
    this.log.info(
      {
        code,
        questionId: question.id,
        assignedTo,
        category: question.category,
        difficulty: question.difficulty,
      },
      "Question activated"
    );
  }

  openQuestionToBuzzers(code: string, hostSecret: string) {
    const room = this.verifyHost(code, hostSecret);
    const active = room.activeQuestion;

    if (!active) {
      throw new Error("No active question");
    }

    if (active.stage !== "awaitingHostDecision") {
      throw new Error("Buzzers already open");
    }

    if (active.answeringPlayerId) {
      active.attemptedPlayerIds.add(active.answeringPlayerId);
    }

    active.answeringPlayerId = null;
    active.stage = "openForBuzz";

    room.questionActive = true;
    room.buzzedBy = undefined;
    room.players.forEach((player: Player) => delete player.buzzedAt);

    this.broadcastState(room);
    this.log.info(
      { code, questionId: active.id },
      "Question opened for buzzers"
    );
  }

  markAnswerCorrect(code: string, hostSecret: string, playerId?: string) {
    const room = this.verifyHost(code, hostSecret);
    const active = room.activeQuestion;

    if (!active) {
      throw new Error("No active question");
    }

    const awardedPlayerId = playerId ?? active.answeringPlayerId;

    if (!awardedPlayerId) {
      throw new Error("No answering player to award points");
    }

    const player = this.getPlayer(room, awardedPlayerId);
    player.score += active.points;

    room.usedQuestions.add(active.id);
    room.lastResult = {
      id: active.id,
      answeredCorrectly: true,
      answeredBy: player.id,
      assignedTo: active.assignedTo ?? undefined,
      pointsAwarded: active.points,
      points: active.points,
      category: active.category,
      difficulty: active.difficulty,
      title: active.title,
      correctAnswer: active.correctAnswer,
    };

    this.finishQuestion(room);
    this.log.info(
      { code, questionId: active.id, playerId: player.id },
      "Answer marked correct"
    );
  }

  markAnswerIncorrect(
    code: string,
    hostSecret: string,
    options: { openBuzzers: boolean }
  ) {
    const room = this.verifyHost(code, hostSecret);
    const active = room.activeQuestion;

    if (!active) {
      throw new Error("No active question");
    }

    const answeringId = active.answeringPlayerId;
    if (answeringId) {
      active.attemptedPlayerIds.add(answeringId);
    }

    if (options.openBuzzers) {
      this.openQuestionToBuzzers(code, hostSecret);
      return;
    }

    room.usedQuestions.add(active.id);
    room.lastResult = {
      id: active.id,
      answeredCorrectly: false,
      answeredBy: answeringId ?? undefined,
      assignedTo: active.assignedTo ?? undefined,
      pointsAwarded: 0,
      points: active.points,
      category: active.category,
      difficulty: active.difficulty,
      title: active.title,
      correctAnswer: active.correctAnswer,
    };

    this.finishQuestion(room);
    this.log.info({ code, questionId: active.id }, "Answer marked incorrect");
  }

  cancelActiveQuestion(code: string, hostSecret: string) {
    const room = this.verifyHost(code, hostSecret);
    const active = room.activeQuestion;

    if (!active) {
      return;
    }

    room.activeQuestion = undefined;
    room.questionActive = false;
    room.buzzedBy = undefined;
    room.players.forEach((player: Player) => delete player.buzzedAt);

    this.broadcastState(room);
    this.log.info({ code, questionId: active.id }, "Active question cancelled");
  }

  handleBuzz(code: string, playerId: string) {
    const room = this.ensureRoom(code);
    const active = room.activeQuestion;

    if (!active || active.stage !== "openForBuzz") {
      throw new Error("Buzz not available now");
    }

    if (active.attemptedPlayerIds.has(playerId)) {
      throw new Error("You already attempted this question");
    }

    const player = this.getPlayer(room, playerId);

    room.buzzedBy = playerId;
    room.questionActive = false;
    player.buzzedAt = Date.now();

    active.answeringPlayerId = playerId;
    active.attemptedPlayerIds.add(playerId);
    active.stage = "awaitingHostDecision";

    this.broadcastState(room);
    this.log.info({ code: room.code, playerId }, "Player buzzed");
    return { room, player };
  }

  registerConnection(code: string, connection: RoomConnection) {
    const room = this.ensureRoom(code);
    room.connections.add(connection);
    this.sendStateToConnection(room, connection);
    this.log.debug(
      { code: room.code, role: connection.role, playerId: connection.playerId },
      "Registered websocket connection"
    );
  }

  removeConnection(code: string, connection: RoomConnection) {
    const room = this.rooms.get(code);
    if (!room) {
      return;
    }

    room.connections.delete(connection);

    if (room.connections.size === 0 && room.players.size === 0) {
      this.rooms.delete(room.code);
      this.log.info({ code: room.code }, "Removed empty room");
    }
    this.log.debug(
      { code: room.code, remainingConnections: room.connections.size },
      "Removed websocket connection"
    );
  }

  snapshot(code: string): RoomSnapshot {
    const room = this.ensureRoom(code);
    this.cleanupShareCode(room);
    return this.buildSnapshot(room);
  }

  destroyRoom(code: string, hostSecret: string) {
    const room = this.verifyHost(code, hostSecret);
    const connections = Array.from(room.connections);

    this.rooms.delete(room.code);

    for (const connection of connections) {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(
            JSON.stringify({
              type: "error",
              message: "Session closed by host",
            })
          );
        }
      } catch {
        // ignore notification failures
      }

      try {
        connection.socket.close();
      } catch {
        // ignore close failures
      }
    }

    this.log.info({ code: room.code }, "Room destroyed by host");
  }

  issueShareCode(code: string, hostSecret: string) {
    const room = this.verifyHost(code, hostSecret);
    this.cleanupShareCode(room);

    let shareCode = generateShareCode();
    while (this.shareCodeExists(shareCode)) {
      shareCode = generateShareCode();
    }

    const issuedAt = Date.now();
    room.shareCode = shareCode;
    room.shareCodeIssuedAt = issuedAt;
    room.shareCodeExpiresAt = issuedAt + SHARE_CODE_TTL;

    this.broadcastState(room);
    this.log.info({ code: room.code, shareCode }, "Issued share code");
    return { shareCode, expiresAt: room.shareCodeExpiresAt };
  }

  claimShareCode(shareCode: string) {
    const normalized = shareCode.trim();
    if (!/^[0-9]{4}$/.test(normalized)) {
      throw new Error("Invalid share code");
    }

    for (const room of this.rooms.values()) {
      this.cleanupShareCode(room);
      if (room.shareCode === normalized) {
        return {
          code: room.code,
          hostSecret: room.hostSecret,
          expiresAt: room.shareCodeExpiresAt ?? null,
        };
      }
    }

    throw new Error("Share code not found");
  }

  removePlayer(code: string, playerId: string) {
    const room = this.ensureRoom(code);
    const player = this.getPlayer(room, playerId);

    room.players.delete(playerId);

    const orderIndex = room.turnOrder.indexOf(playerId);
    if (orderIndex !== -1) {
      room.turnOrder.splice(orderIndex, 1);
      if (room.turnOrder.length === 0) {
        room.currentTurnIndex = null;
      } else if (room.currentTurnIndex !== null) {
        if (room.currentTurnIndex > orderIndex) {
          room.currentTurnIndex -= 1;
        }
        if (room.currentTurnIndex >= room.turnOrder.length) {
          room.currentTurnIndex = 0;
        }
      }
    }

    if (room.currentTurnId === playerId) {
      room.currentTurnId = null;
    }

    if (room.activeQuestion) {
      room.activeQuestion.attemptedPlayerIds.delete(playerId);
      if (room.activeQuestion.assignedTo === playerId) {
        room.activeQuestion.assignedTo = null;
      }
      if (room.activeQuestion.answeringPlayerId === playerId) {
        room.activeQuestion.answeringPlayerId = null;
        if (room.activeQuestion.stage === "awaitingHostDecision") {
          room.questionActive = false;
          room.buzzedBy = undefined;
        }
      }
    }

    if (room.buzzedBy === playerId) {
      room.buzzedBy = undefined;
      room.questionActive = false;
    }

    if (room.lastResult) {
      if (room.lastResult.answeredBy === playerId) {
        room.lastResult.answeredBy = undefined;
      }
      if (room.lastResult.assignedTo === playerId) {
        room.lastResult.assignedTo = undefined;
      }
    }

    const staleConnections: RoomConnection[] = [];
    for (const connection of room.connections) {
      if (connection.playerId === playerId) {
        staleConnections.push(connection);
      }
    }
    staleConnections.forEach((connection) => {
      room.connections.delete(connection);
      try {
        connection.socket.close();
      } catch {
        // Ignore socket close errors
      }
    });

    if (room.players.size === 0 && room.connections.size === 0) {
      this.rooms.delete(room.code);
      this.log.info({ code: room.code }, "Removed room after last player left");
      return;
    }

    this.broadcastState(room);
    this.log.info({ code: room.code, playerId: player.id }, "Player left room");
  }

  listRooms() {
    const summaries: Array<{
      code: string;
      createdAt: number;
      playerCount: number;
      questionActive: boolean;
      hostOnline: boolean;
      shareActive: boolean;
      shareExpiresAt: number | null;
    }> = [];

    for (const room of this.rooms.values()) {
      this.cleanupShareCode(room);
      const hostOnline = Array.from(room.connections).some(
        (connection) => connection.role === "host"
      );
      const shareInfo = this.getActiveShareInfo(room);

      summaries.push({
        code: room.code,
        createdAt: room.createdAt,
        playerCount: room.players.size,
        questionActive: Boolean(room.activeQuestion),
        hostOnline,
        shareActive: Boolean(shareInfo),
        shareExpiresAt: shareInfo?.expiresAt ?? null,
      });
    }

    summaries.sort((a, b) => b.createdAt - a.createdAt);
    return summaries;
  }

  broadcastState(room: GameRoom) {
    this.cleanupShareCode(room);
    const staleConnections: RoomConnection[] = [];

    for (const connection of room.connections) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({
          type: "state",
          payload: this.buildSnapshot(room, {
            includeCorrectAnswer: connection.role === "host",
            includeShareCode: connection.role === "host",
          }),
        });
        connection.socket.send(payload);
        continue;
      }

      staleConnections.push(connection);
    }

    if (staleConnections.length > 0) {
      staleConnections.forEach((connection) =>
        room.connections.delete(connection)
      );
    }
  }

  private sendStateToConnection(room: GameRoom, connection: RoomConnection) {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(
        JSON.stringify({
          type: "state",
          payload: this.buildSnapshot(room, {
            includeCorrectAnswer: connection.role === "host",
            includeShareCode: connection.role === "host",
          }),
        })
      );
    }
  }

  private ensureRoom(code: string) {
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error("Room not found");
    }

    return room;
  }

  private getPlayer(room: GameRoom, playerId: string) {
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found");
    }

    return player;
  }

  private getCurrentTurnPlayerId(room: GameRoom) {
    if (room.currentTurnId && room.players.has(room.currentTurnId)) {
      return room.currentTurnId;
    }

    if (room.currentTurnIndex === null || room.turnOrder.length === 0) {
      room.currentTurnId = null;
      return null;
    }

    const candidate = room.turnOrder[room.currentTurnIndex];
    if (candidate && room.players.has(candidate)) {
      room.currentTurnId = candidate;
      return candidate;
    }

    this.advanceTurn(room, room.currentTurnIndex - 1);
    return room.currentTurnId;
  }

  private advanceTurn(room: GameRoom, fromIndex?: number | null) {
    if (room.turnOrder.length === 0) {
      room.currentTurnIndex = null;
      room.currentTurnId = null;
      return;
    }

    const startIndex =
      typeof fromIndex === "number" ? fromIndex : room.currentTurnIndex ?? 0;

    for (let offset = 1; offset <= room.turnOrder.length; offset += 1) {
      const nextIndex =
        (startIndex + offset + room.turnOrder.length) % room.turnOrder.length;
      const nextId = room.turnOrder[nextIndex];
      if (room.players.has(nextId)) {
        room.currentTurnIndex = nextIndex;
        room.currentTurnId = nextId;
        return;
      }
    }

    room.currentTurnIndex = null;
    room.currentTurnId = null;
  }

  private finishQuestion(room: GameRoom) {
    const active = room.activeQuestion;
    const turnIndex = active?.turnIndex ?? room.currentTurnIndex;

    room.activeQuestion = undefined;
    room.questionActive = false;
    room.buzzedBy = undefined;
    room.players.forEach((player: Player) => delete player.buzzedAt);

    this.advanceTurn(room, turnIndex);

    this.broadcastState(room);
  }

  private buildSnapshot(
    room: GameRoom,
    options: { includeCorrectAnswer?: boolean; includeShareCode?: boolean } = {}
  ): RoomSnapshot {
    const currentTurnId = this.getCurrentTurnPlayerId(room);
    const includeCorrectAnswer = options.includeCorrectAnswer ?? false;
    const includeShareCode = options.includeShareCode ?? false;
    const shareInfo = this.getActiveShareInfo(room);

    const players = Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      joinedAt: player.joinedAt,
      buzzedAt: player.buzzedAt,
      score: player.score,
      isTurn: currentTurnId === player.id,
    }));

    const activeQuestion = room.activeQuestion
      ? {
          id: room.activeQuestion.id,
          category: room.activeQuestion.category,
          difficulty: room.activeQuestion.difficulty,
          title: room.activeQuestion.title,
          prompt: room.activeQuestion.question,
          points: room.activeQuestion.points,
          stage: room.activeQuestion.stage,
          assignedTo: this.playerRef(room, room.activeQuestion.assignedTo),
          answeringPlayer: this.playerRef(
            room,
            room.activeQuestion.answeringPlayerId
          ),
          attemptedPlayerIds: Array.from(
            room.activeQuestion.attemptedPlayerIds
          ),
          ...(includeCorrectAnswer
            ? {
                correctAnswer: room.activeQuestion.correctAnswer,
                choices: room.activeQuestion.choices,
              }
            : {}),
        }
      : null;

    const buzzedBy = room.buzzedBy ? this.playerRef(room, room.buzzedBy) : null;

    const lastResult = room.lastResult
      ? {
          id: room.lastResult.id,
          category: room.lastResult.category,
          difficulty: room.lastResult.difficulty,
          title: room.lastResult.title,
          points: room.lastResult.points,
          answeredCorrectly: room.lastResult.answeredCorrectly,
          answeredBy: room.lastResult.answeredBy
            ? this.playerRef(room, room.lastResult.answeredBy)
            : null,
          assignedTo: room.lastResult.assignedTo
            ? this.playerRef(room, room.lastResult.assignedTo)
            : null,
          pointsAwarded: room.lastResult.pointsAwarded,
          correctAnswer: room.lastResult.correctAnswer,
        }
      : null;

    return {
      code: room.code,
      questionActive: room.questionActive,
      buzzedBy,
      currentTurn: currentTurnId ? this.playerRef(room, currentTurnId) : null,
      players,
      activeQuestion,
      lastResult,
      categories: room.categories ?? null,
      usedCategorySlots: Array.from(room.usedCategorySlots),
      shareCode: includeShareCode ? shareInfo?.code ?? null : null,
      shareCodeIssuedAt: includeShareCode ? shareInfo?.issuedAt ?? null : null,
      shareCodeExpiresAt: shareInfo?.expiresAt ?? null,
    };
  }

  private playerRef(room: GameRoom, playerId: string | undefined | null) {
    if (!playerId) {
      return null;
    }

    const player = room.players.get(playerId);
    return player ? { playerId: player.id, name: player.name } : null;
  }

  private cleanupShareCode(room: GameRoom) {
    if (!room.shareCode) {
      return;
    }

    if (room.shareCodeExpiresAt && room.shareCodeExpiresAt > Date.now()) {
      return;
    }

    delete room.shareCode;
    delete room.shareCodeIssuedAt;
    delete room.shareCodeExpiresAt;
  }

  private getActiveShareInfo(room: GameRoom) {
    this.cleanupShareCode(room);
    if (!room.shareCode) {
      return null;
    }

    return {
      code: room.shareCode,
      issuedAt: room.shareCodeIssuedAt ?? null,
      expiresAt: room.shareCodeExpiresAt ?? null,
    };
  }

  private shareCodeExists(shareCode: string) {
    for (const room of this.rooms.values()) {
      this.cleanupShareCode(room);
      if (room.shareCode === shareCode) {
        return true;
      }
    }
    return false;
  }
}
