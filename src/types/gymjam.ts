import {
  CoachLogSetMessage,
  SwapExerciseMessage,
  SyncPresetsMessage,
  PrescribedMealArchetype,
  UserRole,
} from './trainer';

export * from './trainer';

export type JamConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type JamRole = 'host' | 'guest';

export interface LogSetMessage {
  type: 'LOG_SET';
  userId: string;
  userName: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  rpe?: number;
  timestamp: number;
}

export interface SyncSessionMessage {
  type: 'SYNC_SESSION';
  routineName: string;
  exerciseIds: string[];
  hostUserId: string;
  hostUserName: string;
  hostRole?: UserRole;
  timestamp: number;
}

export interface AddExerciseMessage {
  type: 'ADD_EXERCISE';
  exerciseId: string;
  exerciseName: string;
  userId: string;
  timestamp: number;
}

export interface ReorderExerciseMessage {
  type: 'REORDER_EXERCISE';
  fromIndex: number;
  toIndex: number;
  userId: string;
  timestamp: number;
}

export interface StartTimerMessage {
  type: 'START_TIMER';
  durationSeconds: number;
  initiatedBy: string;
  timestamp: number;
}

export interface AdvanceExerciseMessage {
  type: 'ADVANCE_EXERCISE';
  exerciseIndex: number;
  exerciseId: string;
  exerciseName: string;
  initiatedBy: string;
  timestamp: number;
}

export interface TurnSetMessage {
  type: 'TURN_SET';
  activeTurnUserId: string;
  activeTurnUserName: string;
  lastCompletedSet?: {
    exerciseId: string;
    setIndex: number;
    weight: number;
    reps: number;
    rpe?: number;
    completedBy: string;
  };
  restTimerSeconds?: number;
  timestamp: number;
}

export interface PingMessage {
  type: 'PING';
  timestamp: number;
}

export interface PongMessage {
  type: 'PONG';
  timestamp: number;
}

export type JamMessage =
  | SyncSessionMessage
  | LogSetMessage
  | CoachLogSetMessage
  | AddExerciseMessage
  | SwapExerciseMessage
  | ReorderExerciseMessage
  | StartTimerMessage
  | SyncPresetsMessage
  | AdvanceExerciseMessage
  | TurnSetMessage
  | PingMessage
  | PongMessage;

export interface JamLiveToast {
  id: string;
  message: string;
  userName: string;
  timestamp: number;
}

// -------------------------------------------------------------
// Meal Archetypes Types
// -------------------------------------------------------------
export interface MealArchetype {
  id: string;
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  isCustom?: boolean;
  prescribedBy?: string;
  instructions?: string;
}

// -------------------------------------------------------------
// Workout Receipt Types
// -------------------------------------------------------------
export interface WorkoutReceiptData {
  id: string;
  date: string;
  routineName: string;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  bestLift?: {
    exerciseName: string;
    weightKg: number;
    reps: number;
  } | null;
  gymJamBuddy?: {
    name: string;
    roomPin: string;
    role?: 'coach' | 'athlete';
  } | null;
  coachAttribution?: {
    name: string;
    businessName?: string;
    instagramHandle?: string;
  } | null;
  exercisesSummary: {
    exerciseName: string;
    completedSetsCount: number;
    topSetWeight: number;
    topSetReps: number;
  }[];
}
