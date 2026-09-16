import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import { LoggedExercise, SetLog, SetType, Exercise } from '../../types';

interface LogPastWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: string;
}

const getPastDateStr = (daysAgo: number): string => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().split('T')[0];
};

export const LogPastWorkoutModal: React.FC<LogPastWorkoutModalProps> = ({
  visible,
  onClose,
  initialDate,
}) => {
  const {
    activeUser,
    activeWorkspace,
    splits,
    exercises: allExercises,
    saveWorkoutLog,
  } = useUserWorkspace();

  // Date State
  const [selectedDateOption, setSelectedDateOption] = useState<'today' | 'yesterday' | '2days' | 'custom'>('yesterday');
  const [customDate, setCustomDate] = useState(initialDate || getPastDateStr(1));

  React.useEffect(() => {
    if (initialDate) {
      const today = getPastDateStr(0);
      const yesterday = getPastDateStr(1);
      const twoDays = getPastDateStr(2);
      if (initialDate === today) {
        setSelectedDateOption('today');
      } else if (initialDate === yesterday) {
        setSelectedDateOption('yesterday');
      } else if (initialDate === twoDays) {
        setSelectedDateOption('2days');
      } else {
        setSelectedDateOption('custom');
      }
      setCustomDate(initialDate);
    }
  }, [initialDate, visible]);

  // Workout Metadata State
  const [routineTitle, setRoutineTitle] = useState('Push Day');
  const [durationMinutes, setDurationMinutes] = useState('45');

  // Exercise List Builder
  const [exercisesList, setExercisesList] = useState<
    Array<{
      exerciseId: string;
      exerciseName: string;
      sets: Array<{
        weightKg: string;
        reps: string;
        rpe: string;
        type: SetType;
      }>;
    }>
  >([
    {
      exerciseId: 'ex_1',
      exerciseName: 'Barbell Bench Press',
      sets: [
        { weightKg: '80', reps: '10', rpe: '8', type: 'Normal' },
        { weightKg: '85', reps: '8', rpe: '8.5', type: 'Normal' },
        { weightKg: '90', reps: '6', rpe: '9', type: 'Normal' },
      ],
    },
  ]);

  const [showAddExPicker, setShowAddExPicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Active workout routines from splits
  const activeSplit = splits.find((s) => s.userId === activeUser.id && s.isActive) || splits[0];
  const availableRoutines = activeSplit?.routines || [];

  const effectiveDate = useMemo(() => {
    if (selectedDateOption === 'today') return getPastDateStr(0);
    if (selectedDateOption === 'yesterday') return getPastDateStr(1);
    if (selectedDateOption === '2days') return getPastDateStr(2);
    return customDate.trim() || getPastDateStr(1);
  }, [selectedDateOption, customDate]);

  const handleSelectRoutine = (rName: string, exIds: string[]) => {
    setRoutineTitle(rName);
    if (exIds && exIds.length > 0) {
      const mapped = exIds.map((id) => {
        const found = allExercises.find((e) => e.id === id);
        return {
          exerciseId: id,
          exerciseName: found ? found.name : 'Exercise',
          sets: [
            { weightKg: '60', reps: '10', rpe: '8', type: 'Normal' as SetType },
            { weightKg: '60', reps: '10', rpe: '8', type: 'Normal' as SetType },
            { weightKg: '60', reps: '10', rpe: '8', type: 'Normal' as SetType },
          ],
        };
      });
      setExercisesList(mapped);
    }
  };

  const handleAddExerciseToWorkout = (ex: Exercise) => {
    setExercisesList((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: [
          { weightKg: '50', reps: '10', rpe: '8', type: 'Normal' },
          { weightKg: '50', reps: '10', rpe: '8', type: 'Normal' },
        ],
      },
    ]);
    setShowAddExPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveExercise = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExercisesList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSet = (exIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercisesList((prev) => {
      const copy = [...prev];
      const ex = copy[exIndex];
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        weightKg: lastSet ? lastSet.weightKg : '50',
        reps: lastSet ? lastSet.reps : '10',
        rpe: lastSet ? lastSet.rpe : '8',
        type: 'Normal',
      });
      return copy;
    });
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercisesList((prev) => {
      const copy = [...prev];
      copy[exIndex].sets = copy[exIndex].sets.filter((_, sIdx) => sIdx !== setIndex);
      return copy;
    });
  };

  const handleUpdateSet = (
    exIndex: number,
    setIndex: number,
    field: 'weightKg' | 'reps' | 'rpe',
    value: string
  ) => {
    setExercisesList((prev) => {
      const copy = [...prev];
      copy[exIndex].sets[setIndex][field] = value;
      return copy;
    });
  };

  const handleSavePastWorkout = () => {
    if (!routineTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a routine title.');
      return;
    }

    if (exercisesList.length === 0) {
      Alert.alert('No Exercises', 'Please add at least one exercise to this session.');
      return;
    }

    const durationMinsNum = parseInt(durationMinutes, 10) || 45;

    // Convert into LoggedExercise array
    const compiledExercises: LoggedExercise[] = exercisesList.map((ex) => {
      const compiledSets: SetLog[] = ex.sets.map((s, idx) => ({
        setNumber: idx + 1,
        type: s.type,
        weightKg: parseFloat(s.weightKg) || 0,
        reps: parseInt(s.reps, 10) || 0,
        rpe: parseFloat(s.rpe) || undefined,
        isCompleted: true,
      }));

      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        sets: compiledSets,
      };
    });

    const newLog = saveWorkoutLog({
      userId: activeUser.id,
      workspaceId: activeWorkspace.id,
      splitId: activeSplit?.id || 'split_custom',
      routineName: routineTitle.trim(),
      date: effectiveDate,
      timestamp: new Date(effectiveDate).getTime() || Date.now(),
      durationSeconds: durationMinsNum * 60,
      exercises: compiledExercises,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Workout Saved! 🏋️',
      `Saved "${routineTitle}" for ${effectiveDate} (${compiledExercises.length} exercises). Automatically synced to local storage & cloud backup.`
    );
    onClose();
  };

  const filteredLibrary = useMemo(() => {
    if (!exerciseSearch.trim()) return allExercises;
    return allExercises.filter(
      (e) =>
        e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
        e.muscleGroup.toLowerCase().includes(exerciseSearch.toLowerCase())
    );
  }, [allExercises, exerciseSearch]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/85 justify-end"
      >
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[90%]">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-xl bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
                <Ionicons name="calendar-outline" size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-bold text-white">Log Past Workout</Text>
                <Text className="text-[11px] text-zinc-400">
                  Backdate sessions directly into your history
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 bg-zinc-850 rounded-full items-center justify-center border border-zinc-750"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-3">
            {/* 1. Date Selection */}
            <Text className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
              Workout Date ({effectiveDate})
            </Text>
            <View className="flex-row space-x-2 mb-3">
              <TouchableOpacity
                onPress={() => setSelectedDateOption('yesterday')}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  selectedDateOption === 'yesterday'
                    ? 'bg-accent-cyan border-accent-cyan'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDateOption === 'yesterday' ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedDateOption('2days')}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  selectedDateOption === '2days'
                    ? 'bg-accent-cyan border-accent-cyan'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDateOption === '2days' ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  2 Days Ago
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedDateOption('today')}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  selectedDateOption === 'today'
                    ? 'bg-accent-cyan border-accent-cyan'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDateOption === 'today' ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedDateOption('custom')}
                className={`flex-1 py-2 rounded-xl items-center border ${
                  selectedDateOption === 'custom'
                    ? 'bg-accent-cyan border-accent-cyan'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedDateOption === 'custom' ? 'text-black' : 'text-zinc-300'
                  }`}
                >
                  Custom
                </Text>
              </TouchableOpacity>
            </View>

            {selectedDateOption === 'custom' && (
              <View className="mb-4">
                <Text className="text-[11px] text-zinc-400 mb-1">
                  Enter Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={customDate}
                  onChangeText={setCustomDate}
                  placeholder="2026-09-05"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl font-mono text-sm"
                />
              </View>
            )}

            {/* 2. Routine Title & Duration */}
            <View className="flex-row space-x-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-bold text-zinc-300 mb-1">Routine Name</Text>
                <TextInput
                  value={routineTitle}
                  onChangeText={setRoutineTitle}
                  placeholder="e.g. Push Day"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl font-bold text-sm"
                />
              </View>
              <View className="w-28">
                <Text className="text-xs font-bold text-zinc-300 mb-1">Duration (min)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  placeholder="45"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl font-bold text-sm text-center"
                />
              </View>
            </View>

            {/* Routine Pre-Fill Chips */}
            {availableRoutines.length > 0 && (
              <View className="mb-4">
                <Text className="text-[11px] text-zinc-400 mb-1.5 font-semibold">
                  Or load from routine template:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2">
                  {availableRoutines.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => handleSelectRoutine(r.name, r.exerciseIds)}
                      className="bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 mr-2"
                    >
                      <Text className="text-xs font-bold text-accent-cyan">{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 3. Exercises & Sets Builder */}
            <View className="flex-row items-center justify-between mt-2 mb-3">
              <Text className="text-sm font-bold text-white uppercase tracking-wider">
                Exercises & Sets ({exercisesList.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddExPicker(true)}
                className="flex-row items-center space-x-1 bg-cyan-500/20 border border-cyan-500/50 px-2.5 py-1 rounded-lg"
              >
                <Ionicons name="add" size={14} color="#06B6D4" />
                <Text className="text-xs font-bold text-accent-cyan">Add Exercise</Text>
              </TouchableOpacity>
            </View>

            {exercisesList.map((exItem, exIdx) => (
              <View
                key={`${exItem.exerciseId}_${exIdx}`}
                className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl mb-3"
              >
                <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-zinc-800/80">
                  <Text className="text-sm font-bold text-white flex-1 mr-2">
                    {exItem.exerciseName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(exIdx)}
                    className="p-1 bg-zinc-800 rounded-md"
                  >
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Sets Header */}
                <View className="flex-row items-center justify-between px-1 mb-1">
                  <Text className="text-[10px] text-zinc-500 font-bold w-10">SET</Text>
                  <Text className="text-[10px] text-zinc-500 font-bold flex-1 text-center">KG</Text>
                  <Text className="text-[10px] text-zinc-500 font-bold flex-1 text-center">REPS</Text>
                  <Text className="text-[10px] text-zinc-500 font-bold w-14 text-center">RPE</Text>
                  <View className="w-6" />
                </View>

                {/* Set Rows */}
                {exItem.sets.map((set, sIdx) => (
                  <View key={sIdx} className="flex-row items-center space-x-1.5 mb-1.5">
                    <View className="w-10 items-center">
                      <Text className="text-xs font-bold text-zinc-400">{sIdx + 1}</Text>
                    </View>
                    <TextInput
                      keyboardType="numeric"
                      value={set.weightKg}
                      onChangeText={(val) => handleUpdateSet(exIdx, sIdx, 'weightKg', val)}
                      placeholder="kg"
                      placeholderTextColor="#52525B"
                      className="flex-1 bg-zinc-950 border border-zinc-800 text-white text-xs font-bold py-1 px-2 rounded-lg text-center"
                    />
                    <TextInput
                      keyboardType="numeric"
                      value={set.reps}
                      onChangeText={(val) => handleUpdateSet(exIdx, sIdx, 'reps', val)}
                      placeholder="reps"
                      placeholderTextColor="#52525B"
                      className="flex-1 bg-zinc-950 border border-zinc-800 text-white text-xs font-bold py-1 px-2 rounded-lg text-center"
                    />
                    <TextInput
                      keyboardType="numeric"
                      value={set.rpe}
                      onChangeText={(val) => handleUpdateSet(exIdx, sIdx, 'rpe', val)}
                      placeholder="8"
                      placeholderTextColor="#52525B"
                      className="w-14 bg-zinc-950 border border-zinc-800 text-white text-xs font-bold py-1 px-2 rounded-lg text-center font-mono"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveSet(exIdx, sIdx)}
                      className="w-6 items-center"
                    >
                      <Ionicons name="close-circle" size={16} color="#71717A" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Set Button */}
                <TouchableOpacity
                  onPress={() => handleAddSet(exIdx)}
                  className="mt-2 py-1.5 bg-zinc-850 rounded-xl items-center border border-zinc-750"
                >
                  <Text className="text-[11px] font-bold text-zinc-300">+ Add Set</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Save Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSavePastWorkout}
              className="bg-accent-cyan p-4 rounded-2xl mt-3 mb-8 items-center shadow-lg shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">
                Save Completed Workout to History
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Add Exercise Modal Picker */}
      <Modal visible={showAddExPicker} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-zinc-800">
              <Text className="text-base font-bold text-white">Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowAddExPicker(false)}>
                <Ionicons name="close" size={22} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              placeholder="Search exercise..."
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl text-sm mb-3"
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredLibrary.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleAddExerciseToWorkout(ex)}
                  className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl mb-2 flex-row items-center justify-between"
                >
                  <View>
                    <Text className="text-sm font-bold text-white">{ex.name}</Text>
                    <Text className="text-xs text-zinc-400">{ex.muscleGroup} • {ex.equipment}</Text>
                  </View>
                  <Ionicons name="add-circle" size={20} color="#06B6D4" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};
export default LogPastWorkoutModal;
