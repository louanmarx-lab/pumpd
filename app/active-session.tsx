import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { HeaderSwitcher } from '../components/HeaderSwitcher';
import { SetType, SetLog, LoggedExercise, Exercise, MuscleGroup } from '../src/types';
import { calculate1RM, getExerciseHistory } from '../src/utils/fitness';
import { useGymJam } from '../src/hooks/useGymJam';
import { GymJamLobbyModal } from '../src/components/GymJamLobbyModal';
import { WorkoutReceiptModal } from '../src/components/WorkoutReceiptModal';
import { WorkoutReceiptData } from '../src/types/gymjam';
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
  }>();

  const {
    currentUser,
    activeUser,
    activeWorkspace,
    userRole,
    coachProfile,
    clients,
    exercises,
    workoutLogs,
    saveWorkoutLog,
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

  // Helper to build initial exercises for a specific user using their own benchmark history
  const buildInitialExercisesForUser = (userId: string): LoggedExercise[] => {
    const userLogs = workoutLogs.filter((l) => l.userId === userId);
    return initialIds.map((id) => {
      const exDef = exercises.find((e) => e.id === id);
      const history = getExerciseHistory(userLogs, id);

      let defaultSets: SetLog[] = [];
      if (history.previousSessionSets && history.previousSessionSets.length > 0) {
        defaultSets = history.previousSessionSets.map((s, idx) => ({
          setNumber: idx + 1,
          type: s.type,
          weightKg: s.weightKg,
          reps: s.reps,
          isCompleted: false,
        }));
      } else {
        defaultSets = [
          { setNumber: 1, type: 'Warmup', weightKg: 30, reps: 10, isCompleted: false },
          { setNumber: 2, type: 'Normal', weightKg: 50, reps: 8, isCompleted: false },
          { setNumber: 3, type: 'Normal', weightKg: 55, reps: 6, isCompleted: false },
        ];
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

  // Background-resilient workout timer (timestamp-delta architecture)
  const workoutTimer = useWorkoutTimer({
    autoStart: true,
    storageKey: `@pumpd_active_workout_timer_${params.splitId || 'session'}`,
  });
  const secondsElapsed = workoutTimer.elapsedSeconds;
  const isTimerRunning = workoutTimer.isRunning;
  const { togglePauseResume: toggleWorkoutTimer, stop: stopWorkoutTimer } = workoutTimer;

  // Synced Rest Countdown Timer State
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);

  // Gym Jam P2P State & Handlers
  const [showGymJamLobby, setShowGymJamLobby] = useState(false);
  const [activeTurnUserId, setActiveTurnUserId] = useState<string>(activeUser.id);
  const [activeTurnUserName, setActiveTurnUserName] = useState<string>(activeUser.displayName);
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

  const gymJam = useGymJam({
    currentUserId: activeUser.id,
    currentUserName: activeUser.displayName,
    userRole,
    onSyncSessionReceived: (msg) => {
      // Synchronize routine title and exercises if guest
      if (msg.exerciseIds && msg.exerciseIds.length > 0) {
        setUserExercisesMap((prev) => {
          const next = { ...prev };
          const guestList = buildInitialExercisesForUser(activeUser.id);
          next[activeUser.id] = guestList;
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
        const partnerList = next[msg.userId] ? [...next[msg.userId]] : buildInitialExercisesForUser(msg.userId);
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
        const myExercises = next[activeUser.id] ? [...next[activeUser.id]] : buildInitialExercisesForUser(activeUser.id);
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
        setUserExercisesMap((prev) => {
          const next = { ...prev };
          const current = next[activeUser.id] ? [...next[activeUser.id]] : [];
          if (current[msg.exerciseIndex]) {
            current[msg.exerciseIndex] = {
              exerciseId: newDef.id,
              exerciseName: newDef.name,
              sets: current[msg.exerciseIndex].sets.map((s) => ({ ...s, isCompleted: false })),
            };
            next[activeUser.id] = current;
          }
          return next;
        });
      }
    },
    onAdvanceExercise: (msg) => {
      setActiveExerciseIndex(msg.exerciseIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onTurnSet: (msg) => {
      setActiveTurnUserId(msg.activeTurnUserId);
      setActiveTurnUserName(msg.activeTurnUserName);
      if (msg.restTimerSeconds) {
        setRestSecondsRemaining(msg.restTimerSeconds);
      }
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
    onTimerSync: (msg) => {
      setRestSecondsRemaining(msg.durationSeconds);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
  });

  // Synced Rest Countdown Interval Effect
  useEffect(() => {
    if (restSecondsRemaining === null || restSecondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setRestSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restSecondsRemaining]);

  const handleTriggerRestTimer = (seconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRestSecondsRemaining(seconds);
    gymJam.broadcastStartTimer(seconds);
  };

  // Initialize independent session exercise cards for both users
  useEffect(() => {
    const initialMap: Record<string, LoggedExercise[]> = {
      [activeUser.id]: buildInitialExercisesForUser(activeUser.id),
    };
    setUserExercisesMap(initialMap);
  }, [activeUser.id]);

  // Get current active user's exercises
  const currentSessionExercises: LoggedExercise[] =
    userExercisesMap[activeUser.id] || buildInitialExercisesForUser(activeUser.id);

  const getCompletedCountForUser = (userId: string): number => {
    const list = userExercisesMap[userId] || [];
    return list.reduce((acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length, 0);
  };

  // Set mutation functions for active user ONLY
  const handleUpdateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof SetLog,
    value: any
  ) => {
    setUserExercisesMap((prev) => {
      const currentList = prev[activeUser.id]
        ? [...prev[activeUser.id]]
        : [...buildInitialExercisesForUser(activeUser.id)];
      const ex = { ...currentList[exIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      ex.sets = sets;
      currentList[exIndex] = ex;
      return { ...prev, [activeUser.id]: currentList };
    });
  };

  const handleCycleRpe = (exIndex: number, setIndex: number, currentRpe?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const rpeSequence = [7, 7.5, 8, 8.5, 9, 9.5, 10];
    const currentIndex = currentRpe ? rpeSequence.indexOf(currentRpe) : -1;
    const nextRpe =
      currentIndex === -1 || currentIndex === rpeSequence.length - 1
        ? rpeSequence[0]
        : rpeSequence[currentIndex + 1];
    handleUpdateSet(exIndex, setIndex, 'rpe', nextRpe);
  };

  const handleToggleComplete = (exIndex: number, setIndex: number) => {
    const currentCompleted = currentSessionExercises[exIndex]?.sets[setIndex]?.isCompleted || false;
    if (!currentCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // If Gym Jam is connected, broadcast set completion and alternate turn!
      if (gymJam.connectionStatus === 'connected') {
        const currentSet = currentSessionExercises[exIndex]?.sets[setIndex];
        if (currentSet) {
          if (userRole === 'coach') {
            // Coach remote logging on athlete's behalf
            gymJam.broadcastCoachLogSet(
              gymJam.partnerUserId || params.clientId || 'athlete',
              currentSessionExercises[exIndex].exerciseId,
              setIndex,
              currentSet.weightKg,
              currentSet.reps,
              currentSet.rpe
            );
          } else {
            gymJam.broadcastLogSet(
              currentSessionExercises[exIndex].exerciseId,
              setIndex,
              currentSet.weightKg,
              currentSet.reps,
              currentSet.rpe
            );
          }

          // Automatically alternate turn to partner and start rest timer
          const nextUserId = gymJam.partnerUserId || 'partner';
          const nextUserName = gymJam.partnerName || 'Gym Partner';
          setActiveTurnUserId(nextUserId);
          setActiveTurnUserName(nextUserName);
          gymJam.broadcastTurnSet(
            nextUserId,
            nextUserName,
            {
              exerciseId: currentSessionExercises[exIndex].exerciseId,
              setIndex,
              weight: currentSet.weightKg,
              reps: currentSet.reps,
              rpe: currentSet.rpe,
            },
            90
          );
          setRestSecondsRemaining(90);
        }
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleUpdateSet(exIndex, setIndex, 'isCompleted', !currentCompleted);
  };

  const handlePassTurn = () => {
    if (gymJam.connectionStatus !== 'connected') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isMyTurn = activeTurnUserId === activeUser.id;
    const nextUserId = isMyTurn ? (gymJam.partnerUserId || 'partner') : activeUser.id;
    const nextUserName = isMyTurn ? (gymJam.partnerName || 'Gym Partner') : activeUser.displayName;
    setActiveTurnUserId(nextUserId);
    setActiveTurnUserName(nextUserName);
    gymJam.broadcastTurnSet(nextUserId, nextUserName);
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
    setUserExercisesMap((prev) => {
      const currentList = prev[activeUser.id]
        ? [...prev[activeUser.id]]
        : [...buildInitialExercisesForUser(activeUser.id)];
      const ex = { ...currentList[exIndex] };
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: SetLog = {
        setNumber: ex.sets.length + 1,
        type: 'Normal',
        weightKg: lastSet ? lastSet.weightKg : 50,
        reps: lastSet ? lastSet.reps : 8,
        isCompleted: false,
      };
      ex.sets = [...ex.sets, newSet];
      currentList[exIndex] = ex;
      return { ...prev, [activeUser.id]: currentList };
    });
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserExercisesMap((prev) => {
      const currentList = prev[activeUser.id]
        ? [...prev[activeUser.id]]
        : [...buildInitialExercisesForUser(activeUser.id)];
      const ex = { ...currentList[exIndex] };
      if (ex.sets.length <= 1) return prev;
      const filtered = ex.sets.filter((_, idx) => idx !== setIndex);
      ex.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
      currentList[exIndex] = ex;
      return { ...prev, [activeUser.id]: currentList };
    });
  };

  const handleSwapExercise = (newEx: Exercise) => {
    if (swapTargetIndex === null) return;
    const oldEx = currentSessionExercises[swapTargetIndex];
    if (gymJam.connectionStatus === 'connected' && userRole === 'coach' && oldEx) {
      gymJam.broadcastSwapExercise(swapTargetIndex, oldEx.exerciseId, newEx.id, newEx.name);
    }
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      Object.keys(nextMap).forEach((uId) => {
        const list = [...nextMap[uId]];
        if (list[swapTargetIndex]) {
          list[swapTargetIndex] = {
            exerciseId: newEx.id,
            exerciseName: newEx.name,
            sets: [
              { setNumber: 1, type: 'Warmup', weightKg: 20, reps: 10, isCompleted: false },
              { setNumber: 2, type: 'Normal', weightKg: 40, reps: 8, isCompleted: false },
            ],
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
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const currentList = nextMap[activeUser.id]
        ? [...nextMap[activeUser.id]]
        : buildInitialExercisesForUser(activeUser.id);
      const newLoggedEx: LoggedExercise = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 20, reps: 10, isCompleted: false },
          { setNumber: 2, type: 'Normal', weightKg: 40, reps: 8, isCompleted: false },
          { setNumber: 3, type: 'Normal', weightKg: 50, reps: 8, isCompleted: false },
        ],
      };
      nextMap[activeUser.id] = [...currentList, newLoggedEx];
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

  const handleFinishWorkout = () => {
    const activeExList = currentSessionExercises;
    const completedSetsCount = activeExList.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
      0
    );

    if (completedSetsCount === 0) {
      Alert.alert(
        'Empty Session',
        'Please complete at least one set before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const finalDurationSeconds = stopWorkoutTimer();

    // Save workout log to the current authenticated user's profile
    saveWorkoutLog({
      userId: activeUser.id,
      workspaceId: activeWorkspace.id,
      splitId: params.splitId || 'split_custom',
      routineName: routineTitle,
      date: todayDate,
      timestamp: Date.now(),
      durationSeconds: finalDurationSeconds,
      exercises: activeExList,
    });

    // Build Workout Receipt Data for the active lifter
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;
    let bestLift: WorkoutReceiptData['bestLift'] = null;
    let highest1RM = 0;

    const exercisesSummary: WorkoutReceiptData['exercisesSummary'] = [];

    activeExList.forEach((ex) => {
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
      id: `PMPD-${Math.floor(100000 + Math.random() * 900000)}`,
      date: todayDate,
      routineName: routineTitle,
      durationSeconds: finalDurationSeconds,
      totalVolumeKg: Math.round(totalVolume),
      totalSets,
      totalReps,
      bestLift,
      gymJamBuddy:
        gymJam.connectionStatus === 'connected' && gymJam.partnerName
          ? {
              name: gymJam.partnerName,
              roomPin: gymJam.roomPin || '',
            }
          : null,
      coachAttribution: {
        name: coachProfile.name,
        businessName: coachProfile.businessName,
        instagramHandle: coachProfile.instagramHandle,
      },
      exercisesSummary,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowReceiptModal(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header Bar */}
        <View className="bg-dark-card border-b border-dark-border px-3 py-2.5 flex-row items-center justify-between shadow-md">
          <View className="flex-row items-center space-x-2 flex-1 mr-2">
            <TouchableOpacity onPress={() => router.back()} className="p-1">
              <Ionicons name="close" size={24} color="#A1A1AA" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-sm font-bold text-white" numberOfLines={1}>
                {routineTitle}
              </Text>
              {/* Live Stopwatch Badge with 1-Tap Pause/Resume */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleWorkoutTimer();
                }}
                className={`flex-row items-center space-x-1.5 mt-0.5 px-2 py-0.5 self-start rounded-md border ${
                  isTimerRunning
                    ? 'bg-cyan-950/40 border-cyan-500/40'
                    : 'bg-amber-950/40 border-amber-500/50'
                }`}
              >
                <Ionicons
                  name={isTimerRunning ? 'stopwatch' : 'play'}
                  size={12}
                  color={isTimerRunning ? '#06B6D4' : '#F59E0B'}
                />
                <Text
                  className={`text-xs font-black font-mono ${
                    isTimerRunning ? 'text-accent-cyan' : 'text-amber-400'
                  }`}
                >
                  {formatDuration(secondsElapsed)}
                </Text>
                {!isTimerRunning && (
                  <View className="bg-amber-500/20 px-1 py-0.2 rounded border border-amber-500/40">
                    <Text className="text-[9px] font-extrabold text-amber-300">PAUSED</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Controls: Gym Jam, Switcher & Finish */}
          <View className="flex-row items-center space-x-1.5">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowGymJamLobby(true)}
              className={`flex-row items-center px-2.5 py-1.5 rounded-xl border ${
                gymJam.connectionStatus === 'connected'
                  ? 'bg-emerald-500/15 border-emerald-500/60'
                  : gymJam.connectionStatus === 'connecting'
                  ? 'bg-amber-500/15 border-amber-500/60'
                  : 'bg-zinc-850 border-zinc-750'
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
                className={`text-[10px] font-black ${
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
                  : 'Jam'}
              </Text>
            </TouchableOpacity>

            <HeaderSwitcher />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleFinishWorkout}
              className="bg-accent-cyan px-3 py-1.5 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
            >
              <Ionicons name="checkmark-done" size={16} color="#09090B" />
              <Text className="text-black font-extrabold text-xs">Finish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Coach-as-Driver Session Bar */}
        {(userRole === 'coach' || params.clientName || params.clientId) && (
          <View className="bg-cyan-950/80 border-b border-cyan-500/40 px-3 py-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5 flex-1 mr-2">
              <View className="w-2 h-2 rounded-full bg-cyan-400" />
              <Text className="text-[11px] font-black text-cyan-300" numberOfLines={1}>
                COACH DRIVER: {params.clientName || gymJam.partnerName || 'Remote Athlete'}
              </Text>
            </View>

            {/* Quick Rest Timer Triggers */}
            <View className="flex-row items-center space-x-1">
              <Text className="text-[10px] font-bold text-zinc-400 mr-0.5">Rest:</Text>
              {[60, 90, 120].map((sec) => (
                <TouchableOpacity
                  key={`rest-${sec}`}
                  onPress={() => handleTriggerRestTimer(sec)}
                  className={`px-2 py-0.5 rounded-md border ${
                    restSecondsRemaining === sec
                      ? 'bg-cyan-400 border-cyan-300'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-black ${
                      restSecondsRemaining === sec ? 'text-black' : 'text-zinc-300'
                    }`}
                  >
                    {sec}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Synced Rest Timer Countdown Banner */}
        {restSecondsRemaining !== null && restSecondsRemaining > 0 && (
          <View className="bg-amber-500/15 border-b border-amber-500/40 px-3 py-1.5 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5">
              <Ionicons name="timer-outline" size={14} color="#F59E0B" />
              <Text className="text-xs font-bold text-amber-300">Synced Rest Interval</Text>
            </View>
            <View className="flex-row items-center space-x-2">
              <Text className="text-sm font-black font-mono text-amber-400">
                {restSecondsRemaining}s
              </Text>
              <TouchableOpacity
                onPress={() => setRestSecondsRemaining(null)}
                className="bg-amber-500/20 px-1.5 py-0.5 rounded"
              >
                <Text className="text-[9px] font-bold text-amber-300">Dismiss</Text>
              </TouchableOpacity>
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

        {/* Gym Jam Live Co-Op Turn Control & Partner HUD */}
        {gymJam.connectionStatus === 'connected' && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2 flex-1 mr-2">
                <View
                  className={`w-3 h-3 rounded-full ${
                    activeTurnUserId === activeUser.id ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`}
                />
                <View className="flex-1">
                  <Text className="text-xs font-black text-white">
                    {activeTurnUserId === activeUser.id
                      ? '🎯 YOUR TURN TO LIFT!'
                      : `⏳ ${activeTurnUserName || gymJam.partnerName || 'Partner'}'s TURN`}
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    {activeTurnUserId === activeUser.id
                      ? 'Perform your set and check it off to alternate turns'
                      : 'Catch your breath and spot your partner'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handlePassTurn}
                className="bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg flex-row items-center space-x-1"
              >
                <Ionicons name="swap-horizontal" size={12} color="#06B6D4" />
                <Text className="text-[10px] font-bold text-cyan-300">
                  {activeTurnUserId === activeUser.id ? 'Pass Turn' : 'Take Turn'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Partner Latest Set Badge */}
            {partnerLatestSet && (
              <View className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 flex-row items-center justify-between">
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
            )}
          </View>
        )}

        {/* Scrollable Exercise Cards */}
        <ScrollView className="flex-1 px-3 py-4" showsVerticalScrollIndicator={false}>
          {currentSessionExercises.map((exItem, exIdx) => {
            // Find current user's history for this exercise
            const firstSetWeight = exItem.sets[0]?.weightKg || 0;
            const userLogs = workoutLogs.filter((l) => l.userId === activeUser.id);
            const history = getExerciseHistory(userLogs, exItem.exerciseId, firstSetWeight);

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
                          {activeUser.displayName}
                        </Text>
                      </View>
                      {gymJam.connectionStatus === 'connected' && (
                        <Text className="text-[11px] text-zinc-400 font-semibold ml-1.5">
                          • Jam with {gymJam.partnerName || 'Partner'}
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
                    Benchmark Reference ({activeUser.displayName})
                  </Text>
                  <View className="flex-row justify-between items-center">
                    {/* Best Working Set (Not 1RM) */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-[10px] text-zinc-500 font-medium">Best Set (&gt;1 rep)</Text>
                      {history.bestWorkingSet ? (
                        <View>
                          <Text className="text-xs font-bold text-accent-cyan">
                            {history.bestWorkingSet.weightKg}kg × {history.bestWorkingSet.reps}
                          </Text>
                          {history.bestWorkingSet.date ? (
                            <Text className="text-[9px] text-zinc-500">
                              {history.bestWorkingSet.date}
                            </Text>
                          ) : null}
                        </View>
                      ) : history.previousSessionSets.length > 0 ? (
                        <Text className="text-xs font-bold text-zinc-300">
                          {history.previousSessionSets[0].weightKg}kg × {history.previousSessionSets[0].reps}
                        </Text>
                      ) : (
                        <Text className="text-xs text-zinc-500 italic">No history</Text>
                      )}
                    </View>

                    {/* Max Reps at Weight */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-[10px] text-zinc-500 font-medium">Rep PR ({firstSetWeight}kg)</Text>
                      <Text className="text-xs font-bold text-accent-emerald">
                        {history.maxRepsAtWeight > 0 ? `${history.maxRepsAtWeight} Reps` : '—'}
                      </Text>
                    </View>

                    {/* Estimated 1RM */}
                    <View className="flex-1">
                      <Text className="text-[10px] text-zinc-500 font-medium">Est. 1RM</Text>
                      <Text className="text-xs font-bold text-accent-orange">
                        {history.estimated1RM > 0 ? `${history.estimated1RM} kg` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Sets Header */}
                <View className="flex-row items-center px-1 mb-2">
                  <Text className="w-10 text-[11px] font-bold text-zinc-500 text-center">SET</Text>
                  <Text className="w-20 text-[11px] font-bold text-zinc-500 text-center">TYPE</Text>
                  <Text className="flex-1 text-[11px] font-bold text-zinc-500 text-center">KG</Text>
                  <Text className="flex-1 text-[11px] font-bold text-zinc-500 text-center">REPS</Text>
                  <Text className="w-12 text-[11px] font-bold text-zinc-500 text-center">RPE</Text>
                  <Text className="w-12 text-[11px] font-bold text-zinc-500 text-center">DONE</Text>
                </View>

                {/* Set Entry Rows */}
                {exItem.sets.map((set, setIdx) => {
                  const set1RM = calculate1RM(set.weightKg, set.reps);

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
                          <Text className="text-xs font-bold text-white">{set.setNumber}</Text>
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
                          value={set.weightKg.toString()}
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
                          value={set.reps.toString()}
                          onChangeText={(text) =>
                            handleUpdateSet(exIdx, setIdx, 'reps', parseInt(text, 10) || 0)
                          }
                          className="bg-zinc-950 border border-zinc-800 text-white text-center py-1.5 px-2 rounded-lg font-bold text-sm"
                        />
                      </View>

                      {/* RPE Selector Chip */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCycleRpe(exIdx, setIdx, set.rpe)}
                        className={`w-12 h-9 rounded-lg border mx-0.5 items-center justify-center ${
                          set.rpe
                            ? 'bg-cyan-500/15 border-cyan-500/50'
                            : 'bg-zinc-950 border-zinc-800'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-black font-mono ${
                            set.rpe ? 'text-cyan-300' : 'text-zinc-500'
                          }`}
                        >
                          {set.rpe ? `@${set.rpe}` : '—'}
                        </Text>
                      </TouchableOpacity>

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

                {/* Advance Exercise Button (Syncs with Partner) */}
                {exIdx < currentSessionExercises.length - 1 ? (
                  <TouchableOpacity
                    onPress={() => handleAdvanceExercise(exIdx + 1)}
                    className="bg-zinc-850 border border-zinc-700 py-2.5 rounded-xl items-center flex-row justify-center space-x-1.5 mt-2"
                  >
                    <Ionicons name="arrow-forward-circle" size={16} color="#06B6D4" />
                    <Text className="text-xs font-bold text-zinc-300">
                      Advance to Next: {currentSessionExercises[exIdx + 1]?.exerciseName} ⏩
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="py-2 mt-1 items-center">
                    <Text className="text-[11px] font-bold text-zinc-500">🏁 Final exercise in routine</Text>
                  </View>
                )}
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

        {/* Add Exercise to Workout Modal */}
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

        {/* Create Custom Exercise Modal */}
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

        {/* Gym Jam Lobby Modal */}
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
            gymJam.hostRoom({
              routineName: routineTitle,
              exerciseIds: initialIds,
            });
          }}
          onJoinSession={async (pin) => {
            return await gymJam.joinRoom(pin);
          }}
          onDisconnect={() => gymJam.disconnect()}
          onStartSession={() => setShowGymJamLobby(false)}
        />


        {/* Aesthetic Shareable Workout Receipt Modal */}
        <WorkoutReceiptModal
          visible={showReceiptModal}
          receiptData={receiptData}
          onClose={() => {
            setShowReceiptModal(false);
            router.back();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
