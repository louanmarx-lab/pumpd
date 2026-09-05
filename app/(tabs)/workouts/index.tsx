import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace, DAYS_OF_WEEK } from '../../../src/context/UserWorkspaceContext';
import { MuscleGroup, Exercise, DayOfWeek, DaySchedule, WorkoutLog } from '../../../src/types';
import { calculate1RM } from '../../../src/utils/fitness';

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

const MUSCLE_GROUPS: (MuscleGroup | 'All')[] = [
  'All',
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

const DAY_ABBR: Record<DayOfWeek, string> = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
};

// Helper to determine today's day of week
const getTodayDayOfWeek = (): DayOfWeek => {
  const days: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dayIndex = new Date().getDay();
  return days[dayIndex];
};

export default function WorkoutsScreen() {
  const router = useRouter();
  const {
    activeUser,
    splits,
    exercises,
    workoutLogs,
    weeklySchedule,
    updateDaySchedule,
    shiftSplitSchedule,
    addExercise,
    deleteExercise,
    deleteWorkoutLog,
  } = useUserWorkspace();

  const todayDay = getTodayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay);

  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | 'All'>('All');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showAddExModal, setShowAddExModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  // Modals for Weekly Split
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Selected workout log for detailed inspection modal
  const [selectedWorkoutLog, setSelectedWorkoutLog] = useState<WorkoutLog | null>(null);

  // Show only 3 latest workouts by default with show more toggle
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  // Filter workout logs belonging to active user, sorted newest first
  const userWorkoutLogs = workoutLogs
    .filter((l) => l.userId === activeUser.id)
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

  // Filter splits belonging to active user
  const userSplits = splits.filter((s) => s.userId === activeUser.id);
  const activeSplit = userSplits.find((s) => s.isActive) || userSplits[0];

  // Currently inspected day schedule
  const selectedDaySchedule: DaySchedule =
    weeklySchedule.find((item) => item.day === selectedDay) || {
      day: selectedDay,
      routineId: 'rest',
      routineName: 'Rest Day',
      exerciseIds: [],
    };

  const isRestDay = selectedDaySchedule.routineId === 'rest';

  // Filter exercises by muscle group and search query
  const filteredExercises = exercises.filter((ex) => {
    const matchesMuscle =
      selectedMuscleGroup === 'All' || ex.muscleGroup === selectedMuscleGroup;
    const query = exerciseSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      ex.name.toLowerCase().includes(query) ||
      ex.equipment.toLowerCase().includes(query);
    return matchesMuscle && matchesSearch;
  });

  const handleStartWorkout = (routineName: string, exerciseIds: string[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/active-session',
      params: {
        splitId: activeSplit ? activeSplit.id : 'split_custom',
        routineName,
        exerciseIds: JSON.stringify(exerciseIds),
      },
    });
  };

  const handleExecuteShift = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    shiftSplitSchedule(selectedDay);
    setShowShiftModal(false);
    Alert.alert(
      'Schedule Shifted! 🔄',
      `Marked ${selectedDay} as a Rest Day. Your remaining routines have been shifted forward by 1 day.`
    );
  };

  const handleAssignRoutine = (routineId: string, routineName: string, exerciseIds: string[] = []) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateDaySchedule(selectedDay, routineId, routineName, exerciseIds);
    setShowAssignModal(false);
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
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* 1. WEEKLY MONDAY-TO-SUNDAY STRIP */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="calendar" size={18} color="#06B6D4" />
            <Text className="text-sm font-bold text-accent-cyan uppercase tracking-wider">
              Weekly Split Schedule
            </Text>
          </View>
          <Text className="text-xs text-zinc-400 font-medium">Mon — Sun</Text>
        </View>

        {/* Monday to Sunday Day Selector Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayDay;
            const isSelected = day === selectedDay;
            const daySched = weeklySchedule.find((s) => s.day === day);
            const isDayRest = !daySched || daySched.routineId === 'rest';

            return (
              <TouchableOpacity
                key={day}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedDay(day);
                }}
                activeOpacity={0.8}
                className={`w-[68px] py-2.5 px-1 rounded-xl mr-2 items-center border ${
                  isSelected
                    ? 'bg-cyan-950/70 border-cyan-400'
                    : isToday
                    ? 'bg-zinc-900 border-cyan-500/50'
                    : 'bg-zinc-900/80 border-zinc-800'
                }`}
              >
                {/* TODAY Badge */}
                {isToday && (
                  <View className="bg-cyan-500 px-1.5 py-0.5 rounded-full mb-1">
                    <Text className="text-[8px] font-extrabold text-black uppercase tracking-tighter">
                      TODAY
                    </Text>
                  </View>
                )}

                <Text
                  className={`text-xs font-bold mb-1 ${
                    isSelected ? 'text-cyan-400' : isToday ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {DAY_ABBR[day]}
                </Text>

                {/* Workout or Rest Icon */}
                <View
                  className={`w-7 h-7 rounded-full items-center justify-center mb-1 ${
                    isDayRest ? 'bg-zinc-800' : 'bg-cyan-500/20'
                  }`}
                >
                  <Ionicons
                    name={isDayRest ? 'moon-outline' : 'barbell'}
                    size={14}
                    color={isDayRest ? '#71717A' : '#06B6D4'}
                  />
                </View>

                {/* Short Label */}
                <Text
                  numberOfLines={1}
                  className={`text-[9px] font-medium text-center ${
                    isDayRest ? 'text-zinc-500' : 'text-zinc-300'
                  }`}
                >
                  {isDayRest ? 'Rest' : daySched?.routineName.split(' ')[0] || 'Split'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Day Workout Focus Card */}
        <View className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl mt-2">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <Text className="text-base font-bold text-white">{selectedDay}</Text>
              {selectedDay === todayDay && (
                <View className="bg-cyan-500/20 border border-cyan-400 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-cyan-400">TODAY'S PLAN</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setShowAssignModal(true)}
              className="bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700"
            >
              <Text className="text-[11px] font-semibold text-cyan-400">Edit Day</Text>
            </TouchableOpacity>
          </View>

          {!isRestDay ? (
            <View>
              <Text className="text-sm font-bold text-cyan-400 mb-1">
                {selectedDaySchedule.routineName}
              </Text>
              <Text className="text-xs text-zinc-400 mb-4">
                {selectedDaySchedule.exerciseIds?.length || 4} Exercises scheduled for this session
              </Text>

              {/* Cyan Action Buttons */}
              <View className="flex-row space-x-2">
                {/* Start Workout Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    handleStartWorkout(
                      selectedDaySchedule.routineName,
                      selectedDaySchedule.exerciseIds || ['ex_1', 'ex_2']
                    )
                  }
                  className="flex-1 bg-accent-cyan py-3 px-3 rounded-xl flex-row items-center justify-center space-x-1.5 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="play" size={16} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs tracking-wide">
                    Start Workout
                  </Text>
                </TouchableOpacity>

                {/* Rest & Shift Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowShiftModal(true)}
                  className="flex-1 bg-cyan-950/40 border border-cyan-500/60 py-3 px-3 rounded-xl flex-row items-center justify-center space-x-1"
                >
                  <Ionicons name="swap-horizontal" size={16} color="#06B6D4" />
                  <Text className="text-cyan-400 font-bold text-xs tracking-tight">
                    Rest & Shift Split
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="py-2">
              <View className="flex-row items-center space-x-2 mb-2">
                <Ionicons name="sparkles" size={18} color="#06B6D4" />
                <Text className="text-sm font-semibold text-zinc-300">
                  Rest & Muscle Recovery Day
                </Text>
              </View>
              <Text className="text-xs text-zinc-500 mb-3">
                Rest is essential for muscle hypertrophy, tendon repair, and glycogen replenishment.
              </Text>
              <TouchableOpacity
                onPress={() => setShowAssignModal(true)}
                className="bg-zinc-800 border border-zinc-700 py-3 px-4 rounded-xl flex-row items-center justify-center space-x-1.5"
              >
                <Ionicons name="add-circle-outline" size={16} color="#06B6D4" />
                <Text className="text-xs font-bold text-cyan-400">
                  + Add Workout to {selectedDay}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 2. ACTIVE SPLIT ROUTINES */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2 flex-1 mr-2">
            <Ionicons name="flash-outline" size={20} color="#06B6D4" />
            <Text className="text-sm font-semibold text-accent-cyan uppercase tracking-wider" numberOfLines={1}>
              Active Workout Split
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/create-split')}
            className="flex-row items-center bg-cyan-500/15 border border-cyan-500/60 px-3 py-1.5 rounded-lg"
          >
            <Ionicons name="layers-outline" size={15} color="#06B6D4" />
            <Text className="text-xs font-bold text-cyan-400 ml-1.5">New Split</Text>
          </TouchableOpacity>
        </View>

        {activeSplit ? (
          <View>
            <Text className="text-xl font-bold text-white mb-2">{activeSplit.name}</Text>
            <Text className="text-xs text-zinc-400 mb-3">
              Routines configured for {activeUser.displayName}:
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
          <View className="py-4 items-center">
            <Text className="text-sm text-zinc-400 mb-3">No active split set for {activeUser.displayName}.</Text>
            <TouchableOpacity
              onPress={() => router.push('/create-split')}
              className="bg-accent-cyan px-4 py-2.5 rounded-xl"
            >
              <Text className="text-black font-bold text-sm">Create First Split</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. QUICK FREE TRAINING SESSION */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          handleStartWorkout('Quick Training Session', ['ex_1', 'ex_4', 'ex_8', 'ex_13'])
        }
        className="bg-zinc-800/80 border border-zinc-700 p-4 rounded-2xl mb-6 flex-row items-center justify-between shadow-lg"
      >
        <View className="flex-row items-center space-x-3">
          <View className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500 items-center justify-center">
            <Ionicons name="play-circle" size={26} color="#06B6D4" />
          </View>
          <View>
            <Text className="text-base font-bold text-white">Free Session Workout</Text>
            <Text className="text-xs text-zinc-400">Log training without pre-set split</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#06B6D4" />
      </TouchableOpacity>

      {/* 4. PREVIOUS WORKOUTS & HISTORY */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="time-outline" size={20} color="#06B6D4" />
            <Text className="text-lg font-bold text-white">Previous Workouts</Text>
          </View>
          <Text className="text-xs font-semibold text-zinc-400">
            {userWorkoutLogs.length} Logged
          </Text>
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
                      {totalVolume > 0 && (
                        <>
                          <Text className="text-zinc-600">•</Text>
                          <Text className="text-xs text-zinc-400 font-medium">
                            {totalVolume.toLocaleString()} kg
                          </Text>
                        </>
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

                <View className="flex-row items-center space-x-2">
                  {isCustom && (
                    <TouchableOpacity
                      onPress={() => handleDeleteExercise(item.id, item.name)}
                      className="p-2 bg-zinc-800/80 rounded-lg border border-zinc-700/60"
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleStartWorkout(item.name, [item.id])}
                    className="bg-zinc-800 border border-cyan-500/40 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-xs font-bold text-cyan-400">Train This</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* REST & SHIFT SPLIT CONFIRMATION MODAL */}
      <Modal visible={showShiftModal} transparent animationType="fade">
        <View className="flex-1 bg-black/85 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl shadow-2xl">
            <View className="flex-row items-center space-x-2 mb-3 border-b border-zinc-800 pb-3">
              <Ionicons name="swap-horizontal" size={22} color="#06B6D4" />
              <Text className="text-lg font-bold text-white">Shift Split Schedule</Text>
            </View>

            <Text className="text-sm text-zinc-300 mb-3 leading-5">
              Could not train today? Mark <Text className="font-bold text-white">{selectedDay}</Text> as a Rest Day, and push <Text className="font-bold text-cyan-400">"{selectedDaySchedule.routineName}"</Text> to tomorrow.
            </Text>

            <View className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 mb-5">
              <Text className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wide">
                Schedule Adjustment Preview:
              </Text>
              <Text className="text-xs text-zinc-400 mb-1">
                • <Text className="font-bold text-white">{selectedDay}:</Text> Changes to <Text className="text-emerald-400 font-semibold">Rest Day</Text>
              </Text>
              <Text className="text-xs text-zinc-400">
                • <Text className="font-bold text-white">Next Days:</Text> Current routine & subsequent splits cascade forward by 1 day.
              </Text>
            </View>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowShiftModal(false)}
                className="flex-1 bg-zinc-800 py-3 rounded-xl items-center"
              >
                <Text className="text-xs font-bold text-zinc-300">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExecuteShift}
                className="flex-1 bg-accent-cyan py-3 rounded-xl items-center shadow-lg shadow-cyan-500/20"
              >
                <Text className="text-black font-extrabold text-xs">Confirm & Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ASSIGN / EDIT ROUTINE MODAL */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View className="flex-1 bg-black/85 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <Text className="text-lg font-bold text-white">Assign Split for {selectedDay}</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4">
              {/* Option to set as Rest Day */}
              <TouchableOpacity
                onPress={() => handleAssignRoutine('rest', 'Rest Day', [])}
                className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center space-x-3">
                  <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
                    <Ionicons name="moon-outline" size={16} color="#A1A1AA" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-white">Rest Day</Text>
                    <Text className="text-xs text-zinc-400">Recovery & Off-day</Text>
                  </View>
                </View>
                {selectedDaySchedule.routineId === 'rest' && (
                  <Ionicons name="checkmark-circle" size={20} color="#06B6D4" />
                )}
              </TouchableOpacity>

              {/* Routines from active split */}
              {activeSplit?.routines.map((routine) => (
                <TouchableOpacity
                  key={routine.id}
                  onPress={() =>
                    handleAssignRoutine(routine.id, routine.name, routine.exerciseIds)
                  }
                  className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2.5 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center space-x-3">
                    <View className="w-8 h-8 rounded-full bg-cyan-500/20 items-center justify-center">
                      <Ionicons name="barbell" size={16} color="#06B6D4" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-white">{routine.name}</Text>
                      <Text className="text-xs text-zinc-400">
                        {routine.exerciseIds.length} Exercises included
                      </Text>
                    </View>
                  </View>
                  {selectedDaySchedule.routineId === routine.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#06B6D4" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Add Custom Exercise Shortcut */}
              <TouchableOpacity
                onPress={() => {
                  setShowAssignModal(false);
                  setShowAddExModal(true);
                }}
                className="p-3 bg-zinc-900/60 border border-dashed border-cyan-500/40 rounded-xl mb-2.5 flex-row items-center justify-center space-x-2"
              >
                <Ionicons name="add-circle" size={18} color="#06B6D4" />
                <Text className="text-xs font-bold text-cyan-400">+ Create New Exercise</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADD CUSTOM EXERCISE MODAL */}
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

      {/* Previous Workout Detail Inspection Modal */}
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
                          {s.weightKg} kg
                        </Text>
                        <Text className="text-xs font-bold text-cyan-400 flex-1 text-center">
                          {s.reps} reps
                        </Text>
                        <Text className="text-xs font-bold text-emerald-400 flex-1 text-right">
                          {s.isCompleted && s.weightKg > 0 && s.reps > 0 ? `${e1RM} kg` : '—'}
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
    </ScrollView>
  );
}
