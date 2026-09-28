import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  description: string;
  routines: SharedRoutineData[];
  createdAt: number;
}

const COLLECTION_NAME = 'shared_splits';
const LOCAL_CACHE_PREFIX = '@ripped_shared_split_';

/**
 * Clean data recursively to ensure Cloud Firestore never receives `undefined` fields
 */
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value === undefined ? '' : value))
  );
}

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
 * Share an entire Split to Cloud Firestore with local cache fallback
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
  const routinesData: SharedRoutineData[] = (split.routines || []).map((r) => {
    const routineExercises: SharedExerciseData[] = (r.exerciseIds || [])
      .map((exId) => allExercises.find((e) => e.id === exId))
      .filter((e): e is Exercise => Boolean(e))
      .map((e) => ({
        id: e.id || `ex_${Date.now()}`,
        name: e.name || 'Exercise',
        muscleGroup: e.muscleGroup || ('Chest' as MuscleGroup),
        equipment: e.equipment || 'Barbell',
      }));

    return {
      id: r.id || `rt_${Date.now()}`,
      name: r.name || 'Routine',
      exerciseIds: r.exerciseIds || [],
      exercises: routineExercises,
    };
  });

  const rawPayload: SharedSplitPayload = {
    shareCode,
    type: 'split',
    authorName: authorName || 'RIPPED Athlete',
    authorId: authorId || 'anonymous',
    splitName: split.name || 'Workout Split',
    description: split.description || '',
    routines: routinesData,
    createdAt: Date.now(),
  };

  const payload = sanitizeForFirestore(rawPayload);

  // Cache locally for instantaneous resolution & offline testing
  try {
    const serialized = JSON.stringify(payload);
    await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${shareCode}`, serialized);
    await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${codeNum}`, serialized);
  } catch (cacheErr) {
    console.warn('[ShareSplit] Failed to cache locally:', cacheErr);
  }

  // Upload to Cloud Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, shareCode);
    await setDoc(docRef, payload);
  } catch (cloudErr) {
    console.warn('[ShareSplit] Cloud Firestore upload error (cached locally):', cloudErr);
  }

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
      id: e.id || `ex_${Date.now()}`,
      name: e.name || 'Exercise',
      muscleGroup: e.muscleGroup || ('Chest' as MuscleGroup),
      equipment: e.equipment || 'Barbell',
    }));

  const routinesData: SharedRoutineData[] = [
    {
      id: routine.id || `rt_${Date.now()}`,
      name: routine.name || 'Routine',
      exerciseIds: routine.exerciseIds || [],
      exercises: routineExercises,
    },
  ];

  const rawPayload: SharedSplitPayload = {
    shareCode,
    type: 'routine',
    authorName: authorName || 'RIPPED Athlete',
    authorId: authorId || 'anonymous',
    splitName: splitName || routine.name || 'Workout Routine',
    description: `Single workout routine: ${routine.name}`,
    routines: routinesData,
    createdAt: Date.now(),
  };

  const payload = sanitizeForFirestore(rawPayload);

  // Cache locally
  try {
    const serialized = JSON.stringify(payload);
    await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${shareCode}`, serialized);
    await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${codeNum}`, serialized);
  } catch (cacheErr) {
    console.warn('[ShareSplit] Failed to cache routine locally:', cacheErr);
  }

  // Upload to Cloud Firestore
  try {
    const docRef = doc(db, COLLECTION_NAME, shareCode);
    await setDoc(docRef, payload);
  } catch (cloudErr) {
    console.warn('[ShareSplit] Cloud Firestore upload error for routine:', cloudErr);
  }

  return shareCode;
}

/**
 * Fetch a shared split or routine from Cloud Firestore or local cache by share code
 */
export async function fetchSharedSplitCloud(inputCode: string): Promise<SharedSplitPayload | null> {
  let cleanCode = inputCode.trim().toUpperCase();
  if (!cleanCode) return null;

  // 1. Try Cloud Firestore direct lookup
  try {
    const docRef = doc(db, COLLECTION_NAME, cleanCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as SharedSplitPayload;
      await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${cleanCode}`, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('[ShareSplit] Firestore lookup error, will check local cache:', err);
  }

  // 2. If user typed 4-character suffix without prefix (e.g. "8492"), try with prefixes in Firestore
  if (!cleanCode.startsWith('SPLIT-') && !cleanCode.startsWith('WKT-')) {
    try {
      const splitDocRef = doc(db, COLLECTION_NAME, `SPLIT-${cleanCode}`);
      const splitSnap = await getDoc(splitDocRef);
      if (splitSnap.exists()) {
        const data = splitSnap.data() as SharedSplitPayload;
        await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${cleanCode}`, JSON.stringify(data));
        return data;
      }

      const wktDocRef = doc(db, COLLECTION_NAME, `WKT-${cleanCode}`);
      const wktSnap = await getDoc(wktDocRef);
      if (wktSnap.exists()) {
        const data = wktSnap.data() as SharedSplitPayload;
        await AsyncStorage.setItem(`${LOCAL_CACHE_PREFIX}${cleanCode}`, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('[ShareSplit] Prefix search error, checking local cache:', err);
    }
  }

  // 3. Fallback to Local Persistent Cache (handles offline / same device testing)
  try {
    const cachedDirect = await AsyncStorage.getItem(`${LOCAL_CACHE_PREFIX}${cleanCode}`);
    if (cachedDirect) {
      return JSON.parse(cachedDirect) as SharedSplitPayload;
    }

    if (!cleanCode.startsWith('SPLIT-') && !cleanCode.startsWith('WKT-')) {
      const cachedSplit = await AsyncStorage.getItem(`${LOCAL_CACHE_PREFIX}SPLIT-${cleanCode}`);
      if (cachedSplit) {
        return JSON.parse(cachedSplit) as SharedSplitPayload;
      }
      const cachedWkt = await AsyncStorage.getItem(`${LOCAL_CACHE_PREFIX}WKT-${cleanCode}`);
      if (cachedWkt) {
        return JSON.parse(cachedWkt) as SharedSplitPayload;
      }
    }
  } catch (cacheErr) {
    console.warn('[ShareSplit] Local cache lookup error:', cacheErr);
  }

  return null;
}
