import { Exercise, HistoricalBenchmark, MuscleGroup, SetLog, WorkoutLog } from '../types';

/**
 * Calculates Estimated 1-Rep Max (1RM) using the Brzycki / Epley formula:
 * 1RM = Weight * (1 + Reps / 30)
 */
export function calculate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const estimated = weightKg * (1 + reps / 30);
  return Math.round(estimated * 10) / 10;
}

/**
 * Returns historical reference benchmarks for a given exercise:
 * 1. Previous session sets & date
 * 2. Max reps achieved at the current weight input
 * 3. Overall highest estimated 1RM for this exercise
 */
export function getExerciseHistory(
  workoutLogs: WorkoutLog[],
  exerciseId: string,
  currentWeight: number = 0
): HistoricalBenchmark {
  // Sort logs descending by timestamp
  const sortedLogs = [...workoutLogs].sort((a, b) => b.timestamp - a.timestamp);

  let previousSessionSets: SetLog[] = [];
  let previousSessionDate: string | undefined = undefined;
  let maxRepsAtWeight = 0;
  let max1RM = 0;
  let bestWorkingSet: { weightKg: number; reps: number; estimated1RM: number; date?: string } | undefined = undefined;

  for (const log of sortedLogs) {
    const loggedEx = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!loggedEx) continue;

    // Grab the most recent session's sets if not captured yet
    if (previousSessionSets.length === 0) {
      previousSessionSets = loggedEx.sets.filter((s) => s.isCompleted);
      previousSessionDate = log.date;
    }

    // Process sets for PR max reps, max 1RM, and best multi-rep working set (>1 rep)
    for (const set of loggedEx.sets) {
      if (!set.isCompleted || set.weightKg <= 0 || set.reps <= 0) continue;

      const e1RM = calculate1RM(set.weightKg, set.reps);
      if (e1RM > max1RM) {
        max1RM = e1RM;
      }

      // Best set that is NOT a 1-rep max (reps > 1)
      if (set.reps > 1) {
        if (
          !bestWorkingSet ||
          e1RM > bestWorkingSet.estimated1RM ||
          (e1RM === bestWorkingSet.estimated1RM && set.weightKg > bestWorkingSet.weightKg)
        ) {
          bestWorkingSet = {
            weightKg: set.weightKg,
            reps: set.reps,
            estimated1RM: e1RM,
            date: log.date,
          };
        }
      }

      if (currentWeight > 0 && Math.abs(set.weightKg - currentWeight) < 0.1) {
        if (set.reps > maxRepsAtWeight) {
          maxRepsAtWeight = set.reps;
        }
      }
    }
  }

  return {
    previousSessionSets,
    previousSessionDate,
    maxRepsAtWeight,
    estimated1RM: max1RM,
    bestWorkingSet,
  };
}

export interface ExerciseSessionProgress {
  logId: string;
  date: string;
  timestamp: number;
  routineName: string;
  maxWeightKg: number;
  bestSet: { weightKg: number; reps: number; estimated1RM: number };
  estimated1RM: number;
  totalVolumeKg: number;
  completedSetsCount: number;
}

/**
 * Returns chronological progress points for a single exercise across all sessions.
 */
export function getExerciseProgression(
  workoutLogs: WorkoutLog[],
  exerciseId: string
): ExerciseSessionProgress[] {
  const sortedLogs = [...workoutLogs].sort((a, b) => a.timestamp - b.timestamp);
  const progress: ExerciseSessionProgress[] = [];

  for (const log of sortedLogs) {
    const loggedEx = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!loggedEx) continue;

    const completedSets = loggedEx.sets.filter(
      (s) => s.isCompleted && s.weightKg > 0 && s.reps > 0
    );
    if (completedSets.length === 0) continue;

    let maxWeightKg = 0;
    let dayMax1RM = 0;
    let totalVolumeKg = 0;
    let bestSet = { weightKg: 0, reps: 0, estimated1RM: 0 };

    for (const set of completedSets) {
      if (set.weightKg > maxWeightKg) {
        maxWeightKg = set.weightKg;
      }
      totalVolumeKg += set.weightKg * set.reps;
      const e1RM = calculate1RM(set.weightKg, set.reps);
      if (e1RM > dayMax1RM) {
        dayMax1RM = e1RM;
      }
      if (e1RM > bestSet.estimated1RM) {
        bestSet = { weightKg: set.weightKg, reps: set.reps, estimated1RM: e1RM };
      }
    }

    progress.push({
      logId: log.id,
      date: log.date,
      timestamp: log.timestamp,
      routineName: log.routineName,
      maxWeightKg,
      bestSet,
      estimated1RM: dayMax1RM,
      totalVolumeKg: Math.round(totalVolumeKg),
      completedSetsCount: completedSets.length,
    });
  }

  return progress;
}

