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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { Routine, MuscleGroup } from '../src/types';

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

export default function CreateSplitScreen() {
  const router = useRouter();
  const { activeUser, activeWorkspace, exercises, addSplit, addExercise } = useUserWorkspace();

  const [splitName, setSplitName] = useState('');
  const [routines, setRoutines] = useState<Omit<Routine, 'id'>[]>([
    { name: 'Routine 1 (e.g. Upper)', exerciseIds: ['ex_1', 'ex_5'] },
    { name: 'Routine 2 (e.g. Lower)', exerciseIds: ['ex_8', 'ex_11'] },
  ]);

  // Create custom exercise state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetRoutineIdx, setTargetRoutineIdx] = useState<number | null>(null);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  const handleOpenCreateModal = (routineIdx?: number) => {
    setTargetRoutineIdx(routineIdx !== undefined ? routineIdx : null);
    setShowCreateModal(true);
  };

  const handleSaveCustomExercise = () => {
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

    if (targetRoutineIdx !== null && targetRoutineIdx >= 0) {
      setRoutines((prev) => {
        const updated = [...prev];
        const r = { ...updated[targetRoutineIdx] };
        if (!r.exerciseIds.includes(created.id)) {
          r.exerciseIds = [...r.exerciseIds, created.id];
        }
        updated[targetRoutineIdx] = r;
        return updated;
      });
    }

    setNewExName('');
    setNewExEquipment('Barbell');
    setShowCreateModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Created', `"${created.name}" created and added!`);
  };

  const handleAddRoutine = () => {
    setRoutines((prev) => [
      ...prev,
      {
        name: `Routine ${prev.length + 1}`,
        exerciseIds: ['ex_1'],
      },
    ]);
  };

  const handleToggleExerciseInRoutine = (routineIdx: number, exId: string) => {
    setRoutines((prev) => {
      const updated = [...prev];
      const r = { ...updated[routineIdx] };
      if (r.exerciseIds.includes(exId)) {
        r.exerciseIds = r.exerciseIds.filter((id) => id !== exId);
      } else {
        r.exerciseIds = [...r.exerciseIds, exId];
      }
      updated[routineIdx] = r;
      return updated;
    });
  };

  const handleSave = () => {
    if (!splitName.trim()) {
      Alert.alert('Required', 'Please enter a name for the workout split.');
      return;
    }

    addSplit({
      userId: activeUser.id,
      name: splitName.trim(),
      isActive: true,
      routines: routines.map((r, i) => ({
        id: `r_custom_${Date.now()}_${i}`,
        name: r.name,
        exerciseIds: r.exerciseIds,
      })),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Split Created! 🎉', `Set "${splitName}" as active split for ${activeUser.displayName}.`, [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-xs text-zinc-400 mb-1">Split Title</Text>
      <TextInput
        value={splitName}
        onChangeText={setSplitName}
        placeholder="e.g. Push / Pull / Legs (5-Day)"
        placeholderTextColor="#71717A"
        className="bg-dark-card border border-dark-border text-white p-3.5 rounded-xl text-base font-bold mb-6"
      />

      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-white">Routines & Days</Text>
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={() => handleOpenCreateModal()}
            className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg mr-2"
          >
            <Text className="text-xs font-bold text-zinc-200">+ New Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAddRoutine}
            className="bg-cyan-500/20 border border-cyan-500 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-xs font-bold text-cyan-400">+ Add Routine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {routines.map((r, rIdx) => (
        <View key={rIdx} className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4">
          <Text className="text-xs text-zinc-400 mb-1">Routine Name</Text>
          <TextInput
            value={r.name}
            onChangeText={(text) => {
              setRoutines((prev) => {
                const updated = [...prev];
                updated[rIdx].name = text;
                return updated;
              });
            }}
            className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold"
          />

          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-zinc-400">Select Included Exercises:</Text>
            <TouchableOpacity
              onPress={() => handleOpenCreateModal(rIdx)}
              className="flex-row items-center"
            >
              <Ionicons name="add-circle" size={14} color="#06B6D4" />
              <Text className="text-[11px] font-bold text-cyan-400 ml-1">Create Exercise</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap">
            {exercises.map((ex) => {
              const isSelected = r.exerciseIds.includes(ex.id);
              const isCustom = Boolean(ex.workspaceId);
              return (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleToggleExerciseInRoutine(rIdx, ex.id)}
                  className={`px-3 py-1.5 rounded-lg mr-2 mb-2 border flex-row items-center ${
                    isSelected
                      ? 'bg-accent-cyan border-cyan-400'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-black font-bold' : 'text-white'
                    }`}
                  >
                    {ex.name}
                  </Text>
                  {isCustom && (
                    <View className="ml-1.5 px-1 py-0.2 bg-purple-500/30 rounded border border-purple-400/40">
                      <Text className={`text-[9px] font-bold ${isSelected ? 'text-purple-950' : 'text-purple-300'}`}>
                        Custom
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={handleSave}
        className="bg-accent-cyan p-4 rounded-2xl items-center mb-10 shadow-lg shadow-cyan-500/20"
      >
        <Text className="text-black font-extrabold text-base">Save & Set Active Split</Text>
      </TouchableOpacity>

      {/* CREATE CUSTOM EXERCISE MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-zinc-900 border-t border-zinc-800 p-6 rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-white">Create Custom Exercise</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close-circle" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs text-zinc-400 mb-1">Exercise Name *</Text>
              <TextInput
                value={newExName}
                onChangeText={setNewExName}
                placeholder="e.g. Incline Smith Bench Press"
                placeholderTextColor="#71717A"
                className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded-xl mb-4 text-sm"
              />

              <Text className="text-xs text-zinc-400 mb-1">Target Muscle Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {MUSCLE_GROUPS.map((mg) => (
                  <TouchableOpacity
                    key={mg}
                    onPress={() => setNewExMuscle(mg)}
                    className={`px-3 py-1.5 rounded-lg mr-2 border ${
                      newExMuscle === mg
                        ? 'bg-cyan-500 border-cyan-400'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        newExMuscle === mg ? 'text-black font-bold' : 'text-zinc-300'
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
                placeholder="e.g. Barbell, Dumbbell, Machine, Cable"
                placeholderTextColor="#71717A"
                className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded-xl mb-6 text-sm"
              />

              <TouchableOpacity
                onPress={handleSaveCustomExercise}
                className="bg-cyan-500 p-4 rounded-xl items-center mb-3"
              >
                <Text className="text-black font-bold text-sm">
                  {targetRoutineIdx !== null ? 'Create & Add to Routine' : 'Create Exercise'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                className="bg-zinc-800 p-3 rounded-xl items-center"
              >
                <Text className="text-zinc-400 text-sm">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
