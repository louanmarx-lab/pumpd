import type { LoggedExercise, SetLog, WorkoutLog } from '../types';
import { isValidDateString } from './localDate';
import { completedWorkoutExercises } from './workoutDraft';

const HEADER = 'PUMPD-WORKOUT-1';
const MAX_CODE_LENGTH = 250_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

type TransferWorkout = Pick<WorkoutLog, 'id' | 'routineName' | 'date' | 'timestamp' | 'durationSeconds' | 'exercises'>;

export function encodeWorkoutTransfer(log: WorkoutLog): string {
  const { routineName, date, timestamp, durationSeconds } = log;
  const id = log.transferSourceId || log.id.replace(/^log_import_/, '');
  const workout: TransferWorkout = {
    id, routineName, date, timestamp, durationSeconds,
    exercises: completedWorkoutExercises(log.exercises).map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets.map(({ setNumber, type, weightKg, reps, rpe }) => ({
        setNumber, type, weightKg, reps, rpe, isCompleted: true,
      })),
    })),
  };
  const code = `${HEADER}\n${JSON.stringify(workout)}`;
  decodeWorkoutTransfer(code);
  return code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readExercise(value: unknown): LoggedExercise {
  if (!isRecord(value) || typeof value.exerciseId !== 'string' || !ID_PATTERN.test(value.exerciseId)
    || typeof value.exerciseName !== 'string' || !value.exerciseName.trim() || value.exerciseName.length > 300
    || !Array.isArray(value.sets) || !value.sets.length) {
    throw new Error('This workout contains an invalid exercise.');
  }
  return { exerciseId: value.exerciseId, exerciseName: value.exerciseName, sets: value.sets.map(readSet) };
}

function readSet(value: unknown): SetLog {
  if (!isRecord(value)) throw new Error('This workout contains an invalid set.');
  const { setNumber, type, weightKg, reps, rpe } = value;
  if (typeof setNumber !== 'number' || !Number.isSafeInteger(setNumber) || setNumber < 1
    || (type !== 'Normal' && type !== 'Warmup' && type !== 'Drop' && type !== 'Failure')
    || typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg < 0
    || typeof reps !== 'number' || !Number.isSafeInteger(reps) || reps < 1
    || (rpe !== undefined && (typeof rpe !== 'number' || !Number.isFinite(rpe) || rpe < 0 || rpe > 10))) {
    throw new Error('This workout contains an invalid set.');
  }
  return { setNumber, type, weightKg, reps, rpe, isCompleted: true };
}

export function decodeWorkoutTransfer(input: string): TransferWorkout {
  const text = input.trim();
  if (text.length > MAX_CODE_LENGTH || !text.startsWith(HEADER + '\n') && !text.startsWith(HEADER + '\r\n')) {
    throw new Error('Paste the complete workout code your buddy shared.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text.slice(HEADER.length));
  } catch {
    throw new Error('This workout code is incomplete. Copy the full message and try again.');
  }
  if (!isRecord(value)) throw new Error('This workout code is invalid.');
  const { id, routineName, date, timestamp, durationSeconds, exercises } = value;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)
    || typeof routineName !== 'string' || !routineName.trim() || routineName.length > 300
    || typeof date !== 'string' || !isValidDateString(date)
    || typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 8.64e15
    || (durationSeconds !== undefined && (typeof durationSeconds !== 'number' || !Number.isSafeInteger(durationSeconds) || durationSeconds < 0))
    || !Array.isArray(exercises) || !exercises.length) {
    throw new Error('This workout code is invalid.');
  }
  return { id, routineName, date, timestamp, durationSeconds, exercises: exercises.map(readExercise) };
}
