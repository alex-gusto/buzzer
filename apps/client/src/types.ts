export type PlayerRef = {
  playerId: string;
  name: string;
};

export type PlayerSummary = {
  id: string;
  name: string;
  joinedAt: number;
  buzzedAt?: number;
  score: number;
  isTurn: boolean;
};

export type ActiveQuestionStage = 'awaitingHostDecision' | 'openForBuzz';

export type ActiveQuestionSnapshot = {
  id: string;
  category: string;
  difficulty: string;
  title: string;
  prompt: string;
  points: number;
  stage: ActiveQuestionStage;
  assignedTo: PlayerRef | null;
  answeringPlayer: PlayerRef | null;
  attemptedPlayerIds: string[];
  correctAnswer?: string;
  choices?: string[];
};

export type QuestionResultSnapshot = {
  id: string;
  category: string;
  difficulty: string;
  title: string;
  points: number;
  answeredCorrectly: boolean;
  answeredBy: PlayerRef | null;
  assignedTo: PlayerRef | null;
  pointsAwarded: number;
  correctAnswer: string;
};

export type RoomSnapshot = {
  code: string;
  questionActive: boolean;
  buzzedBy: PlayerRef | null;
  currentTurn: PlayerRef | null;
  players: PlayerSummary[];
  activeQuestion: ActiveQuestionSnapshot | null;
  lastResult: QuestionResultSnapshot | null;
  categories: Record<string, string[]> | null;
  usedCategorySlots: string[];
};

export type RegisterMessage =
  | { type: 'register'; role: 'host'; hostSecret: string }
  | { type: 'register'; role: 'player'; playerId: string };

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed';
