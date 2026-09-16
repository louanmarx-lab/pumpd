import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  JamConnectionStatus,
  JamRole,
  LogSetMessage,
  CoachLogSetMessage,
  SyncSessionMessage,
  AddExerciseMessage,
  SwapExerciseMessage,
  ReorderExerciseMessage,
  StartTimerMessage,
  SyncPresetsMessage,
  AdvanceExerciseMessage,
  TurnSetMessage,
  JamLiveToast,
  PrescribedMealArchetype,
  UserRole,
} from '../types/gymjam';
import {
  JamRoomData,
  createJamRoomCloud,
  joinJamRoomCloud,
  subscribeToJamRoomCloud,
  broadcastJamEventCloud,
  leaveJamRoomCloud,
} from '../services/gymJamService';

const JAM_STORAGE_KEY = '@pumpd_active_jam_session';

export interface UseGymJamProps {
  currentUserId: string;
  currentUserName: string;
  userRole?: UserRole;
  onSyncSessionReceived?: (msg: SyncSessionMessage) => void;
  onPartnerLoggedSet?: (msg: LogSetMessage) => void;
  onCoachLoggedSet?: (msg: CoachLogSetMessage) => void;
  onExerciseAdded?: (msg: AddExerciseMessage) => void;
  onExerciseSwapped?: (msg: SwapExerciseMessage) => void;
  onExerciseReordered?: (msg: ReorderExerciseMessage) => void;
  onTimerSync?: (msg: StartTimerMessage) => void;
  onPresetsSync?: (msg: SyncPresetsMessage) => void;
  onAdvanceExercise?: (msg: AdvanceExerciseMessage) => void;
  onTurnSet?: (msg: TurnSetMessage) => void;
}

