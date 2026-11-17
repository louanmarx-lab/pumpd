import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggedExercise, SetLog } from '../types';

export type DraftSet = SetLog & { weightInput?: string; repsInput?: string };

export interface WorkoutDraft {
  startedAt: number;
  title: string;
  splitId?: string;
  routineId?: string;
  exerciseIds: string[];
  lifterId: string;
  exercises: LoggedExercise[];
  elapsedSeconds: number;
  buddy?: { id: string; exercises: LoggedExercise[] };
}

export function workoutDraftKey(ownerId: string, targetId: string): string {
  return `@ripped_workout_draft_${JSON.stringify([ownerId, targetId])}`;
}

export async function loadWorkoutDraft(key: string): Promise<WorkoutDraft | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const draft: WorkoutDraft = JSON.parse(raw);
  if (draft.buddy && (typeof draft.buddy.id !== 'string' || !Array.isArray(draft.buddy.exercises))) {
    delete draft.buddy;
  }
  return Number.isFinite(draft.startedAt) && Array.isArray(draft.exercises) && Array.isArray(draft.exerciseIds)
    ? draft : null;
}

export function saveWorkoutDraft(key: string, draft: WorkoutDraft): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(draft));
}

export function clearWorkoutDraft(key: string): Promise<void> {
  return AsyncStorage.removeItem(key);
}

export function parseSetWeight(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseSetReps(input: string): number | null {
  const cleaned = input.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  const reps = Number(cleaned);
  return Number.isSafeInteger(reps) && reps > 0 ? reps : null;
}

export function completedWorkoutExercises(exercises: LoggedExercise[]): LoggedExercise[] {
  return exercises.flatMap((exercise) => {
    const sets = exercise.sets
      .filter((set) => set.isCompleted && Number.isFinite(set.weightKg) && set.weightKg >= 0
        && Number.isSafeInteger(set.reps) && set.reps > 0)
      .map(({ weightInput: _weightInput, repsInput: _repsInput, ...set }: DraftSet) => set);
    return sets.length ? [{ ...exercise, sets }] : [];
  });
}
