import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Split, Routine, Exercise, MuscleGroup } from '../types';

export interface SharedExerciseData {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
}

export interface SharedRoutineData {
  id: string;
  name: string;
  exerciseIds: string[];
  exercises: SharedExerciseData[];
}

export interface SharedSplitPayload {
  shareCode: string; // e.g. SPLIT-8492 or WKT-3910
  type: 'split' | 'routine';
  authorName: string;
  authorId: string;
  splitName: string;
  description?: string;
  routines: SharedRoutineData[];
  createdAt: number;
}

const COLLECTION_NAME = 'shared_splits';

/**
 * Generate a clean, human-readable 4-character random code (digits + uppercase letters excluding confusing 0/O, 1/I)
 */
function generateRandomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Share an entire Split to Cloud Firestore
 */
export async function shareSplitCloud(
  split: Split,
  allExercises: Exercise[],
  authorName: string,
  authorId: string
): Promise<string> {
  const codeNum = generateRandomCode();
  const shareCode = `SPLIT-${codeNum}`;

  // Map each routine with embedded exercise definitions
  const routinesData: SharedRoutineData[] = split.routines.map((r) => {
    const routineExercises: SharedExerciseData[] = (r.exerciseIds || [])
      .map((exId) => allExercises.find((e) => e.id === exId))
      .filter((e): e is Exercise => Boolean(e))
      .map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
      }));

    return {
      id: r.id,
      name: r.name,
      exerciseIds: r.exerciseIds || [],
      exercises: routineExercises,
    };
  });

  const payload: SharedSplitPayload = {
    shareCode,
    type: 'split',
    authorName: authorName || 'Pumpd Athlete',
    authorId,
    splitName: split.name,
    description: split.description,
    routines: routinesData,
    createdAt: Date.now(),
  };

  const docRef = doc(db, COLLECTION_NAME, shareCode);
  await setDoc(docRef, payload);

  return shareCode;
}

/**
 * Share a single Routine to Cloud Firestore
 */
export async function shareRoutineCloud(
  routine: Routine,
  splitName: string,
  allExercises: Exercise[],
  authorName: string,
  authorId: string
): Promise<string> {
  const codeNum = generateRandomCode();
  const shareCode = `WKT-${codeNum}`;

  const routineExercises: SharedExerciseData[] = (routine.exerciseIds || [])
    .map((exId) => allExercises.find((e) => e.id === exId))
    .filter((e): e is Exercise => Boolean(e))
    .map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
    }));

  const routinesData: SharedRoutineData[] = [
    {
      id: routine.id,
      name: routine.name,
      exerciseIds: routine.exerciseIds || [],
      exercises: routineExercises,
    },
  ];

  const payload: SharedSplitPayload = {
    shareCode,
    type: 'routine',
    authorName: authorName || 'Pumpd Athlete',
    authorId,
    splitName: splitName || routine.name,
    description: `Single workout routine: ${routine.name}`,
    routines: routinesData,
    createdAt: Date.now(),
  };

  const docRef = doc(db, COLLECTION_NAME, shareCode);
  await setDoc(docRef, payload);

  return shareCode;
}

/**
 * Fetch a shared split or routine from Cloud Firestore by share code
 */
export async function fetchSharedSplitCloud(inputCode: string): Promise<SharedSplitPayload | null> {
  let cleanCode = inputCode.trim().toUpperCase();
  if (!cleanCode) return null;

  // Try direct lookup
  let docRef = doc(db, COLLECTION_NAME, cleanCode);
  let snap = await getDoc(docRef);

  if (snap.exists()) {
    return snap.data() as SharedSplitPayload;
  }

  // If user only typed the 4-character suffix (e.g. "8492"), try prefixes
  if (!cleanCode.startsWith('SPLIT-') && !cleanCode.startsWith('WKT-')) {
    const splitDocRef = doc(db, COLLECTION_NAME, `SPLIT-${cleanCode}`);
    const splitSnap = await getDoc(splitDocRef);
    if (splitSnap.exists()) {
      return splitSnap.data() as SharedSplitPayload;
    }

    const wktDocRef = doc(db, COLLECTION_NAME, `WKT-${cleanCode}`);
    const wktSnap = await getDoc(wktDocRef);
    if (wktSnap.exists()) {
      return wktSnap.data() as SharedSplitPayload;
    }
  }

  return null;
}
