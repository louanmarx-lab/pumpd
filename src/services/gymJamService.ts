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

export interface JamRoomData {
  roomPin: string;
  hostUserId: string;
  hostName: string;
  hostRole: UserRole;
  routineName: string;
  exerciseIds: string[];
  guestUserId?: string | null;
  guestName?: string | null;
  status: 'waiting' | 'connected' | 'ended';
  activeTurnUserId: string;
  activeTurnUserName: string;
  activeExerciseIndex?: number;
  lastEvent?: {
    id: string;
    type:
      | 'LOG_SET'
      | 'COACH_LOG_SET'
      | 'TURN_SET'
      | 'ADVANCE_EXERCISE'
      | 'START_TIMER'
      | 'SWAP_EXERCISE'
      | 'ADD_EXERCISE';
    payload: any;
    senderId: string;
    senderName: string;
    timestamp: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

const COLLECTION_NAME = 'gym_jam_rooms';

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
  }
): Promise<JamRoomData> {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);

  const roomData: JamRoomData = {
    roomPin,
    hostUserId: host.userId,
    hostName: host.displayName,
    hostRole: host.role,
    routineName: workout.routineName,
    exerciseIds: workout.exerciseIds,
    guestUserId: null,
    guestName: null,
    status: 'waiting',
    activeTurnUserId: host.userId,
    activeTurnUserName: host.displayName,
    activeExerciseIndex: 0,
    lastEvent: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await setDoc(roomRef, roomData);
  } catch (err) {
    console.warn('[GymJamCloud] Error creating room in cloud:', err);
  }

  return roomData;
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
): Promise<{ success: boolean; data?: JamRoomData; error?: string }> {
  const roomRef = doc(db, COLLECTION_NAME, roomPin);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) {
      return {
        success: false,
        error: 'Gym Jam room not found. Please verify the room code with the host.',
      };
    }

    const roomData = snap.data() as JamRoomData;
    if (roomData.status === 'ended') {
      return {
        success: false,
        error: 'This Gym Jam workout session has already ended.',
      };
    }

    // Connect guest
    const updates = {
      guestUserId: guest.userId,
      guestName: guest.displayName,
      status: 'connected',
      updatedAt: Date.now(),
    };

    await updateDoc(roomRef, updates);

    return {
      success: true,
      data: { ...roomData, ...updates } as JamRoomData,
    };
  } catch (err: any) {
    console.warn('[GymJamCloud] Error joining room:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to Gym Jam room.',
    };
  }
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
 * Broadcast an event (set logged, turn switch, timer started, exercise advanced)
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
      | 'ADD_EXERCISE';
    payload: any;
    senderId: string;
    senderName: string;
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
    await updateDoc(roomRef, updates);
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
  const roomRef = doc(db, COLLECTION_NAME, roomPin);

  try {
    if (isHost) {
      await updateDoc(roomRef, {
        status: 'ended',
        updatedAt: Date.now(),
      });
    } else {
      await updateDoc(roomRef, {
        status: 'waiting',
        guestUserId: null,
        guestName: null,
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[GymJamCloud] Error leaving room:', err);
  }
}
