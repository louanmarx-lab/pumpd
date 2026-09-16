export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Quads'
  | 'Hamstrings'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Calves'
  | 'Abs';

export type SetType = 'Normal' | 'Warmup' | 'Drop' | 'Failure';

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  dailyProteinGoalGrams?: number;
}

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface DaySchedule {
  day: DayOfWeek;
  routineId: string | 'rest';
  routineName: string;
  exerciseIds?: string[];
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  activeWorkspaceId: string;
  macroTargets: MacroTargets;
  weeklySchedule?: DaySchedule[];
  createdAt: number | string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

export interface Exercise {
  id: string;
  workspaceId: string | null; // null for global default exercises
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface Split {
  id: string;
  userId: string;
  name: string;
  description?: string;
  routines: Routine[];
  isActive: boolean;
}

export interface SetLog {
  setNumber: number;
  type: SetType;
  weightKg: number;
  reps: number;
  rpe?: number;
  isCompleted: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workspaceId: string;
  splitId: string;
  routineName: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  durationSeconds?: number;
  exercises: LoggedExercise[];
}

export interface Meal {
  id: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  timestamp: number;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  meals: Meal[];
}

export interface BodyMetric {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPercentage?: number;
  skeletalMuscleMassKg?: number;
}

export interface HistoricalBenchmark {
  previousSessionSets: SetLog[];
  previousSessionDate?: string;
  maxRepsAtWeight: number;
  estimated1RM: number; // Brzycki formula
  bestWorkingSet?: {
    weightKg: number;
    reps: number;
    estimated1RM: number;
    date?: string;
  };
}

export * from './workoutTimer';