/**
 * Aggregates total working sets (Normal, Drop, Failure) per muscle group over a date range.
 */
export function calculateWeeklyVolume(
  workoutLogs: WorkoutLog[],
  exercisesMap: Record<string, Exercise>,
  startDateStr: string,
  endDateStr: string
): Record<MuscleGroup, number> {
  const volumeMap: Record<MuscleGroup, number> = {
    Chest: 0,
    Back: 0,
    Quads: 0,
    Hamstrings: 0,
    Shoulders: 0,
    Biceps: 0,
    Triceps: 0,
    Calves: 0,
    Abs: 0,
  };

  const filteredLogs = workoutLogs.filter(
    (log) => log.date >= startDateStr && log.date <= endDateStr
  );

  for (const log of filteredLogs) {
    for (const loggedEx of log.exercises) {
      const exerciseDef = exercisesMap[loggedEx.exerciseId];
      if (!exerciseDef) continue;

      const muscleGroup = exerciseDef.muscleGroup;
      // Working sets exclude Warmup
      const workingSetsCount = loggedEx.sets.filter(
        (s) => s.isCompleted && s.type !== 'Warmup'
      ).length;

      if (volumeMap[muscleGroup] !== undefined) {
        volumeMap[muscleGroup] += workingSetsCount;
      }
    }
  }

  return volumeMap;
}

/**
 * Default Seed Exercises covering all 9 Muscle Groups
 */
