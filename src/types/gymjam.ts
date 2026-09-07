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
  timestamp: number;
}

export interface SyncSessionMessage {
  type: 'SYNC_SESSION';
  routineName: string;
  exerciseIds: string[];
  hostUserId: string;
  hostUserName: string;
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
  | AddExerciseMessage
  | ReorderExerciseMessage
  | StartTimerMessage
  | PingMessage
  | PongMessage;

export interface JamLiveToast {
  id: string;
  message: string;
  userName: string;
  timestamp: number;
}

// -------------------------------------------------------------
// Visual Barbell Plate Calculator Types
// -------------------------------------------------------------
export type PlateWeight = 25 | 20 | 15 | 10 | 5 | 2.5 | 1.25;

export interface PlateDefinition {
  weight: PlateWeight;
  color: string;
  borderColor: string;
  textColor: string;
  heightRatio: number; // Proportional height (0.0 to 1.0)
  widthRatio: number;  // Visual width on barbell sleeve
  label: string;
}

export interface PlateCount {
  plate: PlateDefinition;
  count: number;
}

export interface PlateCalculationResult {
  targetWeight: number;
  barWeight: number;
  weightPerSide: number;
  platesPerSide: PlateCount[];
  remainderKg: number;
  totalCalculatedWeight: number;
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
  } | null;
  exercisesSummary: {
    exerciseName: string;
    completedSetsCount: number;
    topSetWeight: number;
    topSetReps: number;
  }[];
}
