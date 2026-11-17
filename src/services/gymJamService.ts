import { callSecureBackend } from './secureBackend';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserRole } from '../types/trainer';
import { SessionExerciseTemplate } from '../types/gymjam';

export interface JamRoomData {
  roomPin: string;
  hostUserId: string;
  hostName: string;
  hostRole: UserRole;
  routineName: string;
  exerciseIds: string[];
  sessionExercisesTemplate?: SessionExerciseTemplate[];
  guestUserId?: string | null;
  guestName?: string | null;
  status: 'waiting' | 'connected' | 'ended';
  activeTurnUserId: string;
  activeTurnUserName: string;
  activeExerciseIndex?: number;
  lifters?: {
    [userId: string]: {
      name: string;
      isHost: boolean;
    };
  };
  benchmarks?: {
    [userId: string]: Record<string, any>;
  };
  sessionExercises?: {
    [userId: string]: any[];
  };
  lastEvent?: {
    id: string;
    type:
      | 'LOG_SET'
      | 'COACH_LOG_SET'
      | 'TURN_SET'
      | 'ADVANCE_EXERCISE'
      | 'START_TIMER'
      | 'SWAP_EXERCISE'
      | 'ADD_EXERCISE'
      | 'SYNC_BENCHMARKS'
      | 'UPDATE_LIFTER_SET'
      | 'ADD_LIFTER_SET'
      | 'REMOVE_LIFTER_SET'
      | 'FINISH_WORKOUT';
    payload: any;
    senderId: string;
    senderName: string;
    senderClientId?: string;
    timestamp: number;
  } | null;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION_NAME = 'gym_jam_rooms';

/**
 * Remove any undefined properties recursively to guarantee Firestore setDoc/updateDoc never errors.
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Host a new Gym Jam room on Cloud Firestore
 */
export async function createJamRoomCloud(
  roomPin: string,
  host: {
    userId: string;
    displayName: string;
    role: UserRole;
  },
  workout: {
    routineName: string;
    exerciseIds: string[];
    sessionExercisesTemplate?: SessionExerciseTemplate[];
  }
): Promise<JamRoomData> {
  return callSecureBackend<JamRoomData>('createWorkoutRoom', workout);
}

/**
/**
 * Normalizes any format of a GymBuddy / RIPPED BUDDY room PIN (e.g. "42", "rip-42", "RIP-42", "PUMP-42", or QR payloads)
 */
export function normalizeJamRoomPin(rawPin: string): string {
  let clean = (rawPin || '').trim().toUpperCase();

  // If input is JSON string from QR payload
  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawPin.trim());
      if (parsed.roomPin) clean = String(parsed.roomPin).toUpperCase();
      else if (parsed.pin) clean = String(parsed.pin).toUpperCase();
      else if (parsed.code) clean = String(parsed.code).toUpperCase();
    } catch {}
  }

  clean = clean.replace(/\s+/g, '');

  if (clean.startsWith('RIP-')) {
    return clean;
  }
  if (clean.startsWith('RIP')) {
    return `RIP-${clean.slice(3)}`;
  }
  if (clean.startsWith('PUMP-')) {
    return `RIP-${clean.slice(5)}`;
  }
  if (clean.startsWith('PUMP')) {
    return `RIP-${clean.slice(4)}`;
  }
  return `RIP-${clean.replace(/^[^0-9A-Z]+/, '')}`;
}

/**
 * Returns a prioritized list of candidate room PIN keys in Firestore
 * to ensure rooms are found regardless of prefix (RIP- vs legacy PUMP- vs raw number)
 */
export function getJamRoomCandidatePins(rawPin: string): string[] {
  let clean = (rawPin || '').trim().toUpperCase();

  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawPin.trim());
      if (parsed.roomPin) clean = String(parsed.roomPin).toUpperCase();
      else if (parsed.pin) clean = String(parsed.pin).toUpperCase();
      else if (parsed.code) clean = String(parsed.code).toUpperCase();
    } catch {}
  }
  clean = clean.replace(/\s+/g, '');

  const candidates: string[] = [];
  const primary = normalizeJamRoomPin(clean);
  if (primary) candidates.push(primary);

  if (clean && !candidates.includes(clean)) {
    candidates.push(clean);
  }

  const digits = clean.replace(/\D/g, '');
  if (digits) {
    const rip = `RIP-${digits}`;
    if (!candidates.includes(rip)) candidates.push(rip);
    const pump = `PUMP-${digits}`;
    if (!candidates.includes(pump)) candidates.push(pump);
  }

  return candidates;
}

/**
 * Checks an active Gym Jam room without joining yet (used for previewing host details)
 */
export async function peekJamRoomCloud(
  rawPin: string
): Promise<{ success: boolean; data?: JamRoomData; error?: string; resolvedPin?: string }> {
  try {
    const data = await callSecureBackend<JamRoomData>('workoutInvitation', { code: normalizeJamRoomPin(rawPin), join: false });
    return { success: true, data, resolvedPin: data.roomPin };
  } catch (error) { return { success: false, error: (error as Error).message }; }
}

