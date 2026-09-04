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
import { SetType, SetLog, LoggedExercise, Exercise } from '../src/types';
import { calculate1RM, getExerciseHistory } from '../src/utils/fitness';

const SET_TYPES: SetType[] = ['Normal', 'Warmup', 'Drop', 'Failure'];

export default function ActiveSessionScreen() {
  // Keep screen awake during workout session
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    splitId?: string;
    routineName?: string;
    exerciseIds?: string;
  }>();

  const { activeUser, activeWorkspace, exercises, workoutLogs, saveWorkoutLog } =
    useUserWorkspace();

  const routineTitle = params.routineName || 'Gym Workout Session';
  const initialIds: string[] = params.exerciseIds ? JSON.parse(params.exerciseIds) : ['ex_1'];

  // Local workout session state
  const [sessionExercises, setSessionExercises] = useState<LoggedExercise[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);

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

  // Initialize session exercise cards
  useEffect(() => {
    const initialList: LoggedExercise[] = initialIds.map((id) => {
      const exDef = exercises.find((e) => e.id === id);
      return {
        exerciseId: id,
        exerciseName: exDef ? exDef.name : 'Barbell Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 40, reps: 10, isCompleted: false },
          { setNumber: 2, type: 'Normal', weightKg: 70, reps: 8, isCompleted: false },
          { setNumber: 3, type: 'Normal', weightKg: 75, reps: 6, isCompleted: false },
        ],
      };
    });
    setSessionExercises(initialList);
  }, []);

  // Set mutation functions
  const handleUpdateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof SetLog,
    value: any
  ) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      ex.sets = sets;
      updated[exIndex] = ex;
      return updated;
    });
  };

  const handleToggleComplete = (exIndex: number, setIndex: number) => {
    const currentCompleted = sessionExercises[exIndex].sets[setIndex].isCompleted;
    if (!currentCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleUpdateSet(exIndex, setIndex, 'isCompleted', !currentCompleted);
  };

  const handleAddSet = (exIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIndex] };
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: SetLog = {
        setNumber: ex.sets.length + 1,
        type: 'Normal',
        weightKg: lastSet ? lastSet.weightKg : 50,
        reps: lastSet ? lastSet.reps : 8,
        isCompleted: false,
      };
      ex.sets = [...ex.sets, newSet];
      updated[exIndex] = ex;
      return updated;
    });
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIndex] };
      if (ex.sets.length <= 1) return prev;
      const filtered = ex.sets.filter((_, idx) => idx !== setIndex);
      ex.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
      updated[exIndex] = ex;
      return updated;
    });
  };

  const handleSwapExercise = (newEx: Exercise) => {
    if (swapTargetIndex === null) return;
    setSessionExercises((prev) => {
      const updated = [...prev];
      updated[swapTargetIndex] = {
        exerciseId: newEx.id,
        exerciseName: newEx.name,
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 20, reps: 10, isCompleted: false },
          { setNumber: 2, type: 'Normal', weightKg: 40, reps: 8, isCompleted: false },
        ],
      };
      return updated;
    });
    setShowSwapModal(false);
    setSwapTargetIndex(null);
  };

  const handleFinishWorkout = () => {
    // Check completed sets
    const totalCompletedSets = sessionExercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
      0
    );

    if (totalCompletedSets === 0) {
      Alert.alert(
        'Empty Session',
        'Please complete at least one set before finishing the workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // Stop timer
    setIsTimerRunning(false);

    saveWorkoutLog({
      userId: activeUser.id,
      workspaceId: activeWorkspace.id,
      splitId: params.splitId || 'split_custom',
      routineName: routineTitle,
      date: todayDate,
      timestamp: Date.now(),
      durationSeconds: secondsElapsed,
      exercises: sessionExercises,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Workout Complete! 💪',
      `Logged ${totalCompletedSets} sets in ${formatDuration(secondsElapsed)} for ${activeUser.displayName}.`,
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

        {/* Scrollable Exercise Cards */}
        <ScrollView className="flex-1 px-3 py-4" showsVerticalScrollIndicator={false}>
          {sessionExercises.map((exItem, exIdx) => {
            // Find current user's history for this exercise
            const firstSetWeight = exItem.sets[0]?.weightKg || 0;
            const history = getExerciseHistory(workoutLogs, exItem.exerciseId, firstSetWeight);

            return (
              <View
                key={`${exItem.exerciseId}_${exIdx}`}
                className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md"
              >
                {/* Exercise Title & Swap Button */}
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                  <View className="flex-1 pr-2">
                    <Text className="text-lg font-bold text-white">{exItem.exerciseName}</Text>
                    <Text className="text-xs text-zinc-400">
                      Persona:{' '}
                      <Text className="text-accent-orange font-semibold">
                        {activeUser.displayName}
                      </Text>
                    </Text>
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
        </ScrollView>

        {/* Swap Exercise Modal */}
        <Modal visible={showSwapModal} transparent animationType="slide">
          <View className="flex-1 bg-black/80 justify-end">
            <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
              <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <Text className="text-lg font-bold text-white">Swap Exercise</Text>
                <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>
              <ScrollView className="mb-4">
                {exercises.map((ex) => (
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