export const DEFAULT_EXERCISES: Exercise[] = [
  // Chest
  { id: 'ex_1', workspaceId: null, name: 'Barbell Flat Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'ex_2', workspaceId: null, name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex_3', workspaceId: null, name: 'Cable Chest Flyes', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'ex_28', workspaceId: null, name: 'Cable Crossover', muscleGroup: 'Chest', equipment: 'Cable' },
  { id: 'ex_33', workspaceId: null, name: 'Incline Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { id: 'ex_34', workspaceId: null, name: 'Flat Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { id: 'ex_35', workspaceId: null, name: 'Chest-Supported Machine Press', muscleGroup: 'Chest', equipment: 'Machine' },
  { id: 'ex_36', workspaceId: null, name: 'Bodyweight Dips', muscleGroup: 'Chest', equipment: 'Bodyweight' },

  // Back
  { id: 'ex_4', workspaceId: null, name: 'Barbell Conventional Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'ex_5', workspaceId: null, name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex_6', workspaceId: null, name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex_7', workspaceId: null, name: 'Pull-ups', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { id: 'ex_32', workspaceId: null, name: 'Cable Rear Delt Crossovers', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex_37', workspaceId: null, name: 'Barbell Bent-Over Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { id: 'ex_38', workspaceId: null, name: 'Chest-Supported T-Bar Row', muscleGroup: 'Back', equipment: 'Machine' },
  { id: 'ex_39', workspaceId: null, name: 'Single-Arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { id: 'ex_40', workspaceId: null, name: 'Neutral-Grip Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { id: 'ex_41', workspaceId: null, name: 'Straight-Arm Lat Pulldown (Cable Pullover)', muscleGroup: 'Back', equipment: 'Cable' },

  // Quads
  { id: 'ex_8', workspaceId: null, name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
  { id: 'ex_9', workspaceId: null, name: 'Leg Press', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'ex_10', workspaceId: null, name: 'Leg Extensions', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'ex_29', workspaceId: null, name: 'Machine Squat', muscleGroup: 'Quads', equipment: 'Machine' },
  { id: 'ex_51', workspaceId: null, name: 'Bulgarian Split Squat', muscleGroup: 'Quads', equipment: 'Dumbbell' },
  { id: 'ex_52', workspaceId: null, name: 'Goblet Squat', muscleGroup: 'Quads', equipment: 'Dumbbell' },

  // Hamstrings & Glutes
  { id: 'ex_11', workspaceId: null, name: 'Romanian Deadlift (RDL)', muscleGroup: 'Hamstrings', equipment: 'Barbell' },
  { id: 'ex_12', workspaceId: null, name: 'Lying Leg Curl', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'ex_53', workspaceId: null, name: 'Seated Leg Curl', muscleGroup: 'Hamstrings', equipment: 'Machine' },
  { id: 'ex_54', workspaceId: null, name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Dumbbell' },
  { id: 'ex_55', workspaceId: null, name: 'Barbell Hip Thrust', muscleGroup: 'Hamstrings', equipment: 'Barbell' },

  // Shoulders
  { id: 'ex_13', workspaceId: null, name: 'Dumbbell Overhead Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex_14', workspaceId: null, name: 'Lateral Raises', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'ex_15', workspaceId: null, name: 'Face Pulls', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'ex_30', workspaceId: null, name: 'Machine Side Raise', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'ex_31', workspaceId: null, name: 'Machine Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Machine' },
  { id: 'ex_42', workspaceId: null, name: 'Barbell Overhead Press (OHP)', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { id: 'ex_43', workspaceId: null, name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { id: 'ex_44', workspaceId: null, name: 'Reverse Pec Deck (Rear Delt Fly)', muscleGroup: 'Shoulders', equipment: 'Machine' },

  // Biceps
  { id: 'ex_16', workspaceId: null, name: 'Barbell Standing Bicep Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'ex_17', workspaceId: null, name: 'Dumbbell Hammer Curls', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex_23', workspaceId: null, name: 'Preacher Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex_24', workspaceId: null, name: 'Hammer Preacher Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex_25', workspaceId: null, name: 'Barbell Hammer Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },
  { id: 'ex_45', workspaceId: null, name: 'Incline Dumbbell Bicep Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
  { id: 'ex_46', workspaceId: null, name: 'Cable Bicep Curl', muscleGroup: 'Biceps', equipment: 'Cable' },
  { id: 'ex_47', workspaceId: null, name: 'EZ-Bar Preacher Curl', muscleGroup: 'Biceps', equipment: 'Barbell' },

  // Triceps
  { id: 'ex_18', workspaceId: null, name: 'Tricep Rope Pushdown', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex_19', workspaceId: null, name: 'EZ-Bar Skull Crushers', muscleGroup: 'Triceps', equipment: 'Barbell' },
  { id: 'ex_26', workspaceId: null, name: 'Cable Push Downs', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex_27', workspaceId: null, name: 'Machine Dips', muscleGroup: 'Triceps', equipment: 'Machine' },
  { id: 'ex_48', workspaceId: null, name: 'Overhead Cable Tricep Extension', muscleGroup: 'Triceps', equipment: 'Cable' },
  { id: 'ex_49', workspaceId: null, name: 'Dumbbell Overhead Tricep Extension', muscleGroup: 'Triceps', equipment: 'Dumbbell' },
  { id: 'ex_50', workspaceId: null, name: 'Close-Grip Barbell Bench Press', muscleGroup: 'Triceps', equipment: 'Barbell' },

  // Calves
  { id: 'ex_20', workspaceId: null, name: 'Standing Calf Raise', muscleGroup: 'Calves', equipment: 'Machine' },
  { id: 'ex_56', workspaceId: null, name: 'Seated Calf Raise', muscleGroup: 'Calves', equipment: 'Machine' },

  // Abs
  { id: 'ex_21', workspaceId: null, name: 'Hanging Leg Raise', muscleGroup: 'Abs', equipment: 'Bodyweight' },
  { id: 'ex_22', workspaceId: null, name: 'Cable Kneeling Crunch', muscleGroup: 'Abs', equipment: 'Cable' },
  { id: 'ex_57', workspaceId: null, name: 'Cable Woodchoppers', muscleGroup: 'Abs', equipment: 'Cable' },
];
