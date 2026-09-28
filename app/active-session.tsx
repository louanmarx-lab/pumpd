import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { SetType, SetLog, LoggedExercise, Exercise, MuscleGroup } from '../src/types';
import { calculate1RM, getExerciseHistory } from '../src/utils/fitness';
import { useGymJam } from '../src/hooks/useGymJam';
import { GymJamLobbyModal } from '../src/components/GymJamLobbyModal';
import { WorkoutReceiptModal } from '../src/components/WorkoutReceiptModal';
import { WorkoutReceiptData, SessionExerciseTemplate } from '../src/types/gymjam';
import { useWorkoutTimer, formatDuration } from '../src/hooks/useWorkoutTimer';

const SET_TYPES: SetType[] = ['Normal', 'Warmup', 'Drop', 'Failure'];
const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Calves',
  'Abs',
];

export default function ActiveSessionScreen() {
  // Keep screen awake during workout session
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    splitId?: string;
    routineName?: string;
    routineTitle?: string;
    exerciseIds?: string;
    clientId?: string;
    clientName?: string;
    startedAt?: string;
    joinRoomPin?: string;
  }>();

  const {
    currentUser,
    activeUser,
    activeWorkspace,
    userRole,
    coachProfile,
    linkedCoach,
    clients,
    exercises,
    workoutLogs,
    saveWorkoutLog,
    logClientWorkout,
    addExercise,
  } = useUserWorkspace();

  const activeClient = params.clientId ? clients.find((c) => c.id === params.clientId) : null;
  const routineTitle =
    params.routineTitle ||
    params.routineName ||
    (params.clientName
      ? `${params.clientName}'s Training`
      : activeClient
      ? `${activeClient.name}'s Training`
      : 'Gym Workout Session');
  const initialIds: string[] = params.exerciseIds ? JSON.parse(params.exerciseIds) : ['ex_1', 'ex_2'];

  const insets = useSafeAreaInsets();

  const [sessionExerciseIds, setSessionExerciseIds] = useState<string[]>(initialIds);
  const [currentRoutineTitle, setCurrentRoutineTitle] = useState<string>(routineTitle);
  const [viewingLifterId, setViewingLifterId] = useState<string>(activeUser.id);
  const [partnerBenchmarks, setPartnerBenchmarks] = useState<
    Record<
      string,
      {
        bestWorkingSet?: { weightKg: number; reps: number; date?: string };
        maxRepsAtWeight: number;
        estimated1RM: number;
      }
    >
  >({});

  // Helper to build initial exercises for a specific user using their own benchmark history
  const buildInitialExercisesForUser = (
    userId: string,
    ids: string[] = sessionExerciseIds,
    templateExercises?: SessionExerciseTemplate[]
  ): LoggedExercise[] => {
    // When coaching a client, prioritize client's workout logs to populate ghosted weights & reps
    const targetClientId = params.clientId;
    const targetLinkedUserId = activeClient?.linkedUserId;
    const clientLogs = targetClientId
      ? workoutLogs.filter(
          (l) =>
            l.userId === targetClientId ||
            (targetLinkedUserId && l.userId === targetLinkedUserId)
        )
      : [];
    const userLogs =
      clientLogs.length > 0
        ? clientLogs
        : workoutLogs.filter((l) => l.userId === userId);

    return ids.map((id) => {
      const exDef = exercises.find((e) => e.id === id);
      const history = getExerciseHistory(userLogs, id);

      let defaultSets: SetLog[] = [];

      // If a synchronized session template is provided, match its exact set structure
      if (templateExercises && templateExercises.length > 0) {
        const tpl = templateExercises.find((t) => t.exerciseId === id);
        if (tpl && tpl.sets && tpl.sets.length > 0) {
          defaultSets = tpl.sets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type || 'Normal',
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
        }
      }

      // If no template matched, initialize using history, guaranteeing minimum 3 sets
      if (defaultSets.length === 0) {
        if (history.previousSessionSets && history.previousSessionSets.length >= 3) {
          defaultSets = history.previousSessionSets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type,
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
        } else if (history.previousSessionSets && history.previousSessionSets.length > 0) {
          defaultSets = history.previousSessionSets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type,
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
          while (defaultSets.length < 3) {
            defaultSets.push({
              setNumber: defaultSets.length + 1,
              type: 'Normal',
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            });
          }
        } else {
          defaultSets = [
            { setNumber: 1, type: 'Warmup', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 2, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 3, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
          ];
        }
      }

      return {
        exerciseId: id,
        exerciseName: exDef ? exDef.name : 'Exercise',
        sets: defaultSets,
      };
    });
  };

  // Independent workout session state per user: { [userId]: LoggedExercise[] }
  const [userExercisesMap, setUserExercisesMap] = useState<Record<string, LoggedExercise[]>>({});
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);

  // Add Exercise & Create Custom Exercise state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  // Session timestamp identifier to ensure fresh start and prevent cross-session timer leaks
  const sessionStartedAt = useMemo(() => {
    if (params.startedAt && !isNaN(Number(params.startedAt))) {
      return Number(params.startedAt);
    }
    return Date.now();
  }, [params.startedAt]);

  // Background-resilient workout timer (timestamp-delta architecture)
  const workoutTimer = useWorkoutTimer({
    autoStart: true,
    sessionId: sessionStartedAt,
    storageKey: `@ripped_active_workout_timer_${params.splitId || 'session'}`,
    maxStaleHours: 3,
  });
  const secondsElapsed = workoutTimer.elapsedSeconds;
  const isTimerRunning = workoutTimer.isRunning;
  const { togglePauseResume: toggleWorkoutTimer, stop: stopWorkoutTimer, reset: resetWorkoutTimer } = workoutTimer;

  const handleExitWorkout = () => {
    Alert.alert(
      'Leave Workout?',
      'Are you sure you want to exit? Your session timer and unsaved sets will be discarded.',
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Leave & Reset',
          style: 'destructive',
          onPress: () => {
            stopWorkoutTimer();
            router.back();
          },
        },
      ]
    );
  };

  // Weight display unit preference (kg / lbs)
  const weightUnit = activeUser.weightUnit || 'kg';

  // Gym Jam P2P State & Handlers
  const [showGymJamLobby, setShowGymJamLobby] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);
  const [partnerLatestSet, setPartnerLatestSet] = useState<{
    exerciseName?: string;
    setIndex: number;
    weight: number;
    reps: number;
    rpe?: number;
  } | null>(null);

  // Workout Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<WorkoutReceiptData | null>(null);
  const handleFinishWorkoutRef = useRef<((isRemote?: boolean, remoteName?: string) => void) | null>(null);

  const gymJam = useGymJam({
    currentUserId: activeUser.id,
    currentUserName: activeUser.displayName,
    userRole,
    onSyncSessionReceived: (msg) => {
      // Synchronize routine title and exercises if guest
      if (msg.routineName) {
        setCurrentRoutineTitle(msg.routineName);
      }
      if (msg.exerciseIds && msg.exerciseIds.length > 0) {
        setSessionExerciseIds(msg.exerciseIds);
        setUserExercisesMap((prev) => {
          const next = { ...prev };
          const guestExercises = buildInitialExercisesForUser(
            activeUser.id,
            msg.exerciseIds,
            msg.sessionExercises
          );
          next[activeUser.id] = guestExercises;

          // Partner is host: mirror exact template sets for host
          const hostId = gymJam.partnerUserId || 'host';
          next[hostId] = guestExercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: ex.sets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          }));
          return next;
        });
      }
    },
    onPartnerLoggedSet: (msg) => {
      const exDef = exercises.find((e) => e.id === msg.exerciseId);
      setPartnerLatestSet({
        exerciseName: exDef ? exDef.name : undefined,
        setIndex: msg.setIndex,
        weight: msg.weight,
        reps: msg.reps,
        rpe: msg.rpe,
      });
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const partnerList = next[msg.userId] ? [...next[msg.userId]] : buildInitialExercisesForUser(msg.userId, sessionExerciseIds);
        const exIdx = partnerList.findIndex((e) => e.exerciseId === msg.exerciseId);
        if (exIdx !== -1) {
          const ex = { ...partnerList[exIdx] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: msg.weight,
              reps: msg.reps,
              rpe: msg.rpe,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            weightKg: msg.weight,
            reps: msg.reps,
            rpe: msg.rpe,
            isCompleted: true,
          };
          ex.sets = sets;
          partnerList[exIdx] = ex;
          next[msg.userId] = partnerList;
        }
        return next;
      });
    },
    onCoachLoggedSet: (msg) => {
      // Remote-control logging from coach: client screen updates instantly with zero typing!
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const myExercises = next[activeUser.id] ? [...next[activeUser.id]] : buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
        const exIdx = myExercises.findIndex((e) => e.exerciseId === msg.exerciseId);
        if (exIdx !== -1) {
          const ex = { ...myExercises[exIdx] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: msg.weight,
              reps: msg.reps,
              rpe: msg.rpe,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            weightKg: msg.weight,
            reps: msg.reps,
            rpe: msg.rpe,
            isCompleted: true,
          };
          ex.sets = sets;
          myExercises[exIdx] = ex;
          next[activeUser.id] = myExercises;
        }
        return next;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onExerciseAdded: (msg) => {
      const exDef = exercises.find((e) => e.id === msg.exerciseId);
      if (exDef) {
        handleAddExerciseToSession(exDef, false);
      }
    },
    onExerciseSwapped: (msg) => {
      const newDef = exercises.find((e) => e.id === msg.newExerciseId);
      if (newDef) {
        setSessionExerciseIds((prev) => {
          const next = [...prev];
          if (next[msg.exerciseIndex] !== undefined) {
            next[msg.exerciseIndex] = newDef.id;
          }
          return next;
        });
        setUserExercisesMap((prev) => {
          const nextMap = { ...prev };
          Object.keys(nextMap).forEach((uId) => {
            const list = [...nextMap[uId]];
            if (list[msg.exerciseIndex]) {
              const prevSets = list[msg.exerciseIndex].sets;
              list[msg.exerciseIndex] = {
                exerciseId: newDef.id,
                exerciseName: newDef.name,
                sets: prevSets.map((s, idx) => ({
                  setNumber: idx + 1,
                  type: s.type,
                  weightKg: 0,
                  reps: 0,
                  isCompleted: false,
                })),
              };
              nextMap[uId] = list;
            }
          });
          return nextMap;
        });
      }
    },
    onAdvanceExercise: (msg) => {
      setActiveExerciseIndex(msg.exerciseIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onTurnSet: (msg) => {
      if (msg.lastCompletedSet) {
        const exDef = exercises.find((e) => e.id === msg.lastCompletedSet?.exerciseId);
        setPartnerLatestSet({
          exerciseName: exDef ? exDef.name : undefined,
          setIndex: msg.lastCompletedSet.setIndex,
          weight: msg.lastCompletedSet.weight,
          reps: msg.lastCompletedSet.reps,
          rpe: msg.lastCompletedSet.rpe,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onTimerSync: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    onBenchmarksSynced: (msg) => {
      if (msg.benchmarks) {
        setPartnerBenchmarks((prev) => ({ ...prev, ...msg.benchmarks }));
      }
    },
    onLifterSetUpdated: (msg) => {
      let completedExName: string | undefined;
      let completedWeight = 0;
      let completedReps = 0;
      let completedRpe: number | undefined;

      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const userList = next[msg.targetUserId]
          ? [...next[msg.targetUserId]]
          : buildInitialExercisesForUser(msg.targetUserId, sessionExerciseIds);
        if (userList[msg.exerciseIndex]) {
          const ex = { ...userList[msg.exerciseIndex] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            [msg.field]: msg.value,
          };
          ex.sets = sets.map((s, i) => ({ ...s, setNumber: i + 1 }));
          userList[msg.exerciseIndex] = ex;
          next[msg.targetUserId] = userList;

          if (msg.field === 'isCompleted' && msg.value === true) {
            completedExName = ex.exerciseName;
            completedWeight = sets[msg.setIndex].weightKg;
            completedReps = sets[msg.setIndex].reps;
            completedRpe = sets[msg.setIndex].rpe;
          }
        }
        return next;
      });

      if (msg.field === 'isCompleted' && msg.value === true) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (completedExName) {
          setPartnerLatestSet({
            exerciseName: completedExName,
            setIndex: msg.setIndex,
            weight: completedWeight,
            reps: completedReps,
            rpe: completedRpe,
          });
        }
      }
    },
    onLifterSetAdded: (msg) => {
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const lifterIds = Array.from(
          new Set([
            activeUser.id,
            ...Object.keys(prev),
            ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
          ])
        );
        lifterIds.forEach((uId) => {
          const userList = next[uId]
            ? [...next[uId]]
            : buildInitialExercisesForUser(uId, sessionExerciseIds);
          if (userList[msg.exerciseIndex]) {
            const ex = { ...userList[msg.exerciseIndex] };
            const lastSet = ex.sets[ex.sets.length - 1];
            const newSet: SetLog = {
              setNumber: ex.sets.length + 1,
              type: msg.newSet?.type || 'Normal',
              weightKg: uId === msg.targetUserId ? (msg.newSet?.weightKg || 0) : (lastSet?.weightKg || 0),
              reps: uId === msg.targetUserId ? (msg.newSet?.reps || 0) : (lastSet?.reps || 0),
              isCompleted: false,
            };
            ex.sets = [...ex.sets, newSet].map((s, idx) => ({ ...s, setNumber: idx + 1 }));
            userList[msg.exerciseIndex] = ex;
            next[uId] = userList;
          }
        });
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onLifterSetRemoved: (msg) => {
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const lifterIds = Array.from(
          new Set([
            activeUser.id,
            ...Object.keys(prev),
            ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
          ])
        );
        lifterIds.forEach((uId) => {
          const userList = next[uId]
            ? [...next[uId]]
            : buildInitialExercisesForUser(uId, sessionExerciseIds);
          if (userList[msg.exerciseIndex] && userList[msg.exerciseIndex].sets.length > 1) {
            const ex = { ...userList[msg.exerciseIndex] };
            const filtered = ex.sets.filter((_, idx) => idx !== msg.setIndex);
            ex.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
            userList[msg.exerciseIndex] = ex;
            next[uId] = userList;
          }
        });
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onSessionExercisesSynced: (syncedMap) => {
      if (!syncedMap || Object.keys(syncedMap).length === 0) return;
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        Object.entries(syncedMap).forEach(([lifterId, incomingExercises]) => {
          if (!Array.isArray(incomingExercises) || incomingExercises.length === 0) return;
          // For partner or other lifters, always adopt the newest synced exercises directly
          if (lifterId !== activeUser.id) {
            next[lifterId] = incomingExercises as LoggedExercise[];
            hasChanges = true;
          } else {
            // For own exercises: update completed sets from remote coach/partner while preserving active inputs
            const myCurrent = next[activeUser.id];
            if (!myCurrent || myCurrent.length === 0) {
              next[activeUser.id] = incomingExercises as LoggedExercise[];
              hasChanges = true;
            } else {
              const merged = myCurrent.map((curEx, exIdx) => {
                const incomingEx = (incomingExercises as LoggedExercise[])[exIdx];
                if (!incomingEx) return curEx;
                return {
                  ...curEx,
                  sets: curEx.sets.map((curSet, sIdx) => {
                    const incomingSet = incomingEx.sets?.[sIdx];
                    if (!incomingSet) return curSet;
                    if (incomingSet.isCompleted && !curSet.isCompleted) {
                      hasChanges = true;
                      return { ...curSet, ...incomingSet };
                    }
                    return curSet;
                  }),
                };
              });
              if (hasChanges) {
                next[activeUser.id] = merged;
              }
            }
          }
        });
        return hasChanges ? next : prev;
      });
    },
    onWorkoutFinished: (msg) => {
      if (msg.finishedByUserId !== activeUser.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleFinishWorkoutRef.current?.(true, msg.finishedByUserName);
      }
    },
  });

  // Auto-connect seamlessly if launched with joinRoomPin (from the direct Join Buddy modal)
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    if (params.joinRoomPin && !hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      gymJam.joinRoom(params.joinRoomPin);
    }
  }, [params.joinRoomPin, gymJam.joinRoom]);

  // Lifters currently participating in this workout session
  const sessionLifters = useMemo(() => {
    const list: { id: string; name: string }[] = [
      { id: activeUser.id, name: activeUser.displayName },
    ];
    if (
      gymJam.connectionStatus === 'connected' &&
      gymJam.partnerUserId &&
      gymJam.partnerUserId !== activeUser.id
    ) {
      list.push({
        id: gymJam.partnerUserId,
        name: gymJam.partnerName || 'Partner',
      });
    }
    // Deduplicate by ID to ensure distinct lifters
    const seen = new Set<string>();
    return list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [
    activeUser.id,
    activeUser.displayName,
    gymJam.connectionStatus,
    gymJam.partnerUserId,
    gymJam.partnerName,
  ]);

  // Benchmark Handshake: When connected to Jam, broadcast own benchmarks for session exercises
  useEffect(() => {
    if (gymJam.connectionStatus === 'connected') {
      const myLogs = workoutLogs.filter((l) => l.userId === activeUser.id);
      const myBenchmarks: Record<string, any> = {};
      sessionExerciseIds.forEach((exId) => {
        const hist = getExerciseHistory(myLogs, exId);
        myBenchmarks[exId] = {
          bestWorkingSet: hist.bestWorkingSet,
          maxRepsAtWeight: hist.maxRepsAtWeight,
          estimated1RM: hist.estimated1RM,
        };
      });
      gymJam.broadcastSyncBenchmarks(myBenchmarks);
    }
  }, [gymJam.connectionStatus, sessionExerciseIds, workoutLogs, activeUser.id]);

  // Initialize independent session exercise cards for active user
  useEffect(() => {
    setUserExercisesMap((prev) => ({
      ...prev,
      [activeUser.id]: buildInitialExercisesForUser(activeUser.id, sessionExerciseIds),
    }));
  }, [activeUser.id, sessionExerciseIds]);

  // When partner joins, initialize partner's exercise sets to match active user's structure 100%
  useEffect(() => {
    if (
      gymJam.connectionStatus === 'connected' &&
      gymJam.partnerUserId &&
      gymJam.partnerUserId !== activeUser.id
    ) {
      const pId = gymJam.partnerUserId;
      setUserExercisesMap((prev) => {
        if (!prev[pId]) {
          const myExercises =
            prev[activeUser.id] ||
            buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
          const partnerExercises: LoggedExercise[] = myExercises.map((myEx) => ({
            exerciseId: myEx.exerciseId,
            exerciseName: myEx.exerciseName,
            sets: myEx.sets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          }));
          return {
            ...prev,
            [pId]: partnerExercises,
          };
        }
        return prev;
      });
    }
  }, [gymJam.connectionStatus, gymJam.partnerUserId, sessionExerciseIds, activeUser.id]);

  // Get current viewed lifter's exercises & name (Independent Viewing: Herman viewing Lou-an does not switch Lou-an's phone!)
  const currentSessionExercises: LoggedExercise[] =
    userExercisesMap[viewingLifterId] || buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds);

  const viewingLifterName =
    sessionLifters.find((l) => l.id === viewingLifterId)?.name ||
    (viewingLifterId === activeUser.id ? activeUser.displayName : gymJam.partnerName || 'Lifter');

  const getCompletedCountForUser = (userId: string): number => {
    const list = userExercisesMap[userId] || [];
    return list.reduce((acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length, 0);
  };

  // Two-Way Live Set Mutators: updates viewingLifterId locally AND broadcasts over Jam to partner phone
  const handleUpdateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof SetLog,
    value: any
  ) => {
    let nextMapForSync: Record<string, LoggedExercise[]> | null = null;
    setUserExercisesMap((prev) => {
      const currentList = prev[viewingLifterId]
        ? [...prev[viewingLifterId]]
        : [...buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds)];
      const ex = { ...currentList[exIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      ex.sets = sets;
      currentList[exIndex] = ex;
      const next = { ...prev, [viewingLifterId]: currentList };
      nextMapForSync = next;
      return next;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastUpdateLifterSet(viewingLifterId, exIndex, setIndex, field as string, value);
      if (nextMapForSync) {
        gymJam.syncSessionExercises(nextMapForSync);
      }
    }
  };

  const handleToggleComplete = (exIndex: number, setIndex: number) => {
    const currentEx = currentSessionExercises[exIndex];
    const currentSet = currentEx?.sets[setIndex];
    if (!currentEx || !currentSet) return;

    const currentCompleted = currentSet.isCompleted || false;
    const newCompleted = !currentCompleted;

    if (newCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Auto-commit ghosted weights & reps if inputs were left blank or 0
      const lifterLogs = workoutLogs.filter((l) => l.userId === viewingLifterId);
      const hist = getExerciseHistory(lifterLogs, currentEx.exerciseId);
      const prevSet = hist.previousSessionSets?.[setIndex];

      let committedWeight = currentSet.weightKg;
      let committedReps = currentSet.reps;

      if (committedWeight <= 0) {
        committedWeight = prevSet?.weightKg && prevSet.weightKg > 0 ? prevSet.weightKg : 20;
        handleUpdateSet(exIndex, setIndex, 'weightKg', committedWeight);
      }
      if (committedReps <= 0) {
        committedReps = prevSet?.reps && prevSet.reps > 0 ? prevSet.reps : 8;
        handleUpdateSet(exIndex, setIndex, 'reps', committedReps);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    handleUpdateSet(exIndex, setIndex, 'isCompleted', newCompleted);
  };

  const handleAdvanceExercise = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= currentSessionExercises.length) return;
    Haptics.selectionAsync();
    setActiveExerciseIndex(targetIndex);
    const targetEx = currentSessionExercises[targetIndex];
    if (gymJam.connectionStatus === 'connected' && targetEx) {
      gymJam.broadcastAdvanceExercise(targetIndex, targetEx.exerciseId, targetEx.exerciseName);
    }
  };

  const handleAddSet = (exIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // In Co-Op, add set across all lifters so set counts and numbers remain 100% mirrored
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const list = nextMap[uId]
          ? [...nextMap[uId]]
          : [...buildInitialExercisesForUser(uId, sessionExerciseIds)];
        if (list[exIndex]) {
          const targetEx = { ...list[exIndex] };
          const lastSet = targetEx.sets[targetEx.sets.length - 1];
          const newSet: SetLog = {
            setNumber: targetEx.sets.length + 1,
            type: 'Normal',
            weightKg: lastSet ? lastSet.weightKg : 50,
            reps: lastSet ? lastSet.reps : 8,
            isCompleted: false,
          };
          targetEx.sets = [...targetEx.sets, newSet].map((s, idx) => ({ ...s, setNumber: idx + 1 }));
          list[exIndex] = targetEx;
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastAddLifterSet(viewingLifterId, exIndex, {
        setNumber: 0,
        type: 'Normal',
        weightKg: 0,
        reps: 0,
        isCompleted: false,
      });
    }
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentList =
      userExercisesMap[viewingLifterId] || buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds);
    if (currentList[exIndex]?.sets.length <= 1) return;

    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const list = nextMap[uId]
          ? [...nextMap[uId]]
          : [...buildInitialExercisesForUser(uId, sessionExerciseIds)];
        if (list[exIndex] && list[exIndex].sets.length > 1) {
          const targetEx = { ...list[exIndex] };
          const filtered = targetEx.sets.filter((_, idx) => idx !== setIndex);
          targetEx.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
          list[exIndex] = targetEx;
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastRemoveLifterSet(viewingLifterId, exIndex, setIndex);
    }
  };

  const handleSwapExercise = (newEx: Exercise) => {
    if (swapTargetIndex === null) return;
    const oldEx = currentSessionExercises[swapTargetIndex];
    if (gymJam.connectionStatus === 'connected' && oldEx) {
      gymJam.broadcastSwapExercise(swapTargetIndex, oldEx.exerciseId, newEx.id, newEx.name);
    }
    setSessionExerciseIds((prev) => {
      const next = [...prev];
      if (next[swapTargetIndex] !== undefined) {
        next[swapTargetIndex] = newEx.id;
      }
      return next;
    });
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      Object.keys(nextMap).forEach((uId) => {
        const list = [...nextMap[uId]];
        if (list[swapTargetIndex]) {
          const prevSets = list[swapTargetIndex].sets;
          list[swapTargetIndex] = {
            exerciseId: newEx.id,
            exerciseName: newEx.name,
            sets: prevSets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          };
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });
    setShowSwapModal(false);
    setSwapTargetIndex(null);
  };

  const handleAddExerciseToSession = (ex: Exercise, broadcast: boolean = true) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (broadcast && gymJam.connectionStatus === 'connected') {
      gymJam.broadcastAddExercise(ex.id, ex.name);
    }
    setSessionExerciseIds((prev) => [...prev, ex.id]);
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const currentList = nextMap[uId]
          ? [...nextMap[uId]]
          : buildInitialExercisesForUser(uId);
        const newLoggedEx: LoggedExercise = {
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [
            { setNumber: 1, type: 'Warmup', weightKg: 20, reps: 10, isCompleted: false },
            { setNumber: 2, type: 'Normal', weightKg: 40, reps: 8, isCompleted: false },
            { setNumber: 3, type: 'Normal', weightKg: 50, reps: 8, isCompleted: false },
          ],
        };
        nextMap[uId] = [...currentList, newLoggedEx];
      });
      return nextMap;
    });
    setShowAddExerciseModal(false);
    setExerciseSearchQuery('');
  };

  const handleCreateAndAddExercise = () => {
    if (!newExName.trim()) {
      Alert.alert('Required', 'Please enter an exercise name.');
      return;
    }
    const created = addExercise({
      workspaceId: activeWorkspace.id,
      name: newExName.trim(),
      muscleGroup: newExMuscle,
      equipment: newExEquipment.trim() || 'Custom',
    });
    setNewExName('');
    setNewExEquipment('Barbell');
    setShowCreateExerciseModal(false);

    if (swapTargetIndex !== null) {
      handleSwapExercise(created);
    } else {
      handleAddExerciseToSession(created);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFinishWorkout = (isRemoteTriggered: boolean = false, remoteFinishedByName?: string) => {
    const myExList =
      userExercisesMap[activeUser.id] ||
      buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
    const completedSetsCount = myExList.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
      0
    );

    if (completedSetsCount === 0 && !isRemoteTriggered) {
      Alert.alert(
        'Empty Session',
        'Please complete at least one set for your account before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    // If finished locally and Gym Jam is connected, broadcast finish to partner phone!
    if (!isRemoteTriggered && gymJam.connectionStatus === 'connected') {
      gymJam.broadcastFinishWorkout(activeUser.id, activeUser.displayName);
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const finalDurationSeconds = stopWorkoutTimer();

    // Save workout log: if coaching a client, associate log with the client profile
    if (completedSetsCount > 0) {
      if (params.clientId) {
        logClientWorkout(params.clientId, {
          userId: activeClient?.linkedUserId || params.clientId,
          workspaceId: activeWorkspace.id,
          splitId: params.splitId || 'split_custom',
          routineName: currentRoutineTitle,
          date: todayDate,
          timestamp: Date.now(),
          durationSeconds: finalDurationSeconds,
          exercises: myExList,
        });
      } else {
        saveWorkoutLog({
          userId: activeUser.id,
          workspaceId: activeWorkspace.id,
          splitId: params.splitId || 'split_custom',
          routineName: currentRoutineTitle,
          date: todayDate,
          timestamp: Date.now(),
          durationSeconds: finalDurationSeconds,
          exercises: myExList,
        });
      }
    }

    // Build Workout Receipt Data for the active lifter
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    let bestLift: WorkoutReceiptData['bestLift'] = null;
    let highest1RM = 0;

    const exercisesSummary: WorkoutReceiptData['exercisesSummary'] = [];

    myExList.forEach((ex) => {
      const completedSets = ex.sets.filter((s) => s.isCompleted);
      if (completedSets.length > 0) {
        let topWeight = 0;
        let topReps = 0;
        completedSets.forEach((s) => {
          totalVolume += (s.weightKg || 0) * (s.reps || 0);
          totalSets += 1;
          totalReps += s.reps || 0;

          const est1RM = calculate1RM(s.weightKg, s.reps);
          if (est1RM > highest1RM) {
            highest1RM = est1RM;
            bestLift = {
              exerciseName: ex.exerciseName,
              weightKg: s.weightKg,
              reps: s.reps,
            };
          }

          if (s.weightKg > topWeight) {
            topWeight = s.weightKg;
            topReps = s.reps;
          }
        });

        exercisesSummary.push({
          exerciseName: ex.exerciseName,
          completedSetsCount: completedSets.length,
          topSetWeight: topWeight,
          topSetReps: topReps,
        });
      }
    });

    setReceiptData({
      id: `RIP-${Math.floor(100000 + Math.random() * 900000)}`,
      date: todayDate,
      athleteName: params.clientName || activeClient?.name || activeUser.displayName,
      routineName: currentRoutineTitle,
      durationSeconds: finalDurationSeconds,
      totalVolumeKg: Math.round(totalVolume),
      totalSets,
      totalReps,
      bestLift,
      gymJamBuddy:
        gymJam.partnerName || remoteFinishedByName
          ? {
              name: remoteFinishedByName || gymJam.partnerName || 'Workout Buddy',
              roomPin: gymJam.roomPin || '',
            }
          : null,
      coachAttribution:
        userRole === 'coach'
          ? {
              name: coachProfile.name,
              businessName: coachProfile.businessName,
              instagramHandle: coachProfile.instagramHandle,
            }
          : linkedCoach
          ? {
              name: linkedCoach.name,
              businessName: linkedCoach.businessName,
              instagramHandle: linkedCoach.instagramHandle,
            }
          : null,
      exercisesSummary,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowReceiptModal(true);
  };

  handleFinishWorkoutRef.current = handleFinishWorkout;

  return (
    <View
      className="flex-1 bg-dark-bg"
      style={{
        paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 32 : 0),
        paddingBottom: insets.bottom,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header Bar */}
        <View className="bg-dark-card border-b border-dark-border px-3 py-2 flex-row items-center justify-between shadow-md">
          {/* Left: Close button and Routine Title */}
          <View className="flex-row items-center space-x-2 flex-1 mr-3">
            <TouchableOpacity onPress={handleExitWorkout} className="p-1">
              <Ionicons name="close" size={24} color="#A1A1AA" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-base font-bold text-white" numberOfLines={1}>
                {currentRoutineTitle}
              </Text>
            </View>
          </View>

          {/* Right: Jam + Timer Stack, and Finish Button */}
          <View className="flex-row items-center space-x-2.5">
            {/* Jam & Timer Stack (Timer directly under Jam) */}
            <View className="items-end justify-center">
              {/* Gym Jam Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowGymJamLobby(true)}
                className={`flex-row items-center px-2.5 py-1 rounded-lg border mb-1 ${
                  gymJam.connectionStatus === 'connected'
                    ? 'bg-emerald-500/15 border-emerald-500/60'
                    : gymJam.connectionStatus === 'connecting'
                    ? 'bg-amber-500/15 border-amber-500/60'
                    : 'bg-zinc-800/90 border-zinc-700'
                }`}
              >
                <View
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    gymJam.connectionStatus === 'connected'
                      ? 'bg-emerald-400'
                      : gymJam.connectionStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                />
                <Text
                  className={`text-[11px] font-black ${
                    gymJam.connectionStatus === 'connected'
                      ? 'text-emerald-400'
                      : gymJam.connectionStatus === 'connecting'
                      ? 'text-amber-400'
                      : 'text-cyan-300'
                  }`}
                >
                  {gymJam.connectionStatus === 'connected'
                    ? gymJam.partnerName
                      ? gymJam.partnerName.split(' ')[0]
                      : gymJam.roomPin
                    : 'GymBuddy'}
                </Text>
              </TouchableOpacity>

              {/* Total Workout Timer Badge directly under Jam */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleWorkoutTimer();
                }}
                className={`flex-row items-center px-2 py-0.5 rounded-md border ${
                  isTimerRunning
                    ? 'bg-cyan-950/50 border-cyan-500/40'
                    : 'bg-amber-950/50 border-amber-500/50'
                }`}
              >
                <Ionicons
                  name={isTimerRunning ? 'stopwatch-outline' : 'play'}
                  size={11}
                  color={isTimerRunning ? '#06B6D4' : '#F59E0B'}
                />
                <Text
                  className={`text-[11px] font-bold font-mono ml-1 ${
                    isTimerRunning ? 'text-accent-cyan' : 'text-amber-400'
                  }`}
                >
                  {formatDuration(secondsElapsed)}
                </Text>
                {!isTimerRunning && (
                  <Text className="text-[9px] font-extrabold text-amber-400 ml-1">PAUSED</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Finish Workout Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleFinishWorkout()}
              className="bg-accent-cyan px-3.5 py-2.5 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
            >
              <Ionicons name="checkmark-done" size={16} color="#09090B" />
              <Text className="text-black font-extrabold text-xs">Finish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WORKOUT PARTNERS / LIFTER SWITCHER BAR (Gym Jam Shared Excel View) */}
        {sessionLifters.length > 1 && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2.5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-1.5">
                <Text className="text-sm">🏋️</Text>
                <Text className="text-xs font-black tracking-wider text-zinc-300 uppercase">
                  Workout Partners
                </Text>
              </View>
              <Text className="text-[10px] text-zinc-500 font-medium">
                Tap name to switch lifter and log sets
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {sessionLifters.map((lifter) => {
                const isViewing = viewingLifterId === lifter.id;
                const completedSets = getCompletedCountForUser(lifter.id);

                return (
                  <TouchableOpacity
                    key={lifter.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setViewingLifterId(lifter.id);
                    }}
                    className={`flex-row items-center mr-2 px-3.5 py-2 rounded-xl border ${
                      isViewing
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-zinc-850 border-zinc-750'
                    }`}
                  >
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                        isViewing ? 'bg-cyan-400' : 'bg-zinc-700'
                      }`}
                    >
                      <Ionicons
                        name="person"
                        size={13}
                        color={isViewing ? '#09090B' : '#A1A1AA'}
                      />
                    </View>
                    <View>
                      <View className="flex-row items-center space-x-1.5">
                        <Text
                          className={`text-xs font-black ${
                            isViewing ? 'text-white' : 'text-zinc-300'
                          }`}
                        >
                          {lifter.name}
                        </Text>
                      </View>
                      <Text
                        className={`text-[10px] font-bold ${
                          isViewing ? 'text-cyan-300 font-mono' : 'text-zinc-500'
                        }`}
                      >
                        {completedSets} {completedSets === 1 ? 'set' : 'sets'}
                      </Text>
                    </View>
                    {isViewing && (
                      <View className="ml-2 bg-cyan-400/25 px-1.5 py-0.5 rounded border border-cyan-400/40">
                        <Text className="text-[9px] font-extrabold text-cyan-300">ACTIVE</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Coach-as-Driver Session Bar */}
        {(userRole === 'coach' || params.clientName || params.clientId) && (
          <View className="bg-cyan-950/80 border-b border-cyan-500/40 px-3 py-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5 flex-1">
              <View className="w-2 h-2 rounded-full bg-cyan-400" />
              <Text className="text-[11px] font-black text-cyan-300" numberOfLines={1}>
                COACH DRIVER: {params.clientName || gymJam.partnerName || 'Remote Athlete'}
              </Text>
            </View>
          </View>
        )}

        {/* Gym Jam Live Feed Toast Notification */}
        {gymJam.liveToasts.length > 0 && (
          <View className="px-3 pt-2">
            {gymJam.liveToasts.map((toast) => (
              <View
                key={toast.id}
                className="bg-cyan-950/95 border border-cyan-500/60 rounded-xl px-3 py-2 mb-1.5 flex-row items-center space-x-2 shadow-lg"
              >
                <Ionicons name="flash" size={13} color="#06B6D4" />
                <Text className="text-xs font-bold text-white flex-1">{toast.message}</Text>
                <Text className="text-[10px] text-cyan-400 font-mono">LIVE</Text>
              </View>
            ))}
          </View>
        )}

        {/* Partner Latest Set Badge */}
        {gymJam.connectionStatus === 'connected' && partnerLatestSet && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2">
            <View className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-1.5">
                <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                <Text className="text-[11px] font-medium text-zinc-300">
                  {gymJam.partnerName || 'Partner'} logged Set {partnerLatestSet.setIndex + 1}:{' '}
                  <Text className="font-bold text-emerald-400">
                    {partnerLatestSet.weight}kg × {partnerLatestSet.reps}
                  </Text>
                  {partnerLatestSet.rpe ? ` @ RPE ${partnerLatestSet.rpe}` : ''}
                </Text>
              </View>
              <Text className="text-[9px] font-mono text-zinc-500">SYNCED</Text>
            </View>
          </View>
        )}

        {/* Scrollable Exercise Cards */}
        <ScrollView className="flex-1 px-3 py-4" showsVerticalScrollIndicator={false}>
          {currentSessionExercises.map((exItem, exIdx) => {
            const firstSetWeight = exItem.sets[0]?.weightKg || 0;

            // Determine benchmark data for the viewed lifter
            let benchmarkBestWorkingSet: { weightKg: number; reps: number; date?: string } | undefined;
            let benchmarkRepPR: number = 0;
            let benchmarkEst1RM: number = 0;

            if (viewingLifterId === activeUser.id) {
              const userLogs = workoutLogs.filter((l) => l.userId === activeUser.id);
              const hist = getExerciseHistory(userLogs, exItem.exerciseId, firstSetWeight);
              benchmarkBestWorkingSet = hist.bestWorkingSet;
              benchmarkRepPR = hist.maxRepsAtWeight;
              benchmarkEst1RM = hist.estimated1RM;
            } else {
              const partnerExBench = partnerBenchmarks[exItem.exerciseId];
              if (partnerExBench) {
                benchmarkBestWorkingSet = partnerExBench.bestWorkingSet;
                benchmarkRepPR = partnerExBench.maxRepsAtWeight;
                benchmarkEst1RM = partnerExBench.estimated1RM;
              } else {
                const partnerLogs = workoutLogs.filter((l) => l.userId === viewingLifterId);
                const hist = getExerciseHistory(partnerLogs, exItem.exerciseId, firstSetWeight);
                benchmarkBestWorkingSet = hist.bestWorkingSet;
                benchmarkRepPR = hist.maxRepsAtWeight;
                benchmarkEst1RM = hist.estimated1RM;
              }
            }

            return (
              <View
                key={`${exItem.exerciseId}_${exIdx}`}
                className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md"
              >
                {/* Exercise Title & Swap Button */}
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                  <View className="flex-1 pr-2">
                    <Text className="text-lg font-bold text-white">{exItem.exerciseName}</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className="text-xs text-zinc-400">Lifter: </Text>
                      <View className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/50">
                        <Text className="text-[11px] font-bold text-cyan-300">
                          {viewingLifterName}
                        </Text>
                      </View>
                      {sessionLifters.length > 1 && (
                        <Text className="text-[11px] text-zinc-400 font-semibold ml-1.5">
                          • Shared Sheet (Tap partner above)
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center space-x-1.5">
                    <TouchableOpacity
                      onPress={() => {
                        setSwapTargetIndex(exIdx);
                        setShowSwapModal(true);
                      }}
                      className="bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg flex-row items-center space-x-1"
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#A1A1AA" />
                      <Text className="text-[11px] text-zinc-300 font-medium">Swap</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Historical Benchmarks Card */}
                <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 mb-4">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Benchmark Reference ({viewingLifterName})
                  </Text>
                  <View className="flex-row justify-between items-center">
                    {/* Best Working Set (Not 1RM) */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-[10px] text-zinc-500 font-medium">Best Set (&gt;1 rep)</Text>
                      {benchmarkBestWorkingSet ? (
                        <View>
                          <Text className="text-xs font-bold text-accent-cyan">
                            {benchmarkBestWorkingSet.weightKg}{weightUnit} × {benchmarkBestWorkingSet.reps}
                          </Text>
                          {benchmarkBestWorkingSet.date ? (
                            <Text className="text-[9px] text-zinc-500">
                              {benchmarkBestWorkingSet.date}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text className="text-xs text-zinc-500 italic">No history</Text>
                      )}
                    </View>

                    {/* Max Reps at Weight */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-[10px] text-zinc-500 font-medium">Rep PR ({firstSetWeight}{weightUnit})</Text>
                      <Text className="text-xs font-bold text-accent-emerald">
                        {benchmarkRepPR > 0 ? `${benchmarkRepPR} Reps` : '—'}
                      </Text>
                    </View>

                    {/* Estimated 1RM */}
                    <View className="flex-1">
                      <Text className="text-[10px] text-zinc-500 font-medium">Est. 1RM</Text>
                      <Text className="text-xs font-bold text-accent-orange">
                        {benchmarkEst1RM > 0 ? `${benchmarkEst1RM} ${weightUnit}` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Sets Header */}
                <View className="flex-row items-center px-1 mb-2">
                  <Text className="w-10 text-[11px] font-bold text-zinc-500 text-center">SET</Text>
                  <Text className="w-20 text-[11px] font-bold text-zinc-500 text-center">TYPE</Text>
                  <Text className="flex-1 text-[11px] font-bold text-zinc-500 text-center">{weightUnit.toUpperCase()}</Text>
                  <Text className="flex-1 text-[11px] font-bold text-zinc-500 text-center">REPS</Text>
                  <Text className="w-12 text-[11px] font-bold text-zinc-500 text-center">DONE</Text>
                </View>

                {/* Set Entry Rows */}
                {exItem.sets.map((set, setIdx) => {
                  const set1RM = calculate1RM(set.weightKg, set.reps);
                  const lifterLogs = workoutLogs.filter((l) => l.userId === viewingLifterId);
                  const lifterExHistory = getExerciseHistory(lifterLogs, exItem.exerciseId, firstSetWeight);
                  const prevSessionSet = lifterExHistory.previousSessionSets?.[setIdx];
                  const ghostWeight = prevSessionSet && prevSessionSet.weightKg > 0
                    ? prevSessionSet.weightKg
                    : (setIdx > 0 && exItem.sets[setIdx - 1]?.weightKg > 0 ? exItem.sets[setIdx - 1].weightKg : 20);
                  const ghostReps = prevSessionSet && prevSessionSet.reps > 0
                    ? prevSessionSet.reps
                    : (setIdx > 0 && exItem.sets[setIdx - 1]?.reps > 0 ? exItem.sets[setIdx - 1].reps : 8);

                  return (
                    <View
                      key={setIdx}
                      className={`flex-row items-center py-2 px-1 rounded-xl mb-2 border ${
                        set.isCompleted
                          ? 'bg-emerald-950/20 border-emerald-900/40'
                          : 'bg-zinc-900/60 border-zinc-800/60'
                      }`}
                    >
                      {/* Set Number */}
                      <TouchableOpacity
                        onLongPress={() => handleRemoveSet(exIdx, setIdx)}
                        className="w-10 items-center justify-center"
                      >
                        <View className="w-7 h-7 rounded-full bg-zinc-800 items-center justify-center border border-zinc-700">
                          <Text className="text-xs font-bold text-white">{setIdx + 1}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Set Type Selector */}
                      <TouchableOpacity
                        onPress={() => {
                          const currentTypeIdx = SET_TYPES.indexOf(set.type);
                          const nextType = SET_TYPES[(currentTypeIdx + 1) % SET_TYPES.length];
                          handleUpdateSet(exIdx, setIdx, 'type', nextType);
                        }}
                        className={`w-20 py-1.5 px-1 rounded-lg items-center justify-center border ${
                          set.type === 'Warmup'
                            ? 'bg-amber-950/40 border-amber-500/50'
                            : set.type === 'Drop'
                            ? 'bg-purple-950/40 border-purple-500/50'
                            : set.type === 'Failure'
                            ? 'bg-red-950/40 border-red-500/50'
                            : 'bg-zinc-800 border-zinc-700'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            set.type === 'Warmup'
                              ? 'text-amber-400'
                              : set.type === 'Drop'
                              ? 'text-purple-300'
                              : set.type === 'Failure'
                              ? 'text-red-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {set.type}
                        </Text>
                      </TouchableOpacity>

                      {/* Weight Input */}
                      <View className="flex-1 mx-1">
                        <TextInput
                          keyboardType="numeric"
                          value={set.weightKg > 0 ? set.weightKg.toString() : ''}
                          placeholder={ghostWeight > 0 ? ghostWeight.toString() : '20'}
                          placeholderTextColor="#71717A"
                          onChangeText={(text) =>
                            handleUpdateSet(
                              exIdx,
                              setIdx,
                              'weightKg',
                              parseFloat(text) || 0
                            )
                          }
                          className="bg-zinc-950 border border-zinc-800 text-white text-center py-1.5 px-1 rounded-lg font-bold text-sm"
                        />
                      </View>

                      {/* Reps Input */}
                      <View className="flex-1 mx-1">
                        <TextInput
                          keyboardType="number-pad"
                          value={set.reps > 0 ? set.reps.toString() : ''}
                          placeholder={ghostReps > 0 ? ghostReps.toString() : '8'}
                          placeholderTextColor="#71717A"
                          onChangeText={(text) =>
                            handleUpdateSet(exIdx, setIdx, 'reps', parseInt(text, 10) || 0)
                          }
                          className="bg-zinc-950 border border-zinc-800 text-white text-center py-1.5 px-2 rounded-lg font-bold text-sm"
                        />
                      </View>

                      {/* Checkbox Trigger with Haptics */}
                      <TouchableOpacity
                        onPress={() => handleToggleComplete(exIdx, setIdx)}
                        className={`w-12 h-10 rounded-lg items-center justify-center border ${
                          set.isCompleted
                            ? 'bg-accent-emerald border-accent-emerald'
                            : 'bg-zinc-800 border-zinc-700'
                        }`}
                      >
                        <Ionicons
                          name={set.isCompleted ? 'checkmark-sharp' : 'square-outline'}
                          size={22}
                          color={set.isCompleted ? '#FFFFFF' : '#A1A1AA'}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Add Set Button */}
                <TouchableOpacity
                  onPress={() => handleAddSet(exIdx)}
                  className="bg-zinc-900 border border-dashed border-cyan-500/50 py-2.5 rounded-xl items-center flex-row justify-center space-x-1 mt-1"
                >
                  <Ionicons name="add" size={16} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Add Working Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Add Exercise to Workout Session Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setExerciseSearchQuery('');
              setShowAddExerciseModal(true);
            }}
            className="bg-accent-cyan p-4 rounded-2xl mb-8 flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25"
          >
            <Ionicons name="add-circle" size={22} color="#09090B" />
            <Text className="text-black font-extrabold text-base">+ Add Exercise to Workout</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Swap Exercise Modal */}
        {showSwapModal && (
          <Modal visible={showSwapModal} transparent animationType="slide">
            <View className="flex-1 bg-black/80 justify-end">
              <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                  <Text className="text-lg font-bold text-white">Swap Exercise</Text>
                  <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Create New Exercise Shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    setShowSwapModal(false);
                    setShowCreateExerciseModal(true);
                  }}
                  className="bg-cyan-500/15 border border-dashed border-cyan-500/60 p-3 rounded-xl mb-3 flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="add-circle" size={18} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Create Brand New Exercise</Text>
                </TouchableOpacity>

                {/* Search Bar */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex-row items-center space-x-2 mb-3">
                  <Ionicons name="search-outline" size={16} color="#71717A" />
                  <TextInput
                    value={exerciseSearchQuery}
                    onChangeText={setExerciseSearchQuery}
                    placeholder="Search exercise to swap with..."
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-xs font-medium"
                  />
                  {exerciseSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#71717A" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView className="mb-4">
                  {exercises
                    .filter(
                      (ex) =>
                        !exerciseSearchQuery.trim() ||
                        ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                        ex.muscleGroup.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                    )
                    .map((ex) => (
                      <TouchableOpacity
                        key={ex.id}
                        onPress={() => handleSwapExercise(ex)}
                        className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 flex-row items-center justify-between"
                      >
                        <View>
                          <Text className="text-sm font-bold text-white">{ex.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {ex.muscleGroup} • {ex.equipment}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#06B6D4" />
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Add Exercise to Workout Modal */}
        {showAddExerciseModal && (
          <Modal visible={showAddExerciseModal} transparent animationType="slide">
            <View className="flex-1 bg-black/80 justify-end">
              <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                  <Text className="text-lg font-bold text-white">Add Exercise to Workout</Text>
                  <TouchableOpacity onPress={() => setShowAddExerciseModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Create New Exercise Shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    setShowAddExerciseModal(false);
                    setSwapTargetIndex(null);
                    setShowCreateExerciseModal(true);
                  }}
                  className="bg-cyan-500/15 border border-dashed border-cyan-500/60 p-3 rounded-xl mb-3 flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="add-circle" size={18} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Create Brand New Exercise</Text>
                </TouchableOpacity>

                {/* Search Bar */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex-row items-center space-x-2 mb-3">
                  <Ionicons name="search-outline" size={16} color="#71717A" />
                  <TextInput
                    value={exerciseSearchQuery}
                    onChangeText={setExerciseSearchQuery}
                    placeholder="Search exercises by name..."
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-xs font-medium"
                  />
                  {exerciseSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#71717A" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView className="mb-4">
                  {exercises
                    .filter(
                      (ex) =>
                        !exerciseSearchQuery.trim() ||
                        ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                        ex.muscleGroup.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                    )
                    .map((ex) => (
                      <TouchableOpacity
                        key={ex.id}
                        onPress={() => handleAddExerciseToSession(ex)}
                        className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 flex-row items-center justify-between"
                      >
                        <View>
                          <Text className="text-sm font-bold text-white">{ex.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {ex.muscleGroup} • {ex.equipment}
                          </Text>
                        </View>
                        <View className="bg-cyan-500/20 border border-cyan-500/60 px-3 py-1.5 rounded-lg">
                          <Text className="text-xs font-bold text-cyan-400">+ Add</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Create Custom Exercise Modal */}
        {showCreateExerciseModal && (
          <Modal visible={showCreateExerciseModal} transparent animationType="slide">
            <View className="flex-1 bg-black/85 justify-center px-4">
              <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                  <Text className="text-lg font-bold text-white">Create New Exercise</Text>
                  <TouchableOpacity onPress={() => setShowCreateExerciseModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs text-zinc-400 mb-1">Exercise Name</Text>
                <TextInput
                  value={newExName}
                  onChangeText={setNewExName}
                  placeholder="e.g. Incline Smith Machine Press"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold"
                />

                <Text className="text-xs text-zinc-400 mb-1">Primary Muscle Group</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {MUSCLE_GROUPS.map((mg) => (
                    <TouchableOpacity
                      key={mg}
                      onPress={() => setNewExMuscle(mg)}
                      className={`px-3 py-1.5 rounded-lg mr-2 border ${
                        newExMuscle === mg
                          ? 'bg-accent-cyan border-cyan-400'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          newExMuscle === mg ? 'text-black font-bold' : 'text-white'
                        }`}
                      >
                        {mg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text className="text-xs text-zinc-400 mb-1">Equipment</Text>
                <TextInput
                  value={newExEquipment}
                  onChangeText={setNewExEquipment}
                  placeholder="e.g. Dumbbell / Cable / Machine"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-6"
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleCreateAndAddExercise}
                  className="bg-accent-cyan p-4 rounded-xl items-center shadow-lg shadow-cyan-500/20"
                >
                  <Text className="text-black font-extrabold text-base">Save & Add to Workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* Gym Jam Lobby Modal */}
        {showGymJamLobby && (
          <GymJamLobbyModal
            visible={showGymJamLobby}
            onClose={() => setShowGymJamLobby(false)}
            connectionStatus={gymJam.connectionStatus}
            roomPin={gymJam.roomPin}
            role={gymJam.role}
            partnerName={gymJam.partnerName}
            isWebRTC={gymJam.isWebRTC}
            onSimulatePartner={() => gymJam.simulatePartnerJoin('Jordan (Partner)')}
            onHostSession={() => {
              const myCurrentExercises =
                userExercisesMap[activeUser.id] ||
                buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
              const template: SessionExerciseTemplate[] = myCurrentExercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                sets: ex.sets.map((s) => ({
                  setNumber: s.setNumber,
                  type: s.type,
                  weightKg: s.weightKg,
                  reps: s.reps,
                })),
              }));

              gymJam.hostRoom({
                routineName: currentRoutineTitle,
                exerciseIds: sessionExerciseIds,
                sessionExercisesTemplate: template,
              });
            }}
            onJoinSession={async (pin) => {
              return await gymJam.joinRoom(pin);
            }}
            onDisconnect={() => gymJam.disconnect()}
            onStartSession={() => setShowGymJamLobby(false)}
          />
        )}


        {/* Aesthetic Shareable Workout Receipt Modal */}
        {showReceiptModal && (
          <WorkoutReceiptModal
            visible={showReceiptModal}
            receiptData={receiptData}
            onClose={() => {
              if (gymJam.connectionStatus === 'connected') {
                gymJam.disconnect();
              }
              setShowReceiptModal(false);
              router.back();
            }}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
