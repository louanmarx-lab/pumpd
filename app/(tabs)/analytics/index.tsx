import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import {
  calculate1RM,
  calculateWeeklyVolume,
  getExerciseHistory,
  getExerciseProgression,
} from '../../../src/utils/fitness';
import { MuscleGroup, WorkoutLog, Exercise } from '../../../src/types';

type AnalyticsTab = 'calendar' | 'progress' | 'body';
type BodyMetricType = 'weight' | 'bodyFat' | 'muscle';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatDuration = (totalSec?: number) => {
  if (!totalSec) return '—';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  return `${secs}s`;
};

const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function AnalyticsScreen() {
  const {
    currentUser,
    partnerUser,
    activeUser,
    switchActiveUser,
    workoutLogs,
    exercises,
    bodyMetrics,
    addBodyMetric,
    deleteBodyMetric,
  } = useUserWorkspace();

  // Top Segmented Tab Switcher
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('calendar');

  // ==========================================
  // 1. CALENDAR STATE & HELPERS
  // ==========================================
  const today = new Date();
  const todayStr = formatDateToISO(today);

  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Quick toggle between active persona and partner in Calendar view
  const [calendarUserId, setCalendarUserId] = useState<string>(activeUser.id);

  // Ensure calendarUserId updates if activeUser changes externally
  React.useEffect(() => {
    setCalendarUserId(activeUser.id);
  }, [activeUser.id]);

  const handlePrevMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  // Build days grid for displayed month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Monday as first day of week: (0 Sunday -> 6, 1 Mon -> 0, etc.)
    const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;

    const days: ({ dayNumber: number; dateStr: string; isCurrentMonth: boolean } | null)[] = [];

    // Empty padding slots for days before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
      });
    }

    return days;
  }, [calYear, calMonth]);

  // Fast lookups for workout dates by user
  const userWorkoutDateSet = useMemo(() => {
    const set = new Set<string>();
    workoutLogs.forEach((l) => {
      if (l.userId === activeUser.id) set.add(l.date);
    });
    return set;
  }, [workoutLogs, activeUser.id]);

  const partnerWorkoutDateSet = useMemo(() => {
    const set = new Set<string>();
    if (partnerUser) {
      workoutLogs.forEach((l) => {
        if (l.userId === partnerUser.id) set.add(l.date);
      });
    }
    return set;
  }, [workoutLogs, partnerUser]);

  // Workouts on the selected calendar date for the inspected user
  const selectedDayWorkouts = useMemo(() => {
    return workoutLogs.filter(
      (l) => l.date === selectedDate && l.userId === calendarUserId
    );
  }, [workoutLogs, selectedDate, calendarUserId]);

  // ==========================================
  // 2. PROGRESSION & SEARCH STATE
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExId, setSelectedExId] = useState<string>('ex_1');
  const [showExPickerModal, setShowExPickerModal] = useState(false);
  const [progressMetric, setProgressMetric] = useState<'1rm' | 'weight' | 'volume'>('1rm');

  // Filtered exercises for picker modal
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const q = searchQuery.toLowerCase();
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
    );
  }, [exercises, searchQuery]);

  const selectedExercise = useMemo(() => {
    return exercises.find((e) => e.id === selectedExId) || exercises[0];
  }, [exercises, selectedExId]);

  // Active user's logs for progression
  const activeUserLogs = useMemo(() => {
    return workoutLogs.filter((l) => l.userId === activeUser.id);
  }, [workoutLogs, activeUser.id]);

  const exerciseProgression = useMemo(() => {
    if (!selectedExercise) return [];
    return getExerciseProgression(activeUserLogs, selectedExercise.id);
  }, [activeUserLogs, selectedExercise]);

  const exerciseHistory = useMemo(() => {
    if (!selectedExercise) {
      return {
        previousSessionSets: [],
        maxRepsAtWeight: 0,
        estimated1RM: 0,
      };
    }
    return getExerciseHistory(activeUserLogs, selectedExercise.id);
  }, [activeUserLogs, selectedExercise]);

  const totalExerciseVolume = useMemo(() => {
    return exerciseProgression.reduce((acc, p) => acc + p.totalVolumeKg, 0);
  }, [exerciseProgression]);

  // ==========================================
  // 3. BODY COMPOSITION & WEIGH-IN STATE
  // ==========================================
  const [activeBodyMetricTab, setActiveBodyMetricTab] = useState<BodyMetricType>('weight');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newMuscleMass, setNewMuscleMass] = useState('');

  const userMetrics = useMemo(() => {
    return bodyMetrics
      .filter((m) => m.userId === activeUser.id)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyMetrics, activeUser.id]);

  const handleAddWeight = () => {
    const w = parseFloat(newWeight);
    if (!w || w <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid weight in kg.');
      return;
    }
    const bf = newBodyFat ? parseFloat(newBodyFat) : undefined;
    const smm = newMuscleMass ? parseFloat(newMuscleMass) : undefined;

    addBodyMetric(w, bf, smm);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewWeight('');
    setNewBodyFat('');
    setNewMuscleMass('');
    setShowWeightModal(false);
  };

  const handleDeleteMetric = (metricId: string, date: string, weightKg: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Weigh-In Entry',
      `Delete record for ${date} (${weightKg} kg)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBodyMetric(metricId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // 7-Day Muscle Volume Breakdown
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentLogs = useMemo(() => {
    return activeUserLogs.filter((l) => l.timestamp >= sevenDaysAgo);
  }, [activeUserLogs, sevenDaysAgo]);

  const weeklyVolume: Record<MuscleGroup, number> = useMemo(() => {
    const map: Record<MuscleGroup, number> = {
      Chest: 0,
      Back: 0,
      Quads: 0,
      Hamstrings: 0,
      Shoulders: 0,
      Biceps: 0,
      Triceps: 0,
      Calves: 0,
      Abs: 0,
    };
    recentLogs.forEach((log) => {
      log.exercises.forEach((ex) => {
        const def = exercises.find((e) => e.id === ex.exerciseId);
        if (def) {
          const completedSets = ex.sets.filter((s) => s.isCompleted).length;
          map[def.muscleGroup] = (map[def.muscleGroup] || 0) + completedSets;
        }
      });
    });
    return map;
  }, [recentLogs, exercises]);

  const volumeEntries = Object.entries(weeklyVolume) as [MuscleGroup, number][];
  const maxVolume = Math.max(1, ...volumeEntries.map(([, v]) => v));

  // Current calendar user display name
  const inspectedUserName =
    calendarUserId === activeUser.id
      ? activeUser.displayName
      : partnerUser?.displayName || 'User';

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Top Segmented Header Switcher */}
      <View className="bg-dark-bg px-4 pt-2.5 pb-2 border-b border-zinc-900">
        <View className="flex-row bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
          {/* Calendar Tab */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('calendar');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'calendar' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="calendar"
              size={13}
              color={activeTab === 'calendar' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'calendar'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              Calendar
            </Text>
          </TouchableOpacity>

          {/* Progress Tab */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('progress');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'progress' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="trending-up"
              size={13}
              color={activeTab === 'progress' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'progress'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              Progress
            </Text>
          </TouchableOpacity>

          {/* Body & Volume Tab */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('body');
            }}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center space-x-1.5 ${
              activeTab === 'body' ? 'bg-cyan-500 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="scale"
              size={13}
              color={activeTab === 'body' ? '#000000' : '#A1A1AA'}
            />
            <Text
              className={`text-xs ${
                activeTab === 'body'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 font-semibold'
              }`}
            >
              Body & Volume
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 py-3"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ========================================================================= */}
        {/* TAB 1: 📅 CALENDAR VIEW                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'calendar' && (
          <View>
            {/* Month Header with Controls */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-lg font-black text-white">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </Text>
                  <Text className="text-[11px] text-zinc-400">
                    Tap any day to inspect workout sets
                  </Text>
                </View>
                <View className="flex-row items-center space-x-2">
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center"
                  >
                    <Ionicons name="chevron-back" size={18} color="#E4E4E7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleNextMonth}
                    className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 items-center justify-center"
                  >
                    <Ionicons name="chevron-forward" size={18} color="#E4E4E7" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Day of Week Headers */}
              <View className="flex-row mb-2">
                {DAY_LABELS.map((day) => (
                  <View key={day} className="flex-1 items-center">
                    <Text className="text-[11px] font-bold text-zinc-500 uppercase">
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Month Grid */}
              <View className="flex-row flex-wrap">
                {calendarDays.map((item, index) => {
                  if (!item) {
                    return <View key={`empty-${index}`} className="w-[14.28%] h-12" />;
                  }

                  const isSelected = item.dateStr === selectedDate;
                  const isToday = item.dateStr === todayStr;
                  const hasActiveWorkout = userWorkoutDateSet.has(item.dateStr);
                  const hasPartnerWorkout = partnerWorkoutDateSet.has(item.dateStr);

                  return (
                    <TouchableOpacity
                      key={item.dateStr}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedDate(item.dateStr);
                      }}
                      className="w-[14.28%] h-12 items-center justify-center p-0.5"
                    >
                      <View
                        className={`w-9 h-9 rounded-xl items-center justify-center ${
                          isSelected
                            ? 'bg-cyan-500 border border-cyan-300'
                            : isToday
                            ? 'bg-zinc-800/90 border border-zinc-700'
                            : 'bg-transparent'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isSelected
                              ? 'text-black font-extrabold'
                              : isToday
                              ? 'text-cyan-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {item.dayNumber}
                        </Text>

                        {/* Workout Indicator Dots */}
                        <View className="flex-row items-center space-x-1 mt-0.5">
                          {hasActiveWorkout && (
                            <View
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-black' : 'bg-accent-cyan'
                              }`}
                            />
                          )}
                          {hasPartnerWorkout && (
                            <View
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-black' : 'bg-accent-purple'
                              }`}
                            />
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Calendar Legend */}
              <View className="flex-row items-center justify-center space-x-4 mt-3 pt-3 border-t border-zinc-800/80">
                <View className="flex-row items-center space-x-1.5">
                  <View className="w-2 h-2 rounded-full bg-accent-cyan" />
                  <Text className="text-[11px] text-zinc-400 font-medium">
                    {activeUser.displayName}
                  </Text>
                </View>
                {partnerUser && (
                  <View className="flex-row items-center space-x-1.5">
                    <View className="w-2 h-2 rounded-full bg-accent-purple" />
                    <Text className="text-[11px] text-zinc-400 font-medium">
                      {partnerUser.displayName}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Selected Date Workout Detail Inspector */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
              {/* Day Header & Duo Quick Toggle */}
              <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
                <View>
                  <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Workout Log
                  </Text>
                  <Text className="text-base font-black text-white">{selectedDate}</Text>
                </View>

                {/* Quick Toggle Persona Switcher */}
                {partnerUser ? (
                  <View className="flex-row bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCalendarUserId(activeUser.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        calendarUserId === activeUser.id
                          ? 'bg-accent-cyan'
                          : 'bg-transparent'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          calendarUserId === activeUser.id
                            ? 'text-black'
                            : 'text-zinc-400'
                        }`}
                      >
                        {activeUser.displayName.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCalendarUserId(partnerUser.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        calendarUserId === partnerUser.id
                          ? 'bg-accent-purple'
                          : 'bg-transparent'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          calendarUserId === partnerUser.id
                            ? 'text-white'
                            : 'text-zinc-400'
                        }`}
                      >
                        {partnerUser.displayName.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                    <Text className="text-xs font-bold text-accent-cyan">
                      {activeUser.displayName}
                    </Text>
                  </View>
                )}
              </View>

              {/* Workouts List for Selected Date */}
              {selectedDayWorkouts.length > 0 ? (
                selectedDayWorkouts.map((log) => {
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

                  return (
                    <View
                      key={log.id}
                      className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-3"
                    >
                      {/* Routine Title & Stats */}
                      <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                        <View className="flex-1 mr-2">
                          <Text className="text-base font-black text-white">
                            {log.routineName}
                          </Text>
                          <Text className="text-xs text-zinc-400">
                            {formatDuration(log.durationSeconds)} session
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xs font-bold text-accent-emerald">
                            {totalVolume.toLocaleString()} kg total
                          </Text>
                          <Text className="text-[11px] text-zinc-400 font-medium">
                            {totalSets} sets completed
                          </Text>
                        </View>
                      </View>

                      {/* Exercises List */}
                      {log.exercises.map((ex, exIdx) => {
                        const completedSets = ex.sets.filter((s) => s.isCompleted);
                        return (
                          <View
                            key={`${ex.exerciseId}-${exIdx}`}
                            className="mb-3 pt-2 border-t border-zinc-900/90"
                          >
                            <Text className="text-xs font-bold text-zinc-200 mb-1.5">
                              {ex.exerciseName}
                            </Text>

                            <View className="flex-row flex-wrap">
                              {completedSets.map((s, sIdx) => (
                                <View
                                  key={sIdx}
                                  className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md mr-1.5 mb-1.5 flex-row items-center space-x-1"
                                >
                                  <Text className="text-[11px] font-bold text-accent-cyan">
                                    {s.weightKg}kg
                                  </Text>
                                  <Text className="text-[11px] text-zinc-400">×</Text>
                                  <Text className="text-[11px] font-bold text-white">
                                    {s.reps}
                                  </Text>
                                  {s.type !== 'Normal' && (
                                    <Text className="text-[9px] text-zinc-400 font-medium ml-1">
                                      ({s.type[0]})
                                    </Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              ) : (
                <View className="py-8 items-center justify-center">
                  <View className="w-12 h-12 rounded-full bg-zinc-900 items-center justify-center mb-2 border border-zinc-800">
                    <Ionicons name="bed-outline" size={24} color="#71717A" />
                  </View>
                  <Text className="text-sm font-bold text-zinc-300">Rest Day</Text>
                  <Text className="text-xs text-zinc-500 mt-1 text-center">
                    No workouts logged for {inspectedUserName} on {selectedDate}.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 📈 EXERCISE PROGRESSION & SEARCH                                   */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <View>
            {/* Search & Exercise Selector Header Card */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="search" size={18} color="#06B6D4" />
                  <Text className="text-base font-bold text-white">
                    Exercise Progression
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowExPickerModal(true)}
                  className="bg-accent-cyan px-3 py-1.5 rounded-xl flex-row items-center space-x-1"
                >
                  <Ionicons name="list" size={14} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs">Choose Exercise</Text>
                </TouchableOpacity>
              </View>

              {/* Current Selected Exercise Card */}
              <TouchableOpacity
                onPress={() => setShowExPickerModal(true)}
                className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-xs text-zinc-400 font-semibold mb-0.5">
                    Selected Exercise ({activeUser.displayName})
                  </Text>
                  <Text className="text-base font-black text-white" numberOfLines={1}>
                    {selectedExercise.name}
                  </Text>
                  <View className="flex-row items-center space-x-2 mt-1">
                    <View className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      <Text className="text-[10px] text-accent-cyan font-bold">
                        {selectedExercise.muscleGroup}
                      </Text>
                    </View>
                    <View className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      <Text className="text-[10px] text-zinc-400 font-semibold">
                        {selectedExercise.equipment}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Exercise Benchmark & All-Time Stats */}
            <View className="flex-row space-x-2 mb-4">
              {/* Est 1RM PR */}
              <View className="flex-1 bg-dark-card border border-dark-border p-3 rounded-2xl">
                <Text className="text-[10px] text-zinc-400 font-bold uppercase">1RM PR</Text>
                <Text className="text-base font-black text-accent-orange mt-0.5">
                  {exerciseHistory.estimated1RM > 0
                    ? `${exerciseHistory.estimated1RM} kg`
                    : '—'}
                </Text>
              </View>

              {/* Best Multi-Rep Working Set */}
              <View className="flex-1 bg-dark-card border border-dark-border p-3 rounded-2xl">
                <Text className="text-[10px] text-zinc-400 font-bold uppercase">
                  Best Set (&gt;1 rep)
                </Text>
                <Text className="text-base font-black text-accent-cyan mt-0.5">
                  {exerciseHistory.bestWorkingSet
                    ? `${exerciseHistory.bestWorkingSet.weightKg}k × ${exerciseHistory.bestWorkingSet.reps}`
                    : '—'}
                </Text>
              </View>

              {/* Total Volume */}
              <View className="flex-1 bg-dark-card border border-dark-border p-3 rounded-2xl">
                <Text className="text-[10px] text-zinc-400 font-bold uppercase">Volume</Text>
                <Text className="text-base font-black text-accent-emerald mt-0.5">
                  {totalExerciseVolume > 0
                    ? `${totalExerciseVolume.toLocaleString()}k`
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Progression Chart Card */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="trending-up" size={18} color="#06B6D4" />
                  <Text className="text-sm font-bold text-white">Progression Over Time</Text>
                </View>

                {/* Metric Mode Filter */}
                <View className="flex-row bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg">
                  <TouchableOpacity
                    onPress={() => setProgressMetric('1rm')}
                    className={`px-2 py-1 rounded ${
                      progressMetric === '1rm' ? 'bg-cyan-500' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        progressMetric === '1rm' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      1RM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setProgressMetric('weight')}
                    className={`px-2 py-1 rounded ${
                      progressMetric === 'weight' ? 'bg-cyan-500' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        progressMetric === 'weight' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Weight
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setProgressMetric('volume')}
                    className={`px-2 py-1 rounded ${
                      progressMetric === 'volume' ? 'bg-cyan-500' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        progressMetric === 'volume' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Volume
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Visual Graph View */}
              <View className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                {exerciseProgression.length > 0 ? (
                  <View className="flex-row items-end justify-between h-40 pt-4 pb-2">
                    {exerciseProgression.map((item, idx) => {
                      let val = item.estimated1RM;
                      let unit = 'kg';
                      if (progressMetric === 'weight') val = item.maxWeightKg;
                      if (progressMetric === 'volume') {
                        val = item.totalVolumeKg;
                        unit = 'kg';
                      }

                      const allVals = exerciseProgression.map((p) =>
                        progressMetric === 'weight'
                          ? p.maxWeightKg
                          : progressMetric === 'volume'
                          ? p.totalVolumeKg
                          : p.estimated1RM
                      );
                      const minV = Math.min(...allVals);
                      const maxV = Math.max(...allVals);
                      const range = Math.max(1, maxV - minV);
                      const pct = Math.max(25, Math.min(100, Math.round(((val - minV) / range) * 75 + 25)));

                      return (
                        <View key={idx} className="items-center flex-1 mx-1">
                          <View className="bg-accent-cyan/20 border border-accent-cyan px-1 py-0.5 rounded mb-1.5">
                            <Text className="text-[9px] font-bold text-accent-cyan">
                              {progressMetric === 'volume' ? `${Math.round(val / 1000)}k` : `${val}${unit}`}
                            </Text>
                          </View>
                          <View className="w-full items-center justify-end h-24">
                            <View
                              className="w-3 bg-accent-cyan rounded-full"
                              style={{ height: `${pct}%` }}
                            />
                          </View>
                          <Text
                            className="text-[9px] text-zinc-500 mt-2 font-medium"
                            numberOfLines={1}
                          >
                            {item.date.slice(5)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View className="py-8 items-center">
                    <Ionicons name="barbell-outline" size={28} color="#71717A" />
                    <Text className="text-xs text-zinc-500 mt-2">
                      No logs recorded yet for {selectedExercise.name}.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Session History List */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
              <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-3">
                Session History ({exerciseProgression.length} logs)
              </Text>

              {exerciseProgression.length > 0 ? (
                [...exerciseProgression].reverse().map((item, idx) => (
                  <View
                    key={idx}
                    className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-2 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-bold text-white">{item.date}</Text>
                      <Text className="text-[11px] text-zinc-400">{item.routineName}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs font-bold text-accent-cyan">
                        Best: {item.bestSet.weightKg}kg × {item.bestSet.reps}
                      </Text>
                      <Text className="text-[10px] text-zinc-400">
                        {item.completedSetsCount} sets • {item.totalVolumeKg.toLocaleString()} kg
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-xs text-zinc-500 italic text-center py-2">
                  No completed sets yet.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ⚖️ BODY COMPOSITION & VOLUME                                       */}
        {/* ========================================================================= */}
        {activeTab === 'body' && (
          <View>
            {/* Body Metric Trend Card */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
              <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="scale" size={20} color="#06B6D4" />
                  <Text className="text-base font-bold text-white">Body Trends</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowWeightModal(true)}
                  className="bg-accent-cyan px-2.5 py-1 rounded-lg"
                >
                  <Text className="text-[11px] font-extrabold text-black">+ Weigh-In</Text>
                </TouchableOpacity>
              </View>

              {/* Metric Type Selector Pills */}
              <View className="flex-row bg-zinc-900 border border-zinc-800 p-1 rounded-xl mb-4">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveBodyMetricTab('weight');
                  }}
                  className={`flex-1 py-1.5 rounded-lg items-center ${
                    activeBodyMetricTab === 'weight' ? 'bg-cyan-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      activeBodyMetricTab === 'weight' ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    Weight (kg)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveBodyMetricTab('bodyFat');
                  }}
                  className={`flex-1 py-1.5 rounded-lg items-center ${
                    activeBodyMetricTab === 'bodyFat' ? 'bg-emerald-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      activeBodyMetricTab === 'bodyFat' ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    Body Fat (%)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveBodyMetricTab('muscle');
                  }}
                  className={`flex-1 py-1.5 rounded-lg items-center ${
                    activeBodyMetricTab === 'muscle' ? 'bg-amber-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      activeBodyMetricTab === 'muscle' ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    Muscle (kg)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Metric Trend Visualizer */}
              <View className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                {userMetrics.length > 0 ? (
                  <View className="flex-row items-end justify-between h-36 pt-4 pb-2 px-1">
                    {userMetrics.map((m, idx) => {
                      let val: number | undefined = m.weightKg;
                      let unit = 'kg';
                      let color = '#06B6D4';

                      if (activeBodyMetricTab === 'bodyFat') {
                        val = m.bodyFatPercentage;
                        unit = '%';
                        color = '#10B981';
                      } else if (activeBodyMetricTab === 'muscle') {
                        val = m.skeletalMuscleMassKg;
                        unit = 'kg';
                        color = '#F59E0B';
                      }

                      if (val === undefined || val === null) {
                        return (
                          <View key={m.id || idx} className="items-center flex-1 mx-1">
                            <Text className="text-[10px] text-zinc-600">—</Text>
                            <Text className="text-[9px] text-zinc-500 mt-auto">
                              {m.date.slice(5)}
                            </Text>
                          </View>
                        );
                      }

                      // Scale heights
                      const validVals = userMetrics
                        .map((x) =>
                          activeBodyMetricTab === 'bodyFat'
                            ? x.bodyFatPercentage
                            : activeBodyMetricTab === 'muscle'
                            ? x.skeletalMuscleMassKg
                            : x.weightKg
                        )
                        .filter((v): v is number => typeof v === 'number');

                      const minV = Math.min(...validVals);
                      const maxV = Math.max(...validVals);
                      const range = Math.max(0.5, maxV - minV);
                      const heightPercent = Math.max(
                        25,
                        Math.min(100, Math.round(((val - minV) / range) * 75 + 25))
                      );

                      return (
                        <View key={m.id || idx} className="items-center flex-1 mx-1">
                          <View
                            className="px-1 py-0.5 rounded mb-2 border"
                            style={{
                              backgroundColor: `${color}20`,
                              borderColor: color,
                            }}
                          >
                            <Text
                              className="text-[9px] font-bold"
                              style={{ color }}
                            >
                              {val}
                              {unit}
                            </Text>
                          </View>
                          <View className="w-full items-center justify-end h-20">
                            <View
                              className="w-3 rounded-full"
                              style={{
                                height: `${heightPercent}%`,
                                backgroundColor: color,
                              }}
                            />
                          </View>
                          <Text
                            className="text-[9px] text-zinc-500 mt-2 font-medium"
                            numberOfLines={1}
                          >
                            {m.date.slice(5)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View className="py-8 items-center">
                    <Ionicons name="analytics-outline" size={28} color="#71717A" />
                    <Text className="text-xs text-zinc-500 mt-2">
                      No weigh-in data logged for {activeUser.displayName}.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Weekly Muscle Volume Bar Chart */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="bar-chart" size={20} color="#10B981" />
                  <Text className="text-base font-bold text-white">7-Day Muscle Volume</Text>
                </View>
                <Text className="text-xs text-zinc-400">Working Sets</Text>
              </View>

              <Text className="text-xs text-zinc-400 mb-4">
                Total completed working sets across all 9 muscle groups in past 7 days.
              </Text>

              <View className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                {volumeEntries.map(([muscle, count]) => {
                  const pct = Math.round((count / maxVolume) * 100);
                  return (
                    <View key={muscle} className="mb-2.5">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-xs font-semibold text-zinc-300">{muscle}</Text>
                        <Text className="text-xs font-bold text-accent-emerald">{count} sets</Text>
                      </View>
                      <View className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-accent-emerald rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Weigh-in History Table */}
            <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-6 shadow-md">
              <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-3">
                Weigh-In Records ({userMetrics.length})
              </Text>

              <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                {userMetrics.length > 0 ? (
                  <>
                    <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800">
                      <Text className="text-[11px] font-bold text-zinc-400 w-20">DATE</Text>
                      <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">
                        WEIGHT
                      </Text>
                      <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">
                        BODY FAT
                      </Text>
                      <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">
                        MUSCLE
                      </Text>
                      <Text className="text-[11px] font-bold text-zinc-400 w-7 text-right" />
                    </View>
                    {[...userMetrics].reverse().map((m) => (
                      <View
                        key={m.id}
                        className="flex-row items-center justify-between py-2.5 border-b border-zinc-900/60"
                      >
                        <Text className="text-xs text-zinc-300 font-medium w-20">{m.date}</Text>
                        <Text className="text-xs font-bold text-white flex-1 text-center">
                          {m.weightKg} kg
                        </Text>
                        <Text className="text-xs font-bold text-accent-emerald flex-1 text-center">
                          {m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '—'}
                        </Text>
                        <Text className="text-xs font-bold text-amber-400 flex-1 text-center">
                          {m.skeletalMuscleMassKg ? `${m.skeletalMuscleMassKg} kg` : '—'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteMetric(m.id, m.date, m.weightKg)}
                          className="w-7 items-end p-1"
                        >
                          <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text className="text-xs text-zinc-500 py-4 text-center">
                    No weigh-in logs recorded yet. Tap "+ Weigh-In" above.
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL: EXERCISE PICKER FOR PROGRESSION                                    */}
      {/* ========================================================================= */}
      <Modal visible={showExPickerModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 h-[80%] shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="barbell-outline" size={22} color="#06B6D4" />
                <Text className="text-lg font-black text-white">Select Exercise</Text>
              </View>
              <TouchableOpacity onPress={() => setShowExPickerModal(false)}>
                <Ionicons name="close-circle" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-3">
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exercise, muscle, or equipment..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white font-medium text-sm"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close" size={16} color="#A1A1AA" />
                </TouchableOpacity>
              )}
            </View>

            {/* Exercise List */}
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {filteredExercises.map((ex) => {
                const isSelected = ex.id === selectedExId;
                const logsCount = activeUserLogs.filter((l) =>
                  l.exercises.some((e) => e.exerciseId === ex.id)
                ).length;

                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedExId(ex.id);
                      setShowExPickerModal(false);
                    }}
                    className={`p-3.5 rounded-xl mb-2 border flex-row items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-800/90 border-accent-cyan'
                        : 'bg-zinc-950 border-zinc-800/70'
                    }`}
                  >
                    <View className="flex-1 mr-2">
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-accent-cyan' : 'text-white'
                        }`}
                      >
                        {ex.name}
                      </Text>
                      <View className="flex-row items-center space-x-2 mt-1">
                        <Text className="text-[10px] text-zinc-400">{ex.muscleGroup}</Text>
                        <Text className="text-[10px] text-zinc-600">•</Text>
                        <Text className="text-[10px] text-zinc-400">{ex.equipment}</Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text
                        className={`text-xs font-bold ${
                          logsCount > 0 ? 'text-accent-emerald' : 'text-zinc-500'
                        }`}
                      >
                        {logsCount} {logsCount === 1 ? 'session' : 'sessions'}
                      </Text>
                      {isSelected && (
                        <View className="mt-1 bg-accent-cyan px-2 py-0.5 rounded-full">
                          <Text className="text-[9px] font-black text-black">ACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: WEIGH-IN LOGGER                                                    */}
      {/* ========================================================================= */}
      <Modal visible={showWeightModal} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl shadow-2xl">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="scale-outline" size={22} color="#06B6D4" />
                <Text className="text-lg font-bold text-white">Log Weigh-In</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWeightModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            {/* Body Weight Field */}
            <Text className="text-xs text-zinc-300 font-bold mb-1">Body Weight (kg) *</Text>
            <TextInput
              keyboardType="numeric"
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="e.g. 81.5"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold text-lg mb-4"
            />

            {/* Body Composition Fields */}
            <View className="flex-row space-x-3 mb-6">
              {/* Body Fat Percentage */}
              <View className="flex-1">
                <View className="flex-row items-center space-x-1 mb-1">
                  <Ionicons name="water-outline" size={14} color="#10B981" />
                  <Text className="text-xs text-accent-emerald font-bold">Body Fat (%)</Text>
                </View>
                <TextInput
                  keyboardType="numeric"
                  value={newBodyFat}
                  onChangeText={setNewBodyFat}
                  placeholder="e.g. 14.5"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold text-base"
                />
              </View>

              {/* Skeletal Muscle Mass */}
              <View className="flex-1">
                <View className="flex-row items-center space-x-1 mb-1">
                  <Ionicons name="barbell-outline" size={14} color="#F59E0B" />
                  <Text className="text-xs text-amber-400 font-bold">Muscle Mass (kg)</Text>
                </View>
                <TextInput
                  keyboardType="numeric"
                  value={newMuscleMass}
                  onChangeText={setNewMuscleMass}
                  placeholder="e.g. 39.5"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold text-base"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddWeight}
              className="bg-accent-cyan p-3.5 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Save Weigh-In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
