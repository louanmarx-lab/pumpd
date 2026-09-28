import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { MuscleGroup, Exercise, WorkoutLog, Split, Routine } from '../../../src/types';
import { calculate1RM } from '../../../src/utils/fitness';
import { LogPastWorkoutModal } from '../../../src/components/workouts/LogPastWorkoutModal';
import { ShareWorkoutModal } from '../../../src/components/workouts/ShareWorkoutModal';
import { ImportWorkoutModal } from '../../../src/components/workouts/ImportWorkoutModal';
import { shareSplitCloud } from '../../../src/services/shareSplitService';
import { JoinBuddyWorkoutModal } from '../../../src/components/workouts/JoinBuddyWorkoutModal';
import { JamRoomData } from '../../../src/services/gymJamService';

const formatDuration = (totalSec: number) => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  }
  return `${secs}s`;
};

const MUSCLE_GROUPS: (MuscleGroup | 'All' | 'Favorites')[] = [
  'All',
  'Favorites',
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

export default function WorkoutsScreen() {
  const router = useRouter();
  const {
    activeUser,
    managedClient,
    splits,
    exercises,
    workoutLogs,
    addSplit,
    addExercise,
    deleteExercise,
    toggleStarExercise,
    deleteWorkoutLog,
    updateSplit,
    deleteSplit,
    setActiveSplit,
    toggleStarSplit,
    restoreDefaultSplits,
    userRole,
  } = useUserWorkspace();

  const weightUnit = activeUser.weightUnit || 'kg';

  // When coach is managing a client, filter data by client IDs (not coach's own ID)
  const effectiveUserId = managedClient
    ? (managedClient.linkedUserId || managedClient.id)
    : activeUser.id;
  const effectiveUserIds = managedClient
    ? [managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[]
    : [activeUser.id];

  type WorkoutViewTab = 'schedule' | 'splits' | 'exercises';
  const [activeTab, setActiveTab] = useState<WorkoutViewTab>('schedule');

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | 'All' | 'Favorites'>('All');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  // Share & Import Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showJoinBuddyModal, setShowJoinBuddyModal] = useState(false);
  const [sharePayload, setSharePayload] = useState<{
    code: string | null;
    title: string;
    type: 'split' | 'routine';
    routinesCount: number;
    exercisesCount: number;
    isGenerating: boolean;
  }>({
    code: null,
    title: '',
    type: 'split',
    routinesCount: 0,
    exercisesCount: 0,
    isGenerating: false,
  });

  const handleShareSplit = async (split: Split) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const totalExercises = (split.routines || []).reduce(
      (acc, r) => acc + (r.exerciseIds?.length || 0),
      0
    );
    setSharePayload({
      code: null,
      title: split.name,
      type: 'split',
      routinesCount: split.routines.length,
      exercisesCount: totalExercises,
      isGenerating: true,
    });
    setShowShareModal(true);

    try {
      const code = await shareSplitCloud(
        split,
        exercises,
        activeUser.displayName,
        activeUser.id
      );
      setSharePayload((prev) => ({ ...prev, code, isGenerating: false }));
    } catch (err) {
      console.warn('Failed to share split:', err);
      setSharePayload((prev) => ({ ...prev, isGenerating: false }));
      Alert.alert('Sharing Error', 'Could not generate share code. Check your network.');
    }
  };


  // Selected workout log for detailed inspection modal
  const [selectedWorkoutLog, setSelectedWorkoutLog] = useState<WorkoutLog | null>(null);
  const [showLogPastWorkoutModal, setShowLogPastWorkoutModal] = useState(false);

  // Show only 3 latest workouts by default with show more toggle
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  // Filter workout logs belonging to effective user (client IDs when managing), sorted newest first
  const userWorkoutLogs = workoutLogs
    .filter((l) => effectiveUserIds.includes(l.userId))
    .sort((a, b) => b.timestamp - a.timestamp);

  const displayedWorkouts = showAllWorkouts
    ? userWorkoutLogs
    : userWorkoutLogs.slice(0, 3);

  const handleDeleteWorkout = (logId: string, routineName: string, date: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Workout Log',
      `Delete "${routineName}" recorded on ${date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteWorkoutLog(logId);
            if (selectedWorkoutLog?.id === logId) {
              setSelectedWorkoutLog(null);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDeleteExercise = (exId: string, exName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Custom Exercise',
      `Are you sure you want to remove "${exName}" from your exercise database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteExercise(exId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDeleteSplit = (splitId: string, splitName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (userSplits.length <= 1) {
      Alert.alert(
        'Cannot Delete',
        'You must have at least one workout split configured for this user.'
      );
      return;
    }

    Alert.alert(
      'Delete Workout Split',
      `Are you sure you want to delete "${splitName}"? Any schedule references will be safely reset to Rest Days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSplit(splitId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Filter splits belonging to effective user (client IDs when managing), sorting starred splits first
  const userSplits = useMemo(() => {
    return splits
      .filter((s) => effectiveUserIds.includes(s.userId))
      .sort((a, b) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return 0;
      });
  }, [splits, effectiveUserId]);
  const activeSplit = userSplits.find((s) => s.isActive) || userSplits[0];

  // Split picker mode for top toolbar: 'share' | 'edit' | null
  const [splitPickerMode, setSplitPickerMode] = useState<'share' | 'edit' | null>(null);

  const handleTopSharePress = () => {
    Haptics.selectionAsync();
    if (userSplits.length === 0) {
      Alert.alert('No Splits Found', 'Create or import a workout split first before sharing.');
      return;
    }
    if (userSplits.length === 1) {
      handleShareSplit(userSplits[0]);
      return;
    }
    setSplitPickerMode('share');
  };

  const handleTopEditPress = () => {
    Haptics.selectionAsync();
    if (userSplits.length === 0) {
      router.push('/create-split');
      return;
    }
    if (userSplits.length === 1) {
      router.push({
        pathname: '/create-split',
        params: { splitId: userSplits[0].id },
      });
      return;
    }
    setSplitPickerMode('edit');
  };

  // Rolling Rotation ("Up Next in Rotation") State & Calculation
  const [showSwitchNextRoutineModal, setShowSwitchNextRoutineModal] = useState(false);
  const [overrideNextRoutine, setOverrideNextRoutine] = useState<Routine | null>(null);

  const nextRoutineInfo = useMemo(() => {
    if (!activeSplit || !activeSplit.routines || activeSplit.routines.length === 0) return null;

    // Find the latest workout log for activeUser that matches a routine in activeSplit
    const lastMatchingLog = userWorkoutLogs.find((l) =>
      activeSplit.routines.some(
        (r) =>
          (l.routineId && r.id === l.routineId) ||
          r.name.trim().toLowerCase() === l.routineName.trim().toLowerCase()
      )
    );

    let nextIndex = 0;
    let lastRoutineName: string | null = null;
    let lastDate: string | null = null;

    if (lastMatchingLog) {
      const matchedIdx = activeSplit.routines.findIndex(
        (r) =>
          (lastMatchingLog.routineId && r.id === lastMatchingLog.routineId) ||
          r.name.trim().toLowerCase() === lastMatchingLog.routineName.trim().toLowerCase()
      );
      if (matchedIdx !== -1) {
        nextIndex = (matchedIdx + 1) % activeSplit.routines.length;
        lastRoutineName = activeSplit.routines[matchedIdx].name;
        lastDate = lastMatchingLog.date;
      }
    }

    const nextRoutine = activeSplit.routines[nextIndex];
    return {
      routine: nextRoutine,
      nextIndex,
      stepNumber: nextIndex + 1,
      totalSteps: activeSplit.routines.length,
      lastRoutineName,
      lastDate,
    };
  }, [activeSplit, userWorkoutLogs]);

  // Full Rolling Rotation Queue for active split:
  // Starts with the UP NEXT routine at position 1 (Hero Card), followed by the subsequent routines.
  // The workout that was just completed naturally moves to the very bottom of the queue.
  const orderedRotationQueue = useMemo(() => {
    if (!activeSplit || !activeSplit.routines || activeSplit.routines.length === 0) return [];

    let startIndex = 0;
    if (overrideNextRoutine) {
      const idx = activeSplit.routines.findIndex((r) => r.id === overrideNextRoutine.id);
      if (idx !== -1) startIndex = idx;
    } else if (nextRoutineInfo) {
      startIndex = nextRoutineInfo.nextIndex;
    }

    const list: { routine: Routine; queuePosition: number; originalIndex: number }[] = [];
    const total = activeSplit.routines.length;
    for (let i = 0; i < total; i++) {
      const rotIdx = (startIndex + i) % total;
      list.push({
        routine: activeSplit.routines[rotIdx],
        queuePosition: i + 1,
        originalIndex: rotIdx,
      });
    }
    return list;
  }, [activeSplit, overrideNextRoutine, nextRoutineInfo]);

  const effectiveNextRoutine = orderedRotationQueue.length > 0 ? orderedRotationQueue[0].routine : null;



  // Filter exercises by muscle group and search query, sorting favorites to top
  const filteredExercises = useMemo(() => {
    return exercises
      .filter((ex) => {
        const matchesMuscle =
          selectedMuscleGroup === 'All'
            ? true
            : selectedMuscleGroup === 'Favorites'
            ? Boolean(ex.isStarred)
            : ex.muscleGroup === selectedMuscleGroup;
        const query = exerciseSearchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          ex.name.toLowerCase().includes(query) ||
          ex.equipment.toLowerCase().includes(query);
        return matchesMuscle && matchesSearch;
      })
      .sort((a, b) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [exercises, selectedMuscleGroup, exerciseSearchQuery]);

  const handleStartWorkout = (routineName: string, exerciseIds: string[], routineId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setOverrideNextRoutine(null);
    router.push({
      pathname: '/active-session',
      params: {
        splitId: activeSplit ? activeSplit.id : 'split_custom',
        routineId: routineId || (activeSplit?.routines.find((r) => r.name === routineName)?.id),
        routineName,
        exerciseIds: JSON.stringify(exerciseIds),
        clientId: managedClient ? managedClient.id : undefined,
        clientName: managedClient ? managedClient.name : undefined,
        startedAt: Date.now().toString(),
      },
    });
  };

  const handleJoinBuddyWorkout = (room: JamRoomData) => {
    setShowJoinBuddyModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/active-session',
      params: {
        splitId: 'split_buddy',
        routineName: room.routineName || 'Buddy Workout',
        exerciseIds: JSON.stringify(room.exerciseIds || []),
        startedAt: Date.now().toString(),
        joinRoomPin: room.roomPin,
      },
    });
  };



  const handleCreateExercise = () => {
    if (!newExName.trim()) {
      Alert.alert('Required', 'Please enter an exercise name.');
      return;
    }
    const created = addExercise({
      workspaceId: activeUser.activeWorkspaceId,
      name: newExName.trim(),
      muscleGroup: newExMuscle,
      equipment: newExEquipment.trim() || 'Custom',
    });
    setNewExName('');
    setNewExEquipment('Barbell');
    setShowAddExModal(false);
    setSelectedMuscleGroup('All');
    setExerciseSearchQuery('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Exercise Created! 🏋️',
      `"${created.name}" is now saved to your Exercise Database and ready to train or assign to your routines.`
    );
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Top Header Segmented Switcher */}
      <View className="bg-dark-bg px-4 pt-2.5 pb-2 border-b border-zinc-900">
        <View className="flex-row bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('schedule');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'schedule' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={activeTab === 'schedule' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'schedule'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              Active Schedule
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('splits');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'splits' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="flash"
              size={13}
              color={activeTab === 'splits' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'splits'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              All Programs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('exercises');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'exercises' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="barbell"
              size={13}
              color={activeTab === 'exercises' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'exercises'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              Exercises
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-dark-bg px-4 py-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {activeTab === 'schedule' && (
          <>
            {/* RIPPED BUDDY Live Co-op Quick Join Card */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowJoinBuddyModal(true);
              }}
              className="bg-zinc-900 border border-cyan-500/40 p-3.5 rounded-2xl mb-4 flex-row items-center justify-between shadow-lg shadow-cyan-500/10"
            >
              <View className="flex-row items-center space-x-3 flex-1 mr-2">
                <View className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/40 items-center justify-center">
                  <Ionicons name="people" size={22} color="#06B6D4" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center space-x-2">
                    <Text className="text-white font-extrabold text-sm tracking-tight" numberOfLines={1}>RIPPED BUDDY</Text>
                    <View className="bg-cyan-500/20 px-1.5 py-0.5 rounded-full border border-cyan-400/40 shrink-0">
                      <Text className="text-[9px] font-black text-cyan-300 uppercase tracking-wider">LIVE CO-OP</Text>
                    </View>
                  </View>
                  <Text className="text-xs text-zinc-400 mt-0.5" numberOfLines={1}>
                    Join your friend's live workout with PIN or QR
                  </Text>
                </View>
              </View>
              <View className="bg-cyan-500 px-3.5 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/25 shrink-0">
                <Ionicons name="enter-outline" size={14} color="#000000" />
                <Text className="text-black font-extrabold text-xs">Join</Text>
              </View>
            </TouchableOpacity>

            {/* ROLLING SPLIT ROTATION QUEUE */}
            {!activeSplit || !activeSplit.routines || activeSplit.routines.length === 0 ? (
              <View className="bg-dark-card border border-zinc-800 p-6 rounded-2xl mb-5 items-center">
                <View className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 items-center justify-center mb-3">
                  <Ionicons name="barbell" size={24} color="#06B6D4" />
                </View>
                <Text className="text-base font-black text-white mb-1 text-center">
                  No Active Split Selected
                </Text>
                <Text className="text-xs text-zinc-400 text-center mb-4 leading-relaxed">
                  Choose or build a training split to start your rolling workout rotation.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setActiveTab('splits');
                  }}
                  className="bg-accent-cyan px-5 py-3 rounded-xl flex-row items-center space-x-2 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="flash" size={16} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs">Select a Split</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* 1. UP NEXT IN ROTATION (Hero Card) */}
                {orderedRotationQueue.length > 0 && (
                  <View className="bg-dark-card border border-cyan-500/40 p-4 rounded-2xl mb-4 shadow-lg shadow-cyan-500/10">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center space-x-1.5 flex-1 min-w-0 mr-2">
                        <View className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                        <Text className="text-[11px] font-extrabold text-accent-cyan uppercase tracking-wider" numberOfLines={1}>
                          Up Next in Rotation
                        </Text>
                      </View>
                      <View className="flex-row items-center space-x-1 bg-cyan-500/15 border border-cyan-400/40 px-2 py-0.5 rounded-full shrink-0">
                        <Text className="text-[9px] font-bold text-cyan-300">
                          Step 1 of {orderedRotationQueue.length}
                        </Text>
                      </View>
                    </View>

                    <View className="mb-3">
                      <Text className="text-xl font-black text-white tracking-tight">
                        {orderedRotationQueue[0].routine.name}
                      </Text>
                      <View className="flex-row items-center space-x-2 mt-1">
                        <Text className="text-xs font-semibold text-zinc-300">
                          {orderedRotationQueue[0].routine.exerciseIds.length} Exercises included
                        </Text>
                        <Text className="text-zinc-600">•</Text>
                        <Text className="text-xs text-zinc-400 font-medium">
                          {activeSplit.name}
                        </Text>
                      </View>

                      {nextRoutineInfo?.lastRoutineName && (
                        <View className="flex-row items-center space-x-1.5 mt-2.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-xl">
                          <Ionicons name="checkmark-circle-outline" size={13} color="#10B981" />
                          <Text className="text-[11px] text-zinc-400">
                            Last finished: <Text className="text-zinc-200 font-bold">{nextRoutineInfo.lastRoutineName}</Text> ({nextRoutineInfo.lastDate})
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Action Row */}
                    <View className="flex-row items-center space-x-2">
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() =>
                          handleStartWorkout(
                            orderedRotationQueue[0].routine.name,
                            orderedRotationQueue[0].routine.exerciseIds,
                            orderedRotationQueue[0].routine.id
                          )
                        }
                        className="flex-1 bg-accent-cyan py-3 rounded-xl flex-row items-center justify-center space-x-2 shadow-md shadow-cyan-500/20"
                      >
                        <Ionicons name="play" size={16} color="#09090B" />
                        <Text className="text-black font-extrabold text-xs tracking-wider">
                          Start Next Workout
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowSwitchNextRoutineModal(true)}
                        className="bg-zinc-850 border border-zinc-750 px-3.5 py-3 rounded-xl flex-row items-center space-x-1"
                      >
                        <Ionicons name="swap-vertical" size={14} color="#A1A1AA" />
                        <Text className="text-xs font-semibold text-zinc-300">Switch</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 2. NEXT DAYS IN ROTATION (Subsequent Routines) */}
                {orderedRotationQueue.length > 1 && (
                  <View className="mb-5">
                    <View className="flex-row items-center justify-between mb-3 px-1">
                      <View className="flex-row items-center space-x-2">
                        <Ionicons name="repeat" size={16} color="#06B6D4" />
                        <Text className="text-xs font-black text-white uppercase tracking-wider">
                          Upcoming in Rotation
                        </Text>
                      </View>
                      <Text className="text-[11px] text-zinc-500 font-semibold">
                        Moves up as you train
                      </Text>
                    </View>

                    {orderedRotationQueue.slice(1).map((item, idx) => {
                      const isPreviouslyFinished = Boolean(
                        nextRoutineInfo?.lastRoutineName &&
                        item.routine.name.trim().toLowerCase() === nextRoutineInfo.lastRoutineName.trim().toLowerCase()
                      );

                      const exNamesPreview = item.routine.exerciseIds
                        .map((id) => exercises.find((e) => e.id === id)?.name)
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(', ');

                      return (
                        <View
                          key={item.routine.id || idx}
                          className={`bg-dark-card border ${
                            isPreviouslyFinished
                              ? 'border-zinc-800/70 bg-zinc-950/70'
                              : 'border-zinc-800'
                          } p-4 rounded-2xl mb-3 shadow-md`}
                        >
                          {/* Top Badge Row */}
                          <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center space-x-2 flex-1 min-w-0 mr-2">
                              <View
                                className={`px-2 py-0.5 rounded-full shrink-0 ${
                                  isPreviouslyFinished
                                    ? 'bg-emerald-500/15 border border-emerald-500/40'
                                    : 'bg-zinc-800 border border-zinc-700'
                                }`}
                              >
                                <Text
                                  className={`text-[10px] font-black ${
                                    isPreviouslyFinished ? 'text-emerald-400' : 'text-zinc-300'
                                  }`}
                                  numberOfLines={1}
                                >
                                  {isPreviouslyFinished
                                    ? 'LAST COMPLETED'
                                    : `Step ${item.queuePosition} of ${orderedRotationQueue.length}`}
                                </Text>
                              </View>

                              <Text className="text-[11px] font-medium text-zinc-500 flex-1" numberOfLines={1} ellipsizeMode="tail">
                                {isPreviouslyFinished
                                  ? 'Moved to bottom'
                                  : `Up in ${idx + 1} workout${idx + 1 > 1 ? 's' : ''}`}
                              </Text>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setOverrideNextRoutine(item.routine);
                              }}
                              className="bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700 flex-row items-center space-x-1 shrink-0"
                            >
                              <Ionicons name="arrow-up" size={11} color="#06B6D4" />
                              <Text className="text-[10px] font-bold text-cyan-400">Make Next</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Routine Title */}
                          <Text className="text-base font-black text-white mb-1 tracking-tight">
                            {item.routine.name}
                          </Text>

                          <Text className="text-xs text-zinc-400 mb-3" numberOfLines={1}>
                            {item.routine.exerciseIds.length} Exercises{exNamesPreview ? ` • ${exNamesPreview}...` : ''}
                          </Text>

                          {/* Action to start this workout */}
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              handleStartWorkout(item.routine.name, item.routine.exerciseIds, item.routine.id)
                            }
                            className="bg-zinc-800/90 border border-zinc-700 py-2.5 px-4 rounded-xl flex-row items-center justify-center space-x-1.5"
                          >
                            <Ionicons name="play" size={14} color="#06B6D4" />
                            <Text className="text-cyan-400 font-extrabold text-xs tracking-wide">
                              Start Workout
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}



      {/* 4. PREVIOUS WORKOUTS & HISTORY */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2 flex-1 mr-2">
            <Ionicons name="time-outline" size={20} color="#06B6D4" />
            <Text className="text-base font-bold text-white" numberOfLines={1}>Previous Workouts</Text>
          </View>
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLogPastWorkoutModal(true);
              }}
              className="bg-cyan-950/60 border border-cyan-500/50 px-2.5 py-1 rounded-lg flex-row items-center space-x-1"
            >
              <Ionicons name="add" size={14} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-400">Log Past</Text>
            </TouchableOpacity>
            <Text className="text-xs font-semibold text-zinc-400">
              {userWorkoutLogs.length} Logged
            </Text>
          </View>
        </View>

        {userWorkoutLogs.length === 0 ? (
          <View className="bg-dark-card border border-dark-border p-5 rounded-2xl items-center">
            <Ionicons name="barbell-outline" size={28} color="#71717A" />
            <Text className="text-xs text-zinc-400 mt-2 text-center">
              No previous workouts logged yet for {activeUser.displayName}.
            </Text>
          </View>
        ) : (
          <>
            {displayedWorkouts.map((log) => {
              const totalSets = log.exercises.reduce(
                (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
                0
              );
              const totalVolume = log.exercises.reduce(
                (acc, ex) =>
                  acc +
                  ex.sets
                    .filter((s) => s.isCompleted)
                    .reduce((sAcc, s) => sAcc + s.weightKg * s.reps, 0),
                0
              );
              const durationDisplay = log.durationSeconds
                ? formatDuration(log.durationSeconds)
                : null;

              return (
                <TouchableOpacity
                  key={log.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedWorkoutLog(log);
                  }}
                  className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-3 shadow-md"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-white mb-0.5" numberOfLines={1}>
                        {log.routineName}
                      </Text>
                      <Text className="text-xs text-zinc-400 font-medium">
                        {log.date}
                      </Text>
                    </View>

                    <View className="flex-row items-center space-x-2">
                      {durationDisplay && (
                        <View className="bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-full flex-row items-center space-x-1">
                          <Ionicons name="stopwatch-outline" size={13} color="#06B6D4" />
                          <Text className="text-xs font-bold text-cyan-400 font-mono">
                            {durationDisplay}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDeleteWorkout(log.id, log.routineName, log.date);
                        }}
                        className="p-1.5 bg-zinc-800 rounded-lg border border-zinc-700/80"
                      >
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between border-t border-zinc-800/80 pt-2.5 mt-1">
                    <View className="flex-row items-center space-x-3">
                      <Text className="text-xs text-zinc-300 font-medium">
                        <Text className="text-accent-cyan font-bold">{log.exercises.length}</Text> Exercises
                      </Text>
                      <Text className="text-zinc-600">•</Text>
                      <Text className="text-xs text-zinc-300 font-medium">
                        <Text className="text-accent-cyan font-bold">{totalSets}</Text> Sets
                      </Text>
                      {totalVolume > 0 && <Text className="text-zinc-600">•</Text>}
                      {totalVolume > 0 && (
                        <Text className="text-xs text-zinc-400 font-medium">
                          {totalVolume.toLocaleString()} {weightUnit}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center space-x-1">
                      <Text className="text-xs font-bold text-accent-cyan">View</Text>
                      <Ionicons name="chevron-forward" size={14} color="#06B6D4" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Show More / Show Less Toggle Button */}
            {userWorkoutLogs.length > 3 && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowAllWorkouts(!showAllWorkouts);
                }}
                className="bg-zinc-900 border border-zinc-800 py-3 rounded-xl items-center flex-row justify-center space-x-1.5 mt-1 mb-2"
              >
                <Text className="text-xs font-bold text-cyan-400">
                  {showAllWorkouts
                    ? 'Show Less'
                    : `Show More (${userWorkoutLogs.length - 3} older workouts)`}
                </Text>
                <Ionicons
                  name={showAllWorkouts ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#06B6D4"
                />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </>
  )}

  {/* TAB 2: ACTIVE SPLIT */}
  {activeTab === 'splits' && (
    <View>
      {/* 1. TOP QUICK ACTIONS TOOLBAR */}
      <View className="flex-row items-center space-x-2.5 mb-4">
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/create-split');
          }}
          activeOpacity={0.8}
          className="flex-1 bg-cyan-500/15 border border-cyan-500/40 py-2.5 px-2 rounded-xl items-center flex-row justify-center space-x-1.5"
        >
          <Ionicons name="add" size={16} color="#06B6D4" />
          <Text className="text-xs font-bold text-cyan-400">New</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setShowImportModal(true);
          }}
          activeOpacity={0.8}
          className="flex-1 bg-zinc-800/90 border border-zinc-700 py-2.5 px-2 rounded-xl items-center flex-row justify-center space-x-1.5"
        >
          <Ionicons name="download-outline" size={15} color="#D4D4D8" />
          <Text className="text-xs font-semibold text-zinc-200">Import</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTopSharePress}
          activeOpacity={0.8}
          className="flex-1 bg-zinc-800/90 border border-zinc-700 py-2.5 px-2 rounded-xl items-center flex-row justify-center space-x-1.5"
        >
          <Ionicons name="share-social-outline" size={15} color="#D4D4D8" />
          <Text className="text-xs font-semibold text-zinc-200">Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTopEditPress}
          activeOpacity={0.8}
          className="flex-1 bg-zinc-800/90 border border-zinc-700 py-2.5 px-2 rounded-xl items-center flex-row justify-center space-x-1.5"
        >
          <Ionicons name="pencil" size={14} color="#D4D4D8" />
          <Text className="text-xs font-semibold text-zinc-200">Edit</Text>
        </TouchableOpacity>
      </View>

      {/* 2. ACTIVE SPLIT ROUTINES */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
        {/* Header Title Row */}
        <View className="flex-row items-center justify-between mb-3.5">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="flash" size={18} color="#06B6D4" />
            <Text className="text-sm font-bold text-accent-cyan uppercase tracking-wider">
              Active Workout Split
            </Text>
          </View>
          {activeSplit && (
            <View className="bg-cyan-500/20 border border-cyan-400/50 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-cyan-400">ACTIVE</Text>
            </View>
          )}
        </View>

        {activeSplit ? (
          <View>
            {/* Split Title & Info (Cleaned up, no crowded middle buttons) */}
            <View className="bg-dark-bg border border-zinc-800/90 rounded-2xl p-4 mb-4">
              <Text className="text-lg font-extrabold text-white tracking-tight">
                {activeSplit.name}
              </Text>
              {activeSplit.description ? (
                <Text className="text-xs text-zinc-400 mt-1" numberOfLines={2}>
                  {activeSplit.description}
                </Text>
              ) : null}
              <Text className="text-[11px] text-zinc-500 mt-1.5 font-medium">
                {activeSplit.routines.length} routines configured for {activeUser.displayName}
              </Text>
            </View>

            {/* Routines in the Active Split */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5 px-0.5">
              Included Routines ({activeSplit.routines.length})
            </Text>

            {activeSplit.routines.map((routine) => (
              <View
                key={routine.id}
                className="bg-dark-bg border border-zinc-800 p-3.5 rounded-xl mb-3 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-white mb-1">{routine.name}</Text>
                  <Text className="text-xs text-zinc-400">
                    {routine.exerciseIds.length} Exercises included
                  </Text>
                </View>

                {/* Single clean Start button - redundant routine-level share removed */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleStartWorkout(routine.name, routine.exerciseIds)}
                  className="bg-accent-cyan px-4 py-2.5 rounded-xl flex-row items-center space-x-1 shadow-sm"
                >
                  <Ionicons name="play" size={16} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs">Start</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View className="py-6 items-center bg-dark-bg rounded-2xl border border-zinc-800 p-4">
            <Text className="text-sm text-zinc-400 mb-4 text-center">
              No active split set for {activeUser.displayName}.
            </Text>
            <View className="flex-row items-center space-x-2">
              <TouchableOpacity
                onPress={() => {
                  if (userSplits.length >= 50) {
                    Alert.alert(
                      'Split Limit Reached (50/50)',
                      'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
                    );
                    return;
                  }
                  Haptics.selectionAsync();
                  router.push('/create-split');
                }}
                className="bg-accent-cyan px-4 py-2.5 rounded-xl"
              >
                <Text className="text-black font-bold text-sm">Create Split</Text>
              </TouchableOpacity>
              {userRole === 'athlete' && userSplits.length === 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    restoreDefaultSplits();
                    Alert.alert('Starter Split Added', 'A standard starter split has been added to your profile.');
                  }}
                  className="bg-cyan-500/20 border border-cyan-500/50 px-3.5 py-2.5 rounded-xl flex-row items-center space-x-1.5"
                >
                  <Ionicons name="refresh-outline" size={15} color="#06B6D4" />
                  <Text className="text-cyan-300 font-bold text-sm">Starter Split</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowImportModal(true);
                }}
                className="bg-zinc-800 border border-zinc-700 px-4 py-2.5 rounded-xl flex-row items-center space-x-1.5"
              >
                <Ionicons name="download-outline" size={15} color="#D4D4D8" />
                <Text className="text-zinc-200 font-medium text-sm">Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* All Saved Splits list */}
      {userSplits.length > 0 && (
        <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
          <View className="flex-row items-center justify-between mb-3.5">
            <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
              All Saved Splits ({userSplits.length} / 50)
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (userSplits.length >= 50) {
                  Alert.alert(
                    'Split Limit Reached (50/50)',
                    'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
                  );
                  return;
                }
                Haptics.selectionAsync();
                router.push('/create-split');
              }}
              className="flex-row items-center space-x-1 py-1 px-2"
            >
              <Ionicons name="add" size={14} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-400">Add New</Text>
            </TouchableOpacity>
          </View>

          {userSplits.map((split) => {
            const isCurrentActive = split.id === activeSplit?.id;
            const totalSplitExercises = (split.routines || []).reduce(
              (acc, r) => acc + (r.exerciseIds?.length || 0),
              0
            );

            return (
              <View
                key={split.id}
                className={`p-4 rounded-2xl mb-3.5 border ${
                  isCurrentActive
                    ? 'bg-zinc-900 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-dark-bg border-zinc-800'
                }`}
              >
                {/* Row 1: Split Name & Favorite Star */}
                <View className="flex-row items-start justify-between mb-1.5">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                      {isCurrentActive && (
                        <View className="bg-cyan-500/20 border border-cyan-400 px-2 py-0.5 rounded-full flex-row items-center space-x-1">
                          <View className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <Text className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">
                            ACTIVE
                          </Text>
                        </View>
                      )}
                      <Text className="text-base font-extrabold text-white leading-snug">
                        {split.name}
                      </Text>
                    </View>
                    <Text className="text-xs text-zinc-400 font-medium">
                      {split.routines.length} routines configured • {totalSplitExercises} exercises
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleStarSplit(split.id);
                    }}
                    className="p-2 rounded-xl bg-zinc-800 border border-zinc-700/80"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={split.isStarred ? 'star' : 'star-outline'}
                      size={15}
                      color={split.isStarred ? '#F59E0B' : '#71717A'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Row 2: Routine Pills Preview (capped at 5) */}
                {split.routines.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 my-2">
                    {split.routines.slice(0, 5).map((r, rIdx) => (
                      <View
                        key={r.id || rIdx}
                        className="bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/50"
                      >
                        <Text className="text-[10px] font-semibold text-zinc-300" numberOfLines={1}>
                          {r.name}
                        </Text>
                      </View>
                    ))}
                    {split.routines.length > 5 && (
                      <View className="bg-zinc-800/50 px-1.5 py-0.5 rounded-md border border-zinc-700/40">
                        <Text className="text-[10px] font-bold text-zinc-400">
                          +{split.routines.length - 5} more
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Row 3: Actions Bar */}
                <View className="flex-row items-center justify-between pt-3 mt-1 border-t border-zinc-800/80">
                  {/* Left: Active Status or Set Active Button */}
                  {isCurrentActive ? (
                    <View className="flex-row items-center space-x-1.5 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl">
                      <Ionicons name="checkmark-circle" size={13} color="#06B6D4" />
                      <Text className="text-xs font-bold text-cyan-300">Currently Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setActiveSplit(split.id);
                      }}
                      className="bg-cyan-500 px-3.5 py-1.5 rounded-xl flex-row items-center space-x-1 shadow-sm"
                    >
                      <Ionicons name="flash" size={12} color="#000000" />
                      <Text className="text-xs font-black text-black">Set Active</Text>
                    </TouchableOpacity>
                  )}

                  {/* Right: Icon Buttons */}
                  <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleShareSplit(split)}
                      className="p-2 rounded-xl bg-zinc-800 border border-zinc-700"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="share-social-outline" size={14} color="#06B6D4" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push({
                          pathname: '/create-split',
                          params: { splitId: split.id },
                        });
                      }}
                      className="p-2 rounded-xl bg-zinc-800 border border-zinc-700"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="pencil" size={14} color="#E4E4E7" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleDeleteSplit(split.id, split.name)}
                      className="p-2 rounded-xl bg-red-500/15 border border-red-500/40"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  )}

  {/* TAB 3: EXERCISE DATABASE */}
  {activeTab === 'exercises' && (
    <View>
      {/* 5. EXERCISE DATABASE HEADER & FILTER */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center space-x-2">
          <Ionicons name="library-outline" size={20} color="#06B6D4" />
          <Text className="text-lg font-bold text-white">Exercise Database</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddExModal(true)}
          className="flex-row items-center bg-cyan-500/15 border border-cyan-500 px-3 py-1.5 rounded-lg"
        >
          <Ionicons name="add-circle" size={16} color="#06B6D4" />
          <Text className="text-xs font-bold text-cyan-400 ml-1">+ Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input for Exercises */}
      <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex-row items-center space-x-2 mb-3">
        <Ionicons name="search-outline" size={16} color="#71717A" />
        <TextInput
          value={exerciseSearchQuery}
          onChangeText={setExerciseSearchQuery}
          placeholder="Search exercises by name or equipment..."
          placeholderTextColor="#71717A"
          className="flex-1 text-white text-xs font-medium"
        />
        {exerciseSearchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#71717A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Muscle Group Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {MUSCLE_GROUPS.map((mg) => {
          const isSelected = selectedMuscleGroup === mg;
          return (
            <TouchableOpacity
              key={mg}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedMuscleGroup(mg);
              }}
              className={`px-3.5 py-2 rounded-full mr-2 border ${
                isSelected
                  ? 'bg-accent-cyan border-cyan-400'
                  : 'bg-dark-card border-zinc-800'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  isSelected ? 'text-black font-bold' : 'text-zinc-400'
                }`}
              >
                {mg}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filtered Exercise Cards */}
      <View className="mb-10">
        {filteredExercises.length === 0 ? (
          <View className="bg-dark-card border border-dark-border p-6 rounded-2xl items-center">
            <Ionicons name="barbell-outline" size={32} color="#71717A" />
            <Text className="text-sm text-zinc-300 font-bold mt-2">No exercises found</Text>
            <Text className="text-xs text-zinc-500 text-center mt-1 mb-4">
              {exerciseSearchQuery
                ? `No exercises matching "${exerciseSearchQuery}".`
                : 'No exercises for this muscle group.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (exerciseSearchQuery) {
                  setNewExName(exerciseSearchQuery);
                }
                setShowAddExModal(true);
              }}
              className="bg-accent-cyan px-4 py-2 rounded-xl flex-row items-center space-x-1"
            >
              <Ionicons name="add-circle" size={16} color="#09090B" />
              <Text className="text-black font-extrabold text-xs">
                + Create {exerciseSearchQuery ? `"${exerciseSearchQuery}"` : 'New Exercise'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredExercises.map((item) => {
            const isCustom = item.id.startsWith('ex_custom');
            return (
              <View
                key={item.id}
                className="bg-dark-card border border-dark-border p-3.5 rounded-xl mb-2.5 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center space-x-1.5 mb-0.5">
                    <Text className="text-sm font-bold text-white">{item.name}</Text>
                    {isCustom && (
                      <View className="bg-cyan-950/80 border border-cyan-500/50 px-1.5 py-0.2 rounded">
                        <Text className="text-[9px] font-bold text-cyan-400 uppercase">Custom</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <View className="bg-zinc-800 px-2 py-0.5 rounded">
                      <Text className="text-[10px] text-zinc-300 font-medium">
                        {item.muscleGroup}
                      </Text>
                    </View>
                    <Text className="text-xs text-zinc-500">• {item.equipment}</Text>
                  </View>
                </View>

                <View className="flex-row items-center space-x-1.5">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleStarExercise(item.id);
                    }}
                    className="p-2 bg-zinc-800/80 rounded-lg border border-zinc-700/60"
                  >
                    <Ionicons
                      name={item.isStarred ? 'star' : 'star-outline'}
                      size={15}
                      color={item.isStarred ? '#F59E0B' : '#71717A'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteExercise(item.id, item.name)}
                    className="p-2 bg-zinc-800/80 rounded-lg border border-zinc-700/60"
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  )}



      {/* SWITCH NEXT ROUTINE MODAL (Rolling Rotation Picker) */}
      {showSwitchNextRoutineModal && (
        <Modal
          visible={showSwitchNextRoutineModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSwitchNextRoutineModal(false)}
        >
          <SafeAreaView className="flex-1 justify-end bg-black/80">
            <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
              <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="swap-vertical" size={20} color="#06B6D4" />
                  <Text className="text-lg font-bold text-white">Switch Next Routine</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowSwitchNextRoutineModal(false)}
                  className="p-1.5 bg-zinc-800 rounded-full"
                >
                  <Ionicons name="close" size={18} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-zinc-400 mb-4">
                Select which routine from <Text className="text-white font-semibold">{activeSplit?.name}</Text> you want to train next in your rotation:
              </Text>

              {overrideNextRoutine && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setOverrideNextRoutine(null);
                    setShowSwitchNextRoutineModal(false);
                  }}
                  className="mb-3.5 p-3 bg-cyan-950/40 border border-cyan-500/50 rounded-xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center space-x-2">
                    <Ionicons name="refresh" size={15} color="#06B6D4" />
                    <Text className="text-xs font-bold text-cyan-400">
                      Reset to Automatic Rotation ({nextRoutineInfo?.routine.name})
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#06B6D4" />
                </TouchableOpacity>
              )}

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                {activeSplit?.routines.map((routine, idx) => {
                  const isSelected = effectiveNextRoutine?.id === routine.id;
                  return (
                    <TouchableOpacity
                      key={routine.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setOverrideNextRoutine(routine);
                        setShowSwitchNextRoutineModal(false);
                      }}
                      activeOpacity={0.7}
                      className={`p-3.5 rounded-xl mb-2.5 flex-row items-center justify-between border ${
                        isSelected
                          ? 'bg-cyan-950/50 border-cyan-400'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <View className="flex-row items-center space-x-3 flex-1 pr-2">
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isSelected ? 'bg-cyan-500' : 'bg-zinc-800'
                          }`}
                        >
                          <Text
                            className={`text-xs font-black ${
                              isSelected ? 'text-black' : 'text-zinc-400'
                            }`}
                          >
                            {idx + 1}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-bold ${
                              isSelected ? 'text-cyan-400' : 'text-white'
                            }`}
                          >
                            {routine.name}
                          </Text>
                          <Text className="text-xs text-zinc-400">
                            {routine.exerciseIds.length} Exercises included
                          </Text>
                        </View>
                      </View>

                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#06B6D4" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowSwitchNextRoutineModal(false)}
                className="bg-zinc-800 py-3 rounded-xl items-center"
              >
                <Text className="text-zinc-300 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* ADD CUSTOM EXERCISE MODAL */}
      {showAddExModal && (
        <Modal visible={showAddExModal} transparent animationType="slide">
          <View className="flex-1 bg-black/80 justify-center px-4">
            <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
              <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-zinc-800">
                <Text className="text-lg font-bold text-white">Add Custom Exercise</Text>
                <TouchableOpacity onPress={() => setShowAddExModal(false)}>
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-zinc-400 mb-1">Exercise Name</Text>
              <TextInput
                value={newExName}
                onChangeText={setNewExName}
                placeholder="e.g. Machine Chest Press"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4"
              />

              <Text className="text-xs text-zinc-400 mb-1">Primary Muscle Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {MUSCLE_GROUPS.filter((m) => m !== 'All').map((mg) => (
                  <TouchableOpacity
                    key={mg}
                    onPress={() => setNewExMuscle(mg as MuscleGroup)}
                    className={`px-3 py-1.5 rounded-lg mr-2 border ${
                      newExMuscle === mg
                        ? 'bg-accent-cyan border-cyan-400'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        newExMuscle === mg ? 'text-black' : 'text-white'
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
                placeholder="e.g. Cable / Dumbbell / Machine"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-6"
              />

              <TouchableOpacity
                onPress={handleCreateExercise}
                className="bg-accent-cyan p-3.5 rounded-xl items-center shadow-lg"
              >
                <Text className="text-black font-extrabold text-base">Save Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Previous Workout Detail Inspection Modal */}
      {selectedWorkoutLog !== null && (
        <Modal
          visible={selectedWorkoutLog !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedWorkoutLog(null)}
        >
          <SafeAreaView className="flex-1 bg-black/85">
            <View className="flex-1 bg-dark-bg border-t border-zinc-800 rounded-t-3xl mt-10 p-4">
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-lg font-extrabold text-white" numberOfLines={1}>
                    {selectedWorkoutLog?.routineName}
                  </Text>
                  <Text className="text-xs text-zinc-400">
                    {selectedWorkoutLog?.date} • {activeUser.displayName}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedWorkoutLog(null)}
                  className="p-1.5 bg-zinc-800 rounded-full border border-zinc-700"
                >
                  <Ionicons name="close" size={20} color="#E4E4E7" />
                </TouchableOpacity>
              </View>

              {/* Quick Stats Chips */}
              {selectedWorkoutLog && (
                <View className="flex-row justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-xl mb-4">
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-zinc-400 font-bold uppercase">Time Elapsed</Text>
                    <View className="flex-row items-center space-x-1 mt-0.5">
                      <Ionicons name="stopwatch" size={13} color="#06B6D4" />
                      <Text className="text-sm font-black text-cyan-400 font-mono">
                        {selectedWorkoutLog.durationSeconds
                          ? formatDuration(selectedWorkoutLog.durationSeconds)
                          : '—'}
                      </Text>
                    </View>
                  </View>
                  <View className="items-center flex-1 border-x border-zinc-800">
                    <Text className="text-[10px] text-zinc-400 font-bold uppercase">Completed Sets</Text>
                    <Text className="text-sm font-black text-white mt-0.5">
                      {selectedWorkoutLog.exercises.reduce(
                        (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
                        0
                      )}
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-zinc-400 font-bold uppercase">Total Volume</Text>
                    <Text className="text-sm font-black text-emerald-400 mt-0.5">
                      {selectedWorkoutLog.exercises
                        .reduce(
                          (acc, ex) =>
                            acc +
                            ex.sets
                              .filter((s) => s.isCompleted)
                              .reduce((sAcc, s) => sAcc + s.weightKg * s.reps, 0),
                          0
                        )
                        .toLocaleString()}{' '}
                      kg
                    </Text>
                  </View>
                </View>
              )}

              {/* Scrollable Exercise Breakdown */}
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {selectedWorkoutLog?.exercises.map((ex, idx) => (
                  <View
                    key={`${ex.exerciseId}_${idx}`}
                    className="bg-dark-card border border-zinc-800/90 rounded-2xl p-4 mb-3 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                      <Text className="text-base font-bold text-white flex-1 mr-2">{ex.exerciseName}</Text>
                      <Text className="text-xs font-semibold text-zinc-400">
                        {ex.sets.filter((s) => s.isCompleted).length} sets
                      </Text>
                    </View>

                    {/* Set Columns Header */}
                    <View className="flex-row justify-between pb-1.5 mb-1 px-1 border-b border-zinc-800/40">
                      <Text className="text-[10px] font-bold text-zinc-500 w-10">SET</Text>
                      <Text className="text-[10px] font-bold text-zinc-500 w-16 text-center">TYPE</Text>
                      <Text className="text-[10px] font-bold text-zinc-500 flex-1 text-center">WEIGHT</Text>
                      <Text className="text-[10px] font-bold text-zinc-500 flex-1 text-center">REPS</Text>
                      <Text className="text-[10px] font-bold text-zinc-500 flex-1 text-right">EST. 1RM</Text>
                    </View>

                    {/* Sets Rows */}
                    {ex.sets.map((s, sIdx) => {
                      const e1RM = calculate1RM(s.weightKg, s.reps);
                      return (
                        <View
                          key={sIdx}
                          className={`flex-row items-center justify-between py-2 px-1 border-b border-zinc-900/60 ${
                            !s.isCompleted ? 'opacity-40' : ''
                          }`}
                        >
                          <Text className="text-xs font-bold text-zinc-400 w-10">#{s.setNumber}</Text>
                          <View className="w-16 items-center">
                            <View
                              className={`px-1.5 py-0.5 rounded ${
                                s.type === 'Warmup'
                                  ? 'bg-amber-950/60 border border-amber-500/40'
                                  : s.type === 'Failure'
                                  ? 'bg-rose-950/60 border border-rose-500/40'
                                  : s.type === 'Drop'
                                  ? 'bg-purple-950/60 border border-purple-500/40'
                                  : 'bg-zinc-800'
                              }`}
                            >
                              <Text
                                className={`text-[9px] font-bold ${
                                  s.type === 'Warmup'
                                    ? 'text-amber-400'
                                    : s.type === 'Failure'
                                    ? 'text-rose-400'
                                    : s.type === 'Drop'
                                    ? 'text-purple-400'
                                    : 'text-zinc-300'
                                }`}
                              >
                                {s.type}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs font-bold text-white flex-1 text-center">
                            {s.weightKg} {weightUnit}
                          </Text>
                          <Text className="text-xs font-bold text-cyan-400 flex-1 text-center">
                            {s.reps} reps
                          </Text>
                          <Text className="text-xs font-bold text-emerald-400 flex-1 text-right">
                            {s.isCompleted && s.weightKg > 0 && s.reps > 0 ? `${e1RM} ${weightUnit}` : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>

              <View className="space-y-2 mt-3">
                <TouchableOpacity
                  onPress={() => setSelectedWorkoutLog(null)}
                  className="bg-zinc-800 border border-zinc-700 py-3 rounded-xl items-center"
                >
                  <Text className="text-zinc-200 font-bold text-sm">Close Inspection</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (selectedWorkoutLog) {
                      handleDeleteWorkout(
                        selectedWorkoutLog.id,
                        selectedWorkoutLog.routineName,
                        selectedWorkoutLog.date
                      );
                    }
                  }}
                  className="bg-rose-950/30 border border-rose-500/40 py-2.5 rounded-xl items-center flex-row justify-center space-x-1.5"
                >
                  <Ionicons name="trash-outline" size={15} color="#F43F5E" />
                  <Text className="text-rose-400 font-bold text-xs">Delete This Workout Log</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Split Picker Modal for Top Toolbar Actions */}
      {splitPickerMode !== null && (
        <Modal
          visible={splitPickerMode !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSplitPickerMode(null)}
        >
          <SafeAreaView className="flex-1 justify-end bg-black/70">
            <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
              {/* Header */}
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
                <View className="flex-row items-center space-x-2">
                  <Ionicons
                    name={splitPickerMode === 'share' ? 'share-social' : 'pencil'}
                    size={20}
                    color="#06B6D4"
                  />
                  <Text className="text-lg font-bold text-white">
                    {splitPickerMode === 'share' ? 'Select Split to Share' : 'Select Split to Edit'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSplitPickerMode(null)}
                  className="p-1.5 bg-zinc-800 rounded-full"
                >
                  <Ionicons name="close" size={18} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-zinc-400 mt-2.5 mb-3.5">
                {splitPickerMode === 'share'
                  ? 'Choose which workout split to generate a share code and QR for:'
                  : 'Choose which workout split you want to modify:'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                {userSplits.map((split) => {
                  const isCurrentActive = split.id === activeSplit?.id;
                  const totalExercises = (split.routines || []).reduce(
                    (acc, r) => acc + (r.exerciseIds?.length || 0),
                    0
                  );

                  return (
                    <TouchableOpacity
                      key={split.id}
                      onPress={() => {
                        const mode = splitPickerMode;
                        setSplitPickerMode(null);
                        if (mode === 'share') {
                          handleShareSplit(split);
                        } else if (mode === 'edit') {
                          Haptics.selectionAsync();
                          router.push({
                            pathname: '/create-split',
                            params: { splitId: split.id },
                          });
                        }
                      }}
                      activeOpacity={0.7}
                      className="bg-dark-bg border border-zinc-800 p-4 rounded-2xl mb-2.5 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center space-x-2 mb-1">
                          <Text className="text-base font-bold text-white" numberOfLines={1}>
                            {split.name}
                          </Text>
                          {isCurrentActive && (
                            <View className="bg-cyan-500/20 border border-cyan-400/60 px-1.5 py-0.5 rounded">
                              <Text className="text-[9px] font-bold text-cyan-400">ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-zinc-400">
                          {split.routines.length} routines • {totalExercises} total exercises
                        </Text>
                      </View>

                      <View className="bg-zinc-800/80 border border-zinc-700/80 p-2 rounded-xl">
                        <Ionicons
                          name={splitPickerMode === 'share' ? 'share-social-outline' : 'chevron-forward'}
                          size={16}
                          color="#06B6D4"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setSplitPickerMode(null)}
                className="bg-zinc-800 py-3 rounded-xl items-center"
              >
                <Text className="text-zinc-300 font-bold text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Log Past Workout Modal */}
      {showLogPastWorkoutModal && (
        <LogPastWorkoutModal
          visible={showLogPastWorkoutModal}
          onClose={() => setShowLogPastWorkoutModal(false)}
        />
      )}

      {/* Workout Split & Routine Share Modal */}
      {showShareModal && (
        <ShareWorkoutModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareCode={sharePayload.code}
          title={sharePayload.title}
          type={sharePayload.type}
          routinesCount={sharePayload.routinesCount}
          exercisesCount={sharePayload.exercisesCount}
          isGenerating={sharePayload.isGenerating}
        />
      )}

      {/* Import Workout Split / Routine Modal */}
      {showImportModal && (
        <ImportWorkoutModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={() => {
            setActiveTab('splits');
          }}
        />
      )}

      {/* RIPPED BUDDY Quick Join Modal */}
      {showJoinBuddyModal && (
        <JoinBuddyWorkoutModal
          visible={showJoinBuddyModal}
          onClose={() => setShowJoinBuddyModal(false)}
          onJoin={handleJoinBuddyWorkout}
        />
      )}
    </ScrollView>
  </View>
  );
}
