export interface WorkoutTimerState {
  startTime: number | null;
  accumulatedTime: number;
  isRunning: boolean;
  elapsedSeconds: number;
}

export interface StoredTimerData {
  startTime: number | null;
  accumulatedTime: number;
  isRunning: boolean;
  lastUpdated?: number;
}

export interface UseWorkoutTimerOptions {
  /** Automatically start the timer on mount if no active timer is stored. Default: true */
  autoStart?: boolean;
  /** Storage key used for persisting the timer state in AsyncStorage. Default: '@pumpd_active_workout_timer' */
  storageKey?: string;
  /** Optional initial accumulated seconds. Default: 0 */
  initialAccumulatedTime?: number;
}

export interface UseWorkoutTimerReturn {
  startTime: number | null;
  accumulatedTime: number;
  isRunning: boolean;
  elapsedSeconds: number;
  formattedDuration: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  togglePauseResume: () => void;
  reset: () => void;
  stop: () => number;
  formatDuration: (seconds?: number) => string;
}