export function useGymJam({
  currentUserId,
  currentUserName,
  userRole = 'athlete',
  onSyncSessionReceived,
  onPartnerLoggedSet,
  onCoachLoggedSet,
  onExerciseAdded,
  onExerciseSwapped,
  onExerciseReordered,
  onTimerSync,
  onPresetsSync,
  onAdvanceExercise,
  onTurnSet,
}: UseGymJamProps) {
  const [connectionStatus, setConnectionStatus] = useState<JamConnectionStatus>('disconnected');
  const [roomPin, setRoomPin] = useState<string | null>(null);
  const [role, setRole] = useState<JamRole | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [liveToasts, setLiveToasts] = useState<JamLiveToast[]>([]);

  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  const lastProcessedEventIdRef = useRef<string | null>(null);

  // Keep references to latest callbacks to avoid stale closures
  const callbacksRef = useRef({
    onSyncSessionReceived,
    onPartnerLoggedSet,
    onCoachLoggedSet,
    onExerciseAdded,
    onExerciseSwapped,
    onExerciseReordered,
    onTimerSync,
    onPresetsSync,
    onAdvanceExercise,
    onTurnSet,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSyncSessionReceived,
      onPartnerLoggedSet,
      onCoachLoggedSet,
      onExerciseAdded,
      onExerciseSwapped,
      onExerciseReordered,
      onTimerSync,
      onPresetsSync,
      onAdvanceExercise,
      onTurnSet,
    };
  }, [
    onSyncSessionReceived,
    onPartnerLoggedSet,
    onCoachLoggedSet,
    onExerciseAdded,
    onExerciseSwapped,
    onExerciseReordered,
    onTimerSync,
    onPresetsSync,
    onAdvanceExercise,
    onTurnSet,
  ]);

  // Helper to display real-time live toast notification
  const addToast = useCallback((message: string, userName: string) => {
    const toast: JamLiveToast = {
      id: `toast_${Date.now()}_${Math.random()}`,
      message,
      userName,
      timestamp: Date.now(),
    };
    setLiveToasts((prev) => [toast, ...prev].slice(0, 3));

    setTimeout(() => {
      setLiveToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4500);
  }, []);

  // Handle incoming real-time room updates from Firestore
  const handleRoomSnapshot = useCallback(
    (room: JamRoomData) => {
      // 1. Connection status transition
      if (room.status === 'connected') {
        setConnectionStatus('connected');

        // Identify partner
        if (role === 'host') {
          if (room.guestName && room.guestName !== partnerName) {
            setPartnerName(room.guestName);
            setPartnerUserId(room.guestUserId || 'guest');
            addToast(`Partner ${room.guestName} joined the Jam!`, room.guestName);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          if (room.hostName && room.hostName !== partnerName) {
            setPartnerName(room.hostName);
            setPartnerUserId(room.hostUserId);
          }
        }
      } else if (room.status === 'waiting') {
        if (role === 'host') {
          setConnectionStatus('connecting');
          setPartnerName(null);
          setPartnerUserId(null);
        }
      } else if (room.status === 'ended') {
        setConnectionStatus('disconnected');
        addToast('Gym Jam session was ended by the host', 'Gym Jam');
      }

      // 2. Process real-time events (sets, turns, timer, exercise advances)
      const event = room.lastEvent;
      if (!event || event.id === lastProcessedEventIdRef.current) return;
      lastProcessedEventIdRef.current = event.id;

      // Ignore self-dispatched events
      if (event.senderId === currentUserId) return;

      switch (event.type) {
        case 'LOG_SET': {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          addToast(
            `${event.senderName} logged Set ${event.payload.setIndex + 1}: ${event.payload.weight}kg × ${event.payload.reps}`,
            event.senderName
          );
          callbacksRef.current.onPartnerLoggedSet?.({
            type: 'LOG_SET',
            userId: event.senderId,
            userName: event.senderName,
            exerciseId: event.payload.exerciseId,
            setIndex: event.payload.setIndex,
            weight: event.payload.weight,
            reps: event.payload.reps,
            rpe: event.payload.rpe,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'COACH_LOG_SET': {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          addToast(
            `Coach ${event.senderName} logged Set ${event.payload.setIndex + 1}: ${event.payload.weight}kg × ${event.payload.reps}`,
            event.senderName
          );
          callbacksRef.current.onCoachLoggedSet?.({
            type: 'COACH_LOG_SET',
            coachId: event.senderId,
            coachName: event.senderName,
            athleteId: event.payload.athleteId,
            exerciseId: event.payload.exerciseId,
            setIndex: event.payload.setIndex,
            weight: event.payload.weight,
            reps: event.payload.reps,
            rpe: event.payload.rpe,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'TURN_SET': {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (event.payload.activeTurnUserId === currentUserId) {
            addToast(`🎯 It's YOUR turn to lift!`, 'Gym Jam');
          } else {
            addToast(`⏳ ${event.payload.activeTurnUserName}'s turn to lift`, 'Gym Jam');
          }
          callbacksRef.current.onTurnSet?.({
            type: 'TURN_SET',
            activeTurnUserId: event.payload.activeTurnUserId,
            activeTurnUserName: event.payload.activeTurnUserName,
            lastCompletedSet: event.payload.lastCompletedSet,
            restTimerSeconds: event.payload.restTimerSeconds,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'ADVANCE_EXERCISE': {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          addToast(`Advanced to ${event.payload.exerciseName}`, event.senderName);
          callbacksRef.current.onAdvanceExercise?.({
            type: 'ADVANCE_EXERCISE',
            exerciseIndex: event.payload.exerciseIndex,
            exerciseId: event.payload.exerciseId,
            exerciseName: event.payload.exerciseName,
            initiatedBy: event.senderName,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'START_TIMER': {
          addToast(`Rest timer synced (${event.payload.durationSeconds}s)`, event.senderName);
          callbacksRef.current.onTimerSync?.({
            type: 'START_TIMER',
            durationSeconds: event.payload.durationSeconds,
            initiatedBy: event.senderName,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'SWAP_EXERCISE': {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          addToast(`Swapped exercise to ${event.payload.newExerciseName}`, event.senderName);
          callbacksRef.current.onExerciseSwapped?.({
            type: 'SWAP_EXERCISE',
            coachId: event.senderId,
            exerciseIndex: event.payload.exerciseIndex,
            oldExerciseId: event.payload.oldExerciseId,
            newExerciseId: event.payload.newExerciseId,
            newExerciseName: event.payload.newExerciseName,
            timestamp: event.timestamp,
          });
          break;
        }

        case 'ADD_EXERCISE': {
          addToast(`${event.payload.exerciseName} added to workout`, event.senderName);
          callbacksRef.current.onExerciseAdded?.({
            type: 'ADD_EXERCISE',
            exerciseId: event.payload.exerciseId,
            exerciseName: event.payload.exerciseName,
            userId: event.senderId,
            timestamp: event.timestamp,
          });
          break;
        }

        default:
          break;
      }
    },
    [currentUserId, role, partnerName, addToast]
  );

  // Host a new session: generates clean PIN PUMP-XX and creates Firestore room
  const hostRoom = useCallback(
    async (initialSyncData: { routineName: string; exerciseIds: string[] }) => {
      try {
        disconnect();

        // 2-digit clean code e.g. PUMP-42
        const pinNumber = Math.floor(10 + Math.random() * 90);
        const pin = `PUMP-${pinNumber}`;

        setRoomPin(pin);
        setRole('host');
        setConnectionStatus('connecting');

        await createJamRoomCloud(
          pin,
          {
            userId: currentUserId,
            displayName: currentUserName,
            role: userRole,
          },
          initialSyncData
        );

        // Subscribe to real-time room events
        const unsub = subscribeToJamRoomCloud(pin, handleRoomSnapshot, (err) => {
          console.warn('[GymJam] Error listening to hosted room:', err);
        });
        unsubscribeRoomRef.current = unsub;

        await AsyncStorage.setItem(
          JAM_STORAGE_KEY,
          JSON.stringify({
            roomPin: pin,
            role: 'host',
            timestamp: Date.now(),
          })
        );

        return pin;
      } catch (err) {
        console.warn('[GymJam] Failed to host room:', err);
        setConnectionStatus('error');
        return null;
      }
    },
    [currentUserId, currentUserName, userRole, handleRoomSnapshot]
  );

  // Join an existing room via PIN
  const joinRoom = useCallback(
    async (rawPin: string) => {
      try {
        disconnect();

        const clean = rawPin.trim().toUpperCase();
        // Support either raw number "42" or "PUMP-42"
        const normalizedPin = clean.startsWith('PUMP-') ? clean : `PUMP-${clean.replace(/\D/g, '')}`;

        setRoomPin(normalizedPin);
        setRole('guest');
        setConnectionStatus('connecting');

        const result = await joinJamRoomCloud(normalizedPin, {
          userId: currentUserId,
          displayName: currentUserName,
        });

        if (!result.success || !result.data) {
          setConnectionStatus('error');
          return false;
        }

        const room = result.data;
        setPartnerName(room.hostName);
        setPartnerUserId(room.hostUserId);
        setConnectionStatus('connected');
        addToast(`Joined Gym Jam room with ${room.hostName}!`, room.hostName);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Synchronize initial routine queue with host
        callbacksRef.current.onSyncSessionReceived?.({
          type: 'SYNC_SESSION',
          hostUserId: room.hostUserId,
          hostUserName: room.hostName,
          hostRole: room.hostRole,
          routineName: room.routineName,
          exerciseIds: room.exerciseIds,
          timestamp: room.createdAt,
        });

        // Subscribe to real-time room updates
        const unsub = subscribeToJamRoomCloud(normalizedPin, handleRoomSnapshot, (err) => {
          console.warn('[GymJam] Error listening to guest room:', err);
        });
        unsubscribeRoomRef.current = unsub;

        await AsyncStorage.setItem(
          JAM_STORAGE_KEY,
          JSON.stringify({
            roomPin: normalizedPin,
            role: 'guest',
            timestamp: Date.now(),
          })
        );

        return true;
      } catch (err) {
        console.warn('[GymJam] Failed to join room:', err);
        setConnectionStatus('error');
        return false;
      }
    },
    [currentUserId, currentUserName, handleRoomSnapshot, addToast]
  );

  // Broadcast set log
  const broadcastLogSet = useCallback(
    (exerciseId: string, setIndex: number, weight: number, reps: number, rpe?: number) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'LOG_SET',
        payload: { exerciseId, setIndex, weight, reps, rpe },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast coach remote log
  const broadcastCoachLogSet = useCallback(
    (
      athleteId: string,
      exerciseId: string,
      setIndex: number,
      weight: number,
      reps: number,
      rpe?: number
    ) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'COACH_LOG_SET',
        payload: { athleteId, exerciseId, setIndex, weight, reps, rpe },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast add exercise
  const broadcastAddExercise = useCallback(
    (exerciseId: string, exerciseName: string) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'ADD_EXERCISE',
        payload: { exerciseId, exerciseName },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast swap exercise
  const broadcastSwapExercise = useCallback(
    (exerciseIndex: number, oldExerciseId: string, newExerciseId: string, newExerciseName: string) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'SWAP_EXERCISE',
        payload: { exerciseIndex, oldExerciseId, newExerciseId, newExerciseName },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast timer sync
  const broadcastStartTimer = useCallback(
    (durationSeconds: number) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'START_TIMER',
        payload: { durationSeconds },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast nutrition presets sync
  const broadcastSyncPresets = useCallback(
    (
      archetypes: PrescribedMealArchetype[],
      macroTargets?: any,
      businessName?: string,
      instagramHandle?: string
    ) => {
      if (!roomPin) return;
      callbacksRef.current.onPresetsSync?.({
        type: 'SYNC_PRESETS',
        coachName: currentUserName,
        businessName,
        instagramHandle,
        macroTargets,
        archetypes,
        timestamp: Date.now(),
      });
    },
    [roomPin, currentUserName]
  );

  // Broadcast advance exercise to next exercise
  const broadcastAdvanceExercise = useCallback(
    (exerciseIndex: number, exerciseId: string, exerciseName: string) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'ADVANCE_EXERCISE',
        payload: { exerciseIndex, exerciseId, exerciseName },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Broadcast turn-based set completion
  const broadcastTurnSet = useCallback(
    (
      activeTurnUserId: string,
      activeTurnUserName: string,
      lastCompletedSet?: any,
      restTimerSeconds?: number
    ) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'TURN_SET',
        payload: { activeTurnUserId, activeTurnUserName, lastCompletedSet, restTimerSeconds },
        senderId: currentUserId,
        senderName: currentUserName,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  // Disconnect & cleanup
  const disconnect = useCallback(() => {
    if (unsubscribeRoomRef.current) {
      try {
        unsubscribeRoomRef.current();
      } catch {}
      unsubscribeRoomRef.current = null;
    }

    if (roomPin) {
      leaveJamRoomCloud(roomPin, currentUserId, role === 'host');
    }

    setConnectionStatus('disconnected');
    setRoomPin(null);
    setRole(null);
    setPartnerName(null);
    setPartnerUserId(null);
    AsyncStorage.removeItem(JAM_STORAGE_KEY).catch(() => {});
  }, [roomPin, currentUserId, role]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRoomRef.current) {
        try {
          unsubscribeRoomRef.current();
        } catch {}
      }
    };
  }, []);

  const simulatePartnerJoin = useCallback((name: string = 'Jordan (Partner)') => {
    setConnectionStatus('connected');
    setPartnerName(name);
    setPartnerUserId('simulated_partner_user');
    addToast(`${name} joined your Gym Jam`, name);
  }, [addToast]);

  return {
    connectionStatus,
    roomPin,
    role,
    partnerName,
    partnerUserId,
    liveToasts,
    isWebRTC: true,
    hostRoom,
    joinRoom,
    simulatePartnerJoin,
    broadcastLogSet,
    broadcastCoachLogSet,
    broadcastAddExercise,
    broadcastSwapExercise,
    broadcastStartTimer,
    broadcastSyncPresets,
    broadcastAdvanceExercise,
    broadcastTurnSet,
    disconnect,
  };
}
