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
    exerciseIds?: string;
  }>();

  const {
    currentUser,
    partnerUser,
    activeUser,
    activeWorkspace,
    exercises,
    workoutLogs,
    saveWorkoutLog,
    addExercise,
    switchActiveUser,
  } = useUserWorkspace();

  const routineTitle = params.routineName || 'Gym Workout Session';
  const initialIds: string[] = params.exerciseIds ? JSON.parse(params.exerciseIds) : ['ex_1'];

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

  // Active workout timer (starts automatically on mount, stops on finish)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  useEffect(() => {
    if (!isTimerRunning) return;
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimerRunning]);

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Initialize independent session exercise cards for both users
  useEffect(() => {
    const initialMap: Record<string, LoggedExercise[]> = {
      [currentUser.id]: buildInitialExercisesForUser(currentUser.id),
    };
    if (partnerUser) {
      initialMap[partnerUser.id] = buildInitialExercisesForUser(partnerUser.id);
    }
    setUserExercisesMap(initialMap);
  }, []);

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

  const handleToggleComplete = (exIndex: number, setIndex: number) => {
    const currentCompleted = currentSessionExercises[exIndex]?.sets[setIndex]?.isCompleted || false;
    if (!currentCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleUpdateSet(exIndex, setIndex, 'isCompleted', !currentCompleted);
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

  const handleAddExerciseToSession = (ex: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const userIds = Object.keys(nextMap);
      if (!userIds.includes(currentUser.id)) userIds.push(currentUser.id);
      if (partnerUser && !userIds.includes(partnerUser.id)) userIds.push(partnerUser.id);

      userIds.forEach((uId) => {
        const userList = nextMap[uId] ? [...nextMap[uId]] : buildInitialExercisesForUser(uId);
        const newLoggedEx: LoggedExercise = {
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [
            { setNumber: 1, type: 'Warmup', weightKg: 20, reps: 10, isCompleted: false },
            { setNumber: 2, type: 'Normal', weightKg: 40, reps: 8, isCompleted: false },
            { setNumber: 3, type: 'Normal', weightKg: 50, reps: 8, isCompleted: false },
          ],
        };
        nextMap[uId] = [...userList, newLoggedEx];
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

  const handleFinishWorkout = () => {
    const userIds = [currentUser.id];
    if (partnerUser) userIds.push(partnerUser.id);

    const completedByUser: Record<string, number> = {};
    const exercisesByUser: Record<string, LoggedExercise[]> = {};

    userIds.forEach((uId) => {
      const exList = userExercisesMap[uId] || [];
      const completed = exList.reduce(
        (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
        0
      );
      completedByUser[uId] = completed;
      exercisesByUser[uId] = exList;
    });

    const totalCompletedAll = Object.values(completedByUser).reduce((a, b) => a + b, 0);

    if (totalCompletedAll === 0) {
      Alert.alert(
        'Empty Session',
        'Please complete at least one set before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    setIsTimerRunning(false);

    const savedSummaries: string[] = [];

    userIds.forEach((uId) => {
      if (completedByUser[uId] > 0) {
        const profile = uId === currentUser.id ? currentUser : partnerUser;
        saveWorkoutLog({
          userId: uId,
          workspaceId: activeWorkspace.id,
          splitId: params.splitId || 'split_custom',
          routineName: routineTitle,
          date: todayDate,
          timestamp: Date.now(),
          durationSeconds: secondsElapsed,
          exercises: exercisesByUser[uId],
        });
        if (profile) {
          savedSummaries.push(`${profile.displayName} (${completedByUser[uId]} sets)`);
        }
      }
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Workout Complete! 💪',
      `Logged workout in ${formatDuration(secondsElapsed)} for:\n• ${savedSummaries.join('\n• ')}`,
      [{ text: 'Great Job!', onPress: () => router.back() }]
    );
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
              {/* Live Stopwatch Badge */}
              <View className="flex-row items-center space-x-1 mt-0.5">
                <Ionicons name="stopwatch" size={12} color="#06B6D4" />
                <Text className="text-xs font-black text-accent-cyan font-mono">
                  {formatDuration(secondsElapsed)}
                </Text>
              </View>
            </View>
          </View>

          {/* Right Controls: Switcher & Finish */}
          <View className="flex-row items-center space-x-2">
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

        {/* Partner Duo Turn Bar */}
        {partnerUser && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5">
              <Ionicons name="barbell" size={14} color="#06B6D4" />
              <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Whose Turn:
              </Text>
            </View>

            <View className="flex-row bg-zinc-950 p-0.5 rounded-xl border border-zinc-800">
              <TouchableOpacity
                onPress={() => {
                  if (activeUser.id !== currentUser.id) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    switchActiveUser(currentUser.id);
                  }
                }}
                className={`flex-row items-center px-3 py-1.5 rounded-lg ${
                  activeUser.id === currentUser.id ? 'bg-cyan-500' : 'bg-transparent'
                }`}
              >
                <Ionicons
                  name="person"
                  size={12}
                  color={activeUser.id === currentUser.id ? '#000000' : '#71717A'}
                />
                <Text
                  className={`text-xs ml-1.5 ${
                    activeUser.id === currentUser.id
                      ? 'text-black font-extrabold'
                      : 'text-zinc-400 font-semibold'
                  }`}
                >
                  {currentUser.displayName.split(' ')[0]} ({getCompletedCountForUser(currentUser.id)} sets)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (activeUser.id !== partnerUser.id) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    switchActiveUser(partnerUser.id);
                  }
                }}
                className={`flex-row items-center px-3 py-1.5 rounded-lg ${
                  activeUser.id === partnerUser.id ? 'bg-purple-500' : 'bg-transparent'
                }`}
              >
                <Ionicons
                  name="person"
                  size={12}
                  color={activeUser.id === partnerUser.id ? '#FFFFFF' : '#71717A'}
                />
                <Text
                  className={`text-xs ml-1.5 ${
                    activeUser.id === partnerUser.id
                      ? 'text-white font-extrabold'
                      : 'text-zinc-400 font-semibold'
                  }`}
                >
                  {partnerUser.displayName.split(' ')[0]} ({getCompletedCountForUser(partnerUser.id)} sets)
                </Text>
              </TouchableOpacity>
            </View>
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
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          partnerUser && activeUser.id === partnerUser.id
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-cyan-500/20 border border-cyan-500/50'
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            partnerUser && activeUser.id === partnerUser.id
                              ? 'text-purple-300'
                              : 'text-cyan-300'
                          }`}
                        >
                          {activeUser.displayName}
                        </Text>
                      </View>
                    </View>
                  </View>
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

                {/* Historical Benchmarks Card */}
                <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 mb-4">
                  <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Benchmark Reference ({activeUser.displayName})
                  </Text>
                  <View className="flex-row justify-between items-center">
                    {/* Previous Session */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-[10px] text-zinc-500 font-medium">Prev Session</Text>
                      {history.previousSessionSets.length > 0 ? (
                        <Text className="text-xs font-bold text-zinc-200">
                          {history.previousSessionSets[0].weightKg}kg × {history.previousSessionSets[0].reps} ({history.previousSessionSets.length} sets)
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
                          className="bg-zinc-950 border border-zinc-800 text-white text-center py-1.5 px-2 rounded-lg font-bold text-sm"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
