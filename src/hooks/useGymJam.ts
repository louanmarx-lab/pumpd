import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  UpdateLifterSetMessage,
  AddLifterSetMessage,
  RemoveLifterSetMessage,
  SyncBenchmarksMessage,
  SessionExerciseTemplate,
} from '../types/gymjam';
import {
  JamRoomData,
  createJamRoomCloud,
  joinJamRoomCloud,
  subscribeToJamRoomCloud,
  broadcastJamEventCloud,
  leaveJamRoomCloud,
  syncJamRoomExercisesCloud,
  peekJamRoomCloud,
} from '../services/gymJamService';

const JAM_STORAGE_KEY = '@ripped_active_jam_session';

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
  onLifterSetUpdated?: (msg: UpdateLifterSetMessage) => void;
  onLifterSetAdded?: (msg: AddLifterSetMessage) => void;
  onLifterSetRemoved?: (msg: RemoveLifterSetMessage) => void;
  onBenchmarksSynced?: (msg: SyncBenchmarksMessage) => void;
  onSessionExercisesSynced?: (sessionExercises: Record<string, any[]>) => void;
  onWorkoutFinished?: (msg: { finishedByUserId: string; finishedByUserName: string; timestamp: number }) => void;
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
  onLifterSetUpdated,
  onLifterSetAdded,
  onLifterSetRemoved,
  onBenchmarksSynced,
  onSessionExercisesSynced,
  onWorkoutFinished,
}: UseGymJamProps) {
  const [connectionStatus, setConnectionStatus] = useState<JamConnectionStatus>('disconnected');
  const [roomPin, setRoomPin] = useState<string | null>(null);
  const [role, setRole] = useState<JamRole | null>(null);
  const roleRef = useRef<JamRole | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [liveToasts, setLiveToasts] = useState<JamLiveToast[]>([]);

  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  const lastProcessedEventIdRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef<string>(`client_${Date.now()}_${Math.floor(Math.random() * 100000)}`);

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
    onLifterSetUpdated,
    onLifterSetAdded,
    onLifterSetRemoved,
    onBenchmarksSynced,
    onSessionExercisesSynced,
    onWorkoutFinished,
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
      onLifterSetUpdated,
      onLifterSetAdded,
      onLifterSetRemoved,
      onBenchmarksSynced,
      onSessionExercisesSynced,
      onWorkoutFinished,
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
    onLifterSetUpdated,
    onLifterSetAdded,
    onLifterSetRemoved,
    onBenchmarksSynced,
    onSessionExercisesSynced,
    onWorkoutFinished,
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
      // 0. Synchronize full live session state (critical for recovery when phone was locked/asleep)
      if (room.sessionExercises) {
        callbacksRef.current.onSessionExercisesSynced?.(room.sessionExercises);
      }

      // 1. Connection status transition
      if (room.status === 'connected') {
        setConnectionStatus('connected');

        // Identify partner safely without stale closure issues
        const isHost = roleRef.current === 'host' || currentUserId === room.hostUserId;

        if (isHost) {
          // Current device is host -> Partner is guest
          if (room.guestUserId && room.guestUserId !== currentUserId) {
            const newGuestName = room.guestName || 'Gym Partner';
            setPartnerUserId(room.guestUserId);
            setPartnerName((prev) => {
              if (prev !== newGuestName) {
                addToast(`Partner ${newGuestName} joined the Jam!`, newGuestName);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              return newGuestName;
            });
          }
        } else {
          // Current device is guest -> Partner is host
          if (room.hostUserId && room.hostUserId !== currentUserId) {
            const newHostName = room.hostName || 'Gym Host';
            setPartnerUserId(room.hostUserId);
            setPartnerName(newHostName);
          }
        }
      } else if (room.status === 'waiting') {
        const isHost = roleRef.current === 'host' || currentUserId === room.hostUserId;
        if (isHost) {
          setConnectionStatus('connecting');
          setPartnerName(null);
          setPartnerUserId(null);
        }
      } else if (room.status === 'ended') {
        setConnectionStatus('disconnected');
        setPartnerName(null);
        setPartnerUserId(null);
        addToast('RIPPED BUDDY session was ended by the host', 'RIPPED BUDDY');
        callbacksRef.current.onWorkoutFinished?.({
          finishedByUserId: room.hostUserId,
          finishedByUserName: room.hostName,
          timestamp: room.updatedAt || Date.now(),
        });
      }

      // 2. Process real-time events (sets, turns, timer, exercise advances)
      const event = room.lastEvent;
      if (!event || event.id === lastProcessedEventIdRef.current) return;
      lastProcessedEventIdRef.current = event.id;

      // Ignore self-dispatched events
      if (event.senderClientId) {
        if (event.senderClientId === clientSessionIdRef.current) return;
      } else if (event.senderId === currentUserId) {
        return;
      }

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
            addToast(`🎯 It's YOUR turn to lift!`, 'RIPPED BUDDY');
          } else {
            addToast(`⏳ ${event.payload.activeTurnUserName}'s turn to lift`, 'RIPPED BUDDY');
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

        case 'UPDATE_LIFTER_SET': {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          callbacksRef.current.onLifterSetUpdated?.(event.payload);
          break;
        }

        case 'ADD_LIFTER_SET': {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          callbacksRef.current.onLifterSetAdded?.(event.payload);
          break;
        }

        case 'REMOVE_LIFTER_SET': {
          callbacksRef.current.onLifterSetRemoved?.(event.payload);
          break;
        }

        case 'SYNC_BENCHMARKS': {
          callbacksRef.current.onBenchmarksSynced?.(event.payload);
          break;
        }

        case 'FINISH_WORKOUT': {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          addToast(`Partner finished the workout!`, event.senderName);
          callbacksRef.current.onWorkoutFinished?.({
            finishedByUserId: event.senderId,
            finishedByUserName: event.senderName,
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

  // Keep roomPin in a ref for background / AppState recovery
  const roomPinRef = useRef<string | null>(null);
  useEffect(() => {
    roomPinRef.current = roomPin;
  }, [roomPin]);

  // AppState Recovery: When user locks phone or switches apps and reopens,
  // immediately pull fresh room data from Firestore to guarantee 100% sync!
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && roomPinRef.current) {
        try {
          const result = await peekJamRoomCloud(roomPinRef.current);
          if (result.success && result.data) {
            handleRoomSnapshot(result.data);
          }
        } catch (err) {
          console.warn('[GymJam] Error re-syncing room on app resume:', err);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [handleRoomSnapshot]);

  // Synchronize full live session exercises to Firestore
  const syncSessionExercises = useCallback(
    (exercisesMap: Record<string, any[]>) => {
      const activePin = roomPinRef.current || roomPin;
      if (!activePin) return;
      syncJamRoomExercisesCloud(activePin, exercisesMap);
    },
    [roomPin]
  );

  // Host a new session: generates clean PIN PUMP-XX and creates Firestore room
  const hostRoom = useCallback(
    async (initialSyncData: {
      routineName: string;
      exerciseIds: string[];
      sessionExercisesTemplate?: SessionExerciseTemplate[];
    }) => {
      try {
        disconnect();

        // 2-digit clean code e.g. RIP-42
        const pinNumber = Math.floor(10 + Math.random() * 90);
        const pin = `RIP-${pinNumber}`;

        setRoomPin(pin);
        setRole('host');
        roleRef.current = 'host';
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
        // Support either raw number "42", "RIP-42", or legacy "PUMP-42"
        const normalizedPin = clean.startsWith('RIP-')
          ? clean
          : clean.startsWith('PUMP-')
          ? clean
          : `RIP-${clean.replace(/\D/g, '')}`;

        setRoomPin(normalizedPin);
        setRole('guest');
        roleRef.current = 'guest';
        setConnectionStatus('connecting');

        const result = await joinJamRoomCloud(normalizedPin, {
          userId: currentUserId,
          displayName: currentUserName,
        });

        if (!result.success || !result.data) {
          setConnectionStatus('error');
          return false;
        }

        const effectivePin = result.resolvedPin || normalizedPin;
        setRoomPin(effectivePin);
        const room = result.data;
        setPartnerName(room.hostName);
        setPartnerUserId(room.hostUserId);
        setConnectionStatus('connected');
        addToast(`Joined RIPPED BUDDY room with ${room.hostName}!`, room.hostName);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Synchronize initial routine queue with host
        callbacksRef.current.onSyncSessionReceived?.({
          type: 'SYNC_SESSION',
          hostUserId: room.hostUserId,
          hostUserName: room.hostName,
          hostRole: room.hostRole,
          routineName: room.routineName,
          exerciseIds: room.exerciseIds,
          sessionExercises: room.sessionExercisesTemplate,
          timestamp: room.createdAt,
        });

        // Subscribe to real-time room updates
        const unsub = subscribeToJamRoomCloud(effectivePin, handleRoomSnapshot, (err) => {
          console.warn('[GymJam] Error listening to guest room:', err);
        });
        unsubscribeRoomRef.current = unsub;

        await AsyncStorage.setItem(
          JAM_STORAGE_KEY,
          JSON.stringify({
            roomPin: effectivePin,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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
        senderClientId: clientSessionIdRef.current,
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

    const isHost = roleRef.current === 'host' || role === 'host';
    if (roomPin) {
      leaveJamRoomCloud(roomPin, currentUserId, isHost);
    }

    setConnectionStatus('disconnected');
    setRoomPin(null);
    setRole(null);
    roleRef.current = null;
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
    addToast(`${name} joined your GymBuddy`, name);
  }, [addToast]);

  const broadcastUpdateLifterSet = useCallback(
    (targetUserId: string, exerciseIndex: number, setIndex: number, field: string, value: any) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'UPDATE_LIFTER_SET',
        payload: {
          targetUserId,
          exerciseIndex,
          setIndex,
          field,
          value,
          updatedByUserId: currentUserId,
          updatedByUserName: currentUserName,
          timestamp: Date.now(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        senderClientId: clientSessionIdRef.current,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  const broadcastAddLifterSet = useCallback(
    (targetUserId: string, exerciseIndex: number, newSet: any) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'ADD_LIFTER_SET',
        payload: {
          targetUserId,
          exerciseIndex,
          newSet,
          addedByUserId: currentUserId,
          timestamp: Date.now(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        senderClientId: clientSessionIdRef.current,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  const broadcastRemoveLifterSet = useCallback(
    (targetUserId: string, exerciseIndex: number, setIndex: number) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'REMOVE_LIFTER_SET',
        payload: {
          targetUserId,
          exerciseIndex,
          setIndex,
          removedByUserId: currentUserId,
          timestamp: Date.now(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        senderClientId: clientSessionIdRef.current,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  const broadcastSyncBenchmarks = useCallback(
    (benchmarks: Record<string, any>) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'SYNC_BENCHMARKS',
        payload: {
          userId: currentUserId,
          userName: currentUserName,
          benchmarks,
          timestamp: Date.now(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        senderClientId: clientSessionIdRef.current,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

  const broadcastFinishWorkout = useCallback(
    (finishedByUserId: string, finishedByUserName: string) => {
      if (!roomPin) return;
      broadcastJamEventCloud(roomPin, {
        type: 'FINISH_WORKOUT',
        payload: {
          finishedByUserId,
          finishedByUserName,
          timestamp: Date.now(),
        },
        senderId: currentUserId,
        senderName: currentUserName,
        senderClientId: clientSessionIdRef.current,
      });
    },
    [roomPin, currentUserId, currentUserName]
  );

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
    broadcastUpdateLifterSet,
    broadcastAddLifterSet,
    broadcastRemoveLifterSet,
    broadcastSyncBenchmarks,
    broadcastFinishWorkout,
    syncSessionExercises,
    disconnect,
  };
}