/**
 * Join an existing Gym Jam room by room PIN
 */
export async function joinJamRoomCloud(
  roomPin: string,
  guest: {
    userId: string;
    displayName: string;
  }
): Promise<{ success: boolean; data?: JamRoomData; error?: string; resolvedPin?: string }> {
  try {
    const data = await callSecureBackend<JamRoomData>('workoutInvitation', { code: normalizeJamRoomPin(roomPin), join: true });
    return { success: true, data, resolvedPin: data.roomPin };
  } catch (error) { return { success: false, error: (error as Error).message }; }
}

/**
 * Real-time listener for the Gym Jam room
 */
export function subscribeToJamRoomCloud(
  roomPin: string,
  onUpdate: (room: JamRoomData) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);

  return onSnapshot(
    roomRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as JamRoomData;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('[GymJamCloud] Room listener error:', err);
      onError?.(err);
    }
  );
}

/**
 * Update full session exercises or benchmarks in the room
 */
export async function updateJamRoomSessionData(
  roomPin: string,
  updates: Partial<JamRoomData>
): Promise<void> {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);
  try {
    await updateDoc(roomRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[GymJamCloud] Error updating session data:', err);
  }
}

/**
 * Broadcast an event (set logged, turn switch, timer started, exercise advanced, lifter set updated)
 */
export async function broadcastJamEventCloud(
  roomPin: string,
  event: {
    type:
      | 'LOG_SET'
      | 'COACH_LOG_SET'
      | 'TURN_SET'
      | 'ADVANCE_EXERCISE'
      | 'START_TIMER'
      | 'SWAP_EXERCISE'
      | 'ADD_EXERCISE'
      | 'SYNC_BENCHMARKS'
      | 'UPDATE_LIFTER_SET'
      | 'ADD_LIFTER_SET'
      | 'REMOVE_LIFTER_SET'
      | 'FINISH_WORKOUT';
    payload: any;
    senderId: string;
    senderName: string;
    senderClientId?: string;
  }
): Promise<void> {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);

  const eventPayload = {
    id: `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    ...event,
    timestamp: Date.now(),
  };

  const updates: any = {
    lastEvent: eventPayload,
    updatedAt: Date.now(),
  };

  // If turning set, update active turn metadata on room doc
  if (event.type === 'TURN_SET' && event.payload?.activeTurnUserId) {
    updates.activeTurnUserId = event.payload.activeTurnUserId;
    updates.activeTurnUserName = event.payload.activeTurnUserName;
  }

  // If advancing exercise, update active exercise index on room doc
  if (event.type === 'ADVANCE_EXERCISE' && typeof event.payload?.exerciseIndex === 'number') {
    updates.activeExerciseIndex = event.payload.exerciseIndex;
  }

  try {
    await updateDoc(roomRef, sanitizeForFirestore(updates));
  } catch (err) {
    console.warn('[GymJamCloud] Error broadcasting event:', err);
  }
}

/**
 * Leave or end the Gym Jam room
 */
export async function leaveJamRoomCloud(
  roomPin: string,
  userId: string,
  isHost: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NAME, roomPin), { status: 'ended', updatedAt: Date.now() });
}

/**
 * Persists the entire live session exercises state to the Gym Jam room document.
 * This ensures that if any lifter's phone closes, sleeps, or reopens, they immediately
 * receive the complete, full state of all sets logged by their partner.
 */
export async function syncJamRoomExercisesCloud(
  roomPin: string,
  sessionExercises: Record<string, any[]>
): Promise<void> {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);
  try {
    await updateDoc(roomRef, sanitizeForFirestore({
      sessionExercises,
      updatedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('[GymJamCloud] Error syncing full session exercises:', err);
    throw err;
  }
}

/**
 * Updates the coach's client roster with the athlete's latest workout date in real time.
 */
export async function updateCoachClientLastSessionCloud(
  coachId: string,
  athleteUserId: string,
  athleteEmail: string | undefined,
  date: string
): Promise<void> {
  try {
    const coachRef = doc(db, 'users', coachId);
    const snap = await getDoc(coachRef);
    if (!snap.exists()) return;
    const coachData = snap.data();
    const currentClients: any[] = Array.isArray(coachData?.clients) ? coachData.clients : [];
    let changed = false;
    const updatedClients = currentClients.map((c) => {
      const match =
        (c.linkedUserId && c.linkedUserId === athleteUserId) ||
        (c.id === athleteUserId) ||
        (athleteEmail && c.email && c.email.toLowerCase() === athleteEmail.toLowerCase());
      if (match) {
        changed = true;
        return { ...c, lastSessionDate: date };
      }
      return c;
    });
    if (changed) {
      await updateDoc(coachRef, sanitizeForFirestore({ clients: updatedClients, updatedAt: Date.now() }));
    }
  } catch (err) {
    console.warn('[GymJamCloud] Error updating coach client session date:', err);
  }
}

