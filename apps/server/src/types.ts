import type WebSocket from 'ws';

export type Player = {
  id: string;
  name: string;
  joinedAt: number;
  buzzedAt?: number;
  score: number;
};

export type ConnectionRole = 'host' | 'player';

export type RoomSnapshot = {
  code: string;
  questionActive: boolean;
  buzzedBy: { playerId: string; name: string } | null;
  currentTurn: { playerId: string; name: string } | null;
  players: Array<{
    id: string;
    name: string;
    joinedAt: number;
    buzzedAt?: number;
    score: number;
    isTurn: boolean;
  }>;
  activeQuestion: {
    category: string;
    id: string;
    difficulty: string;
    title: string;
    prompt: string;
    points: number;
    stage: 'awaitingHostDecision' | 'openForBuzz';
    assignedTo: { playerId: string; name: string } | null;
    answeringPlayer: { playerId: string; name: string } | null;
    attemptedPlayerIds: string[];
    correctAnswer?: string;
    choices?: string[];
  } | null;
  lastResult: {
    category: string;
    id: string;
    difficulty: string;
    title: string;
    points: number;
    answeredCorrectly: boolean;
    answeredBy: { playerId: string; name: string } | null;
    assignedTo: { playerId: string; name: string } | null;
    pointsAwarded: number;
    correctAnswer: string;
  } | null;
  categories: Record<string, string[]> | null;
  usedCategorySlots: string[];
  shareCode: string | null;
  shareCodeIssuedAt: number | null;
  shareCodeExpiresAt: number | null;
};

export type RoomConnection = {
  socket: WebSocket;
  role: ConnectionRole;
  playerId?: string;
};

export type GameRoom = {
  code: string;
  hostSecret: string;
  createdAt: number;
  questionActive: boolean;
  buzzedBy?: string;
  turnOrder: string[];
  currentTurnIndex: number | null;
  currentTurnId: string | null;
  activeQuestion?: {
    id: string;
    stage: 'awaitingHostDecision' | 'openForBuzz';
    assignedTo: string | null;
    answeringPlayerId: string | null;
    attemptedPlayerIds: Set<string>;
    turnIndex: number | null;
    category: string;
    difficulty: string;
    question: string;
    title: string;
    correctAnswer: string;
    incorrectAnswers: string[];
    choices: string[];
    points: number;
  };
  usedQuestions: Set<string>;
  usedCategorySlots: Set<string>;
  lastResult?: {
    id: string;
    answeredCorrectly: boolean;
    answeredBy?: string;
    assignedTo?: string;
    pointsAwarded: number;
    points: number;
    category: string;
    difficulty: string;
    title: string;
    correctAnswer: string;
  };
  categories: Record<string, string[]> | null;
  players: Map<string, Player>;
  connections: Set<RoomConnection>;
  shareCode?: string;
  shareCodeIssuedAt?: number;
  shareCodeExpiresAt?: number;
};
