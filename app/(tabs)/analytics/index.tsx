import React, { useState } from 'react';
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
import { calculate1RM, calculateWeeklyVolume } from '../../../src/utils/fitness';
import { MuscleGroup } from '../../../src/types';

export default function AnalyticsScreen() {
  const {
    activeUser,
    workoutLogs,
    exercises,
    bodyMetrics,
    addBodyMetric,
    deleteBodyMetric,
  } = useUserWorkspace();

  // Selected benchmark exercise for 1RM trend
  const benchmarkExercises = exercises.filter((ex) =>
    ['ex_1', 'ex_4', 'ex_8', 'ex_13'].includes(ex.id)
  );
  const [selectedExId, setSelectedExId] = useState<string>('ex_1');

  // Weigh-in modal
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newMuscleMass, setNewMuscleMass] = useState('');

  // 1. Calculate 1RM history data points for activeUser & selected exercise
  const userLogs = workoutLogs
    .filter((l) => l.userId === activeUser.id)
    .sort((a, b) => a.timestamp - b.timestamp);

  const e1rmPoints: { date: string; max1RM: number }[] = [];
  userLogs.forEach((log) => {
    let dayMax = 0;
    log.exercises.forEach((ex) => {
      if (ex.exerciseId === selectedExId) {
        ex.sets.forEach((s) => {
          if (s.isCompleted && s.weightKg > 0 && s.reps > 0) {
            const est = calculate1RM(s.weightKg, s.reps);
            if (est > dayMax) dayMax = est;
          }
        });
      }
    });
    if (dayMax > 0) {
      e1rmPoints.push({ date: log.date, max1RM: dayMax });
    }
  });

  // 2. Muscle Group Volume (Total completed sets in past 7 days)
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentLogs = userLogs.filter((l) => l.timestamp >= sevenDaysAgo);

  const weeklyVolume: Record<MuscleGroup, number> = {
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
        weeklyVolume[def.muscleGroup] = (weeklyVolume[def.muscleGroup] || 0) + completedSets;
      }
    });
  });

  const volumeEntries = Object.entries(weeklyVolume) as [MuscleGroup, number][];
  const maxVolume = Math.max(1, ...volumeEntries.map(([, v]) => v));

  // 3. Body Weight Data for activeUser
  const userMetrics = bodyMetrics
    .filter((m) => m.userId === activeUser.id)
    .sort((a, b) => a.date.localeCompare(b.date));

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

  const selectedExDef = exercises.find((e) => e.id === selectedExId);

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Active User Header Banner */}
      <View className="flex-row items-center justify-between bg-dark-card border border-dark-border p-4 rounded-2xl mb-5">
        <View>
          <Text className="text-xs text-zinc-400 font-medium">Performance Persona</Text>
          <Text className="text-xl font-bold text-white">{activeUser.displayName}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowWeightModal(true)}
          className="bg-accent-cyan px-3.5 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
        >
          <Ionicons name="scale-outline" size={16} color="#09090B" />
          <Text className="text-black font-extrabold text-xs">+ Weigh-In</Text>
        </TouchableOpacity>
      </View>

      {/* 1RM Trend Chart */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="trending-up" size={20} color="#06B6D4" />
            <Text className="text-base font-bold text-white">Estimated 1RM Trend</Text>
          </View>
        </View>

        {/* Benchmark Selector Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {benchmarkExercises.map((ex) => {
            const isSelected = selectedExId === ex.id;
            return (
              <TouchableOpacity
                key={ex.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedExId(ex.id);
                }}
                className={`px-3 py-1.5 rounded-lg mr-2 border ${
                  isSelected
                    ? 'bg-accent-cyan border-cyan-400'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-black font-bold' : 'text-zinc-400'
                  }`}
                >
                  {ex.name.split(' ')[0]} {ex.name.split(' ')[1] || ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text className="text-xs text-zinc-400 mb-3 font-medium">
          Target: <Text className="text-white font-bold">{selectedExDef?.name}</Text>
        </Text>

        {/* Native 1RM Trend Visualizer */}
        <View className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
          {e1rmPoints.length > 0 ? (
            <View className="flex-row items-end justify-between h-36 pt-4 pb-2 px-2">
              {e1rmPoints.map((pt, i) => {
                const minY = Math.min(...e1rmPoints.map((p) => p.max1RM));
                const maxY = Math.max(...e1rmPoints.map((p) => p.max1RM));
                const range = Math.max(1, maxY - minY);
                const heightPercent = Math.max(25, Math.min(100, Math.round(((pt.max1RM - minY) / range) * 75 + 25)));

                return (
                  <View key={i} className="items-center flex-1 mx-1">
                    <View className="bg-accent-cyan/20 border border-accent-cyan px-1.5 py-0.5 rounded mb-2">
                      <Text className="text-[10px] font-bold text-accent-cyan">
                        {pt.max1RM}kg
                      </Text>
                    </View>
                    <View className="w-full items-center justify-end h-20">
                      <View
                        className="w-3.5 bg-accent-cyan rounded-full"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </View>
                    <Text className="text-[10px] text-zinc-500 mt-2 font-medium">
                      {pt.date}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="py-8 items-center">
              <Ionicons name="analytics-outline" size={28} color="#71717A" />
              <Text className="text-xs text-zinc-500 mt-2">
                No completed logs yet for {selectedExDef?.name}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Weekly Muscle Volume Bar Chart */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="bar-chart" size={20} color="#10B981" />
            <Text className="text-base font-bold text-white">7-Day Muscle Volume</Text>
          </View>
          <Text className="text-xs text-zinc-400">Working Sets</Text>
        </View>

        <Text className="text-xs text-zinc-400 mb-4">
          Total working sets (Normal, Drop, Failure) completed in rolling 7-day window.
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

      {/* Body Weight & Composition Tracker */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-10 shadow-md">
        <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="scale" size={20} color="#06B6D4" />
            <Text className="text-base font-bold text-white">Body Composition Log</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowWeightModal(true)}
            className="bg-accent-cyan px-2.5 py-1 rounded-lg"
          >
            <Text className="text-[11px] font-extrabold text-black">+ Weigh-In</Text>
          </TouchableOpacity>
        </View>

        {userMetrics.length > 0 && (
          <View className="flex-row justify-between items-center bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl mb-3">
            <View className="items-center flex-1">
              <Text className="text-[10px] text-zinc-400 font-bold uppercase">Weight</Text>
              <Text className="text-sm font-black text-accent-cyan">
                {userMetrics[userMetrics.length - 1].weightKg} kg
              </Text>
            </View>
            <View className="items-center flex-1 border-x border-zinc-800">
              <Text className="text-[10px] text-zinc-400 font-bold uppercase">Body Fat</Text>
              <Text className="text-sm font-black text-accent-emerald">
                {userMetrics[userMetrics.length - 1].bodyFatPercentage
                  ? `${userMetrics[userMetrics.length - 1].bodyFatPercentage}%`
                  : '—'}
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-[10px] text-zinc-400 font-bold uppercase">Skeletal Muscle</Text>
              <Text className="text-sm font-black text-amber-400">
                {userMetrics[userMetrics.length - 1].skeletalMuscleMassKg
                  ? `${userMetrics[userMetrics.length - 1].skeletalMuscleMassKg} kg`
                  : '—'}
              </Text>
            </View>
          </View>
        )}

        <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          {userMetrics.length > 0 ? (
            <>
              <View className="flex-row items-center justify-between pb-2 border-b border-zinc-800">
                <Text className="text-[11px] font-bold text-zinc-400 w-20">DATE</Text>
                <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">WEIGHT</Text>
                <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">BODY FAT</Text>
                <Text className="text-[11px] font-bold text-zinc-400 flex-1 text-center">MUSCLE</Text>
                <Text className="text-[11px] font-bold text-zinc-400 w-7 text-right"></Text>
              </View>
              {[...userMetrics].reverse().map((m) => (
                <View
                  key={m.id}
                  className="flex-row items-center justify-between py-2.5 border-b border-zinc-900/60"
                >
                  <Text className="text-xs text-zinc-300 font-medium w-20">{m.date}</Text>
                  <Text className="text-xs font-bold text-white flex-1 text-center">{m.weightKg} kg</Text>
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
              No weight logs recorded for {activeUser.displayName}. Tap "+ Weigh-In" above.
            </Text>
          )}
        </View>
      </View>

      {/* Weigh-In Modal */}
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
    </ScrollView>
  );
}
