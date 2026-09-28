import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { Routine, MuscleGroup, Split } from '../src/types';
import { ShareWorkoutModal } from '../src/components/workouts/ShareWorkoutModal';
import { shareSplitCloud } from '../src/services/shareSplitService';

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

interface RoutineFormState {
  id?: string;
  name: string;
  exerciseIds: string[];
}

export default function CreateSplitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ splitId?: string }>();
  const splitId = params.splitId;

  const {
    activeUser,
    activeWorkspace,
    exercises,
    splits,
    addSplit,
    updateSplit,
    addExercise,
  } = useUserWorkspace();

  const existingSplit = splitId ? splits.find((s) => s.id === splitId) : null;
  const isEditing = Boolean(existingSplit);

  // Share split state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  const handleShareCurrentSplit = async () => {
    if (!existingSplit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareCode(null);
    setIsGeneratingShare(true);
    setShowShareModal(true);

    try {
      const code = await shareSplitCloud(
        existingSplit,
        exercises,
        activeUser.displayName,
        activeUser.id
      );
      setShareCode(code);
      setIsGeneratingShare(false);
    } catch (err) {
      console.warn('Failed to share split from editor:', err);
      setIsGeneratingShare(false);
      Alert.alert('Sharing Error', 'Could not generate share code. Check your network.');
    }
  };

  const [splitName, setSplitName] = useState('');
  const [routines, setRoutines] = useState<RoutineFormState[]>([
    { name: 'Routine 1 (e.g. Upper)', exerciseIds: ['ex_1', 'ex_5'] },
    { name: 'Routine 2 (e.g. Lower)', exerciseIds: ['ex_8', 'ex_11'] },
  ]);

  // Exercise picker modal per routine
  const [activePickerRoutineIdx, setActivePickerRoutineIdx] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Create custom exercise state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetRoutineIdx, setTargetRoutineIdx] = useState<number | null>(null);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  // Load existing split when editing
  useEffect(() => {
    if (existingSplit) {
      setSplitName(existingSplit.name);
      setRoutines(
        existingSplit.routines.map((r) => ({
          id: r.id,
          name: r.name,
          exerciseIds: [...r.exerciseIds],
        }))
      );
    }
  }, [splitId]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRoutines((prev) => [
      ...prev,
      {
        name: `Routine ${prev.length + 1}`,
        exerciseIds: ['ex_1'],
      },
    ]);
  };

  const handleMoveRoutineUp = (rIdx: number) => {
    if (rIdx === 0) return;
    Haptics.selectionAsync();
    setRoutines((prev) => {
      const next = [...prev];
      const temp = next[rIdx - 1];
      next[rIdx - 1] = next[rIdx];
      next[rIdx] = temp;
      return next;
    });
  };

  const handleMoveRoutineDown = (rIdx: number) => {
    if (rIdx === routines.length - 1) return;
    Haptics.selectionAsync();
    setRoutines((prev) => {
      const next = [...prev];
      const temp = next[rIdx + 1];
      next[rIdx + 1] = next[rIdx];
      next[rIdx] = temp;
      return next;
    });
  };

  const handleDeleteRoutine = (rIdx: number) => {
    if (routines.length <= 1) {
      Alert.alert('Protected', 'A workout split must have at least one routine day.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Routine Day',
      `Are you sure you want to remove "${routines[rIdx].name}" from this split?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRoutines((prev) => prev.filter((_, idx) => idx !== rIdx));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Remove an exercise from a routine template
  const handleRemoveExerciseFromRoutine = (routineIdx: number, exId: string, exName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRoutines((prev) => {
      const updated = [...prev];
      const r = { ...updated[routineIdx] };
      r.exerciseIds = r.exerciseIds.filter((id) => id !== exId);
      updated[routineIdx] = r;
      return updated;
    });
  };

  // Toggle or add an exercise to a routine
  const handleAddExerciseToRoutine = (routineIdx: number, exId: string) => {
    Haptics.selectionAsync();
    setRoutines((prev) => {
      const updated = [...prev];
      const r = { ...updated[routineIdx] };
      if (!r.exerciseIds.includes(exId)) {
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

    if (routines.length === 0) {
      Alert.alert('Required', 'Please configure at least one routine.');
      return;
    }

    if (!isEditing) {
      const userSplitsCount = splits.filter((s) => s.userId === activeUser.id).length;
      if (userSplitsCount >= 50) {
        Alert.alert(
          'Split Limit Reached (50/50)',
          'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
        );
        return;
      }
    }

    if (isEditing && existingSplit) {
      const updated: Split = {
        ...existingSplit,
        name: splitName.trim(),
        routines: routines.map((r, i) => ({
          id: r.id || `r_${Date.now()}_${i}`,
          name: r.name.trim() || `Routine ${i + 1}`,
          exerciseIds: r.exerciseIds,
        })),
      };

      updateSplit(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Split Updated! 🎉', `Saved changes for "${splitName}".`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } else {
      addSplit({
        userId: activeUser.id,
        name: splitName.trim(),
        isActive: true,
        routines: routines.map((r, i) => ({
          id: `r_custom_${Date.now()}_${i}`,
          name: r.name.trim() || `Routine ${i + 1}`,
          exerciseIds: r.exerciseIds,
        })),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Split Created! 🎉', `Set "${splitName}" as active split for ${activeUser.displayName}.`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Screen Title & Persona Banner */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 pr-2">
          <Text className="text-xl font-black text-white">
            {isEditing ? 'Edit Workout Split' : 'Create Workout Split'}
          </Text>
          <Text className="text-xs text-zinc-400">
            Configuring for <Text className="text-cyan-400 font-bold">{activeUser.displayName}</Text>
          </Text>
        </View>
        {isEditing && existingSplit && (
          <TouchableOpacity
            onPress={handleShareCurrentSplit}
            className="flex-row items-center bg-cyan-500/15 border border-cyan-500/40 px-3 py-1.5 rounded-xl"
          >
            <Ionicons name="share-social-outline" size={14} color="#06B6D4" />
            <Text className="text-xs font-bold text-cyan-400 ml-1.5">Share Split</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Split Title Input */}
      <Text className="text-xs text-zinc-400 mb-1 font-semibold">Split Title *</Text>
      <TextInput
        value={splitName}
        onChangeText={setSplitName}
        placeholder="e.g. Push / Pull / Legs (5-Day)"
        placeholderTextColor="#71717A"
        className="bg-dark-card border border-dark-border text-white p-3.5 rounded-xl text-base font-bold mb-5"
      />

      {/* Routines & Days Section Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-white">Routines & Days ({routines.length})</Text>
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={() => handleOpenCreateModal()}
            className="bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg mr-1.5"
          >
            <Text className="text-xs font-bold text-zinc-200">+ New Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAddRoutine}
            className="bg-cyan-500/20 border border-cyan-500 px-2.5 py-1.5 rounded-lg"
          >
            <Text className="text-xs font-bold text-cyan-400">+ Add Routine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Routine Cards */}
      {routines.map((r, rIdx) => (
        <View key={r.id || rIdx} className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-4 shadow-md">
          {/* Routine Header: Reordering & Delete Controls */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <View className="bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 rounded-md">
                <Text className="text-[10px] font-black text-cyan-400 uppercase">Day {rIdx + 1}</Text>
              </View>
              <Text className="text-xs text-zinc-400 font-bold">Routine Title</Text>
            </View>

            {/* Reorder and Delete Routine Buttons */}
            <View className="flex-row items-center space-x-1">
              {/* Move Up */}
              <TouchableOpacity
                disabled={rIdx === 0}
                onPress={() => handleMoveRoutineUp(rIdx)}
                className={`p-1.5 rounded-lg border ${
                  rIdx === 0 ? 'bg-zinc-900 border-zinc-800 opacity-40' : 'bg-zinc-800 border-zinc-700'
                }`}
              >
                <Ionicons name="chevron-up" size={14} color={rIdx === 0 ? '#71717A' : '#E4E4E7'} />
              </TouchableOpacity>

              {/* Move Down */}
              <TouchableOpacity
                disabled={rIdx === routines.length - 1}
                onPress={() => handleMoveRoutineDown(rIdx)}
                className={`p-1.5 rounded-lg border ${
                  rIdx === routines.length - 1
                    ? 'bg-zinc-900 border-zinc-800 opacity-40'
                    : 'bg-zinc-800 border-zinc-700'
                }`}
              >
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={rIdx === routines.length - 1 ? '#71717A' : '#E4E4E7'}
                />
              </TouchableOpacity>

              {/* Delete Routine */}
              <TouchableOpacity
                onPress={() => handleDeleteRoutine(rIdx)}
                className="p-1.5 bg-red-950/40 border border-red-800/60 rounded-lg ml-1"
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Routine Name Input */}
          <TextInput
            value={r.name}
            onChangeText={(text) => {
              setRoutines((prev) => {
                const updated = [...prev];
                updated[rIdx].name = text;
                return updated;
              });
            }}
            placeholder="e.g. Upper Body Strength"
            placeholderTextColor="#71717A"
            className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold text-sm"
          />

          {/* Included Exercises Section with Delete Trash Buttons */}
          <View className="flex-row items-center justify-between mb-2 mt-1">
            <Text className="text-xs font-bold text-zinc-300">
              Included Exercises ({r.exerciseIds.length})
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setPickerSearch('');
                setActivePickerRoutineIdx(rIdx);
              }}
              className="flex-row items-center bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg"
            >
              <Ionicons name="add" size={14} color="#06B6D4" />
              <Text className="text-[11px] font-bold text-accent-cyan ml-1">+ Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {/* Included Exercises List */}
          {r.exerciseIds.length > 0 ? (
            <View className="space-y-1.5 mb-2">
              {r.exerciseIds.map((exId, exIdx) => {
                const exDef = exercises.find((e) => e.id === exId);
                const exName = exDef ? exDef.name : 'Unknown Exercise';
                const muscle = exDef ? exDef.muscleGroup : 'Other';

                return (
                  <View
                    key={`${exId}-${exIdx}`}
                    className="bg-zinc-950 border border-zinc-800/80 px-3 py-2 rounded-xl flex-row items-center justify-between mb-1.5"
                  >
                    <View className="flex-row items-center space-x-2 flex-1 mr-2">
                      <View className="w-5 h-5 rounded-full bg-zinc-900 items-center justify-center">
                        <Text className="text-[10px] font-bold text-zinc-400">{exIdx + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-white" numberOfLines={1}>
                          {exName}
                        </Text>
                        <Text className="text-[10px] text-zinc-400">{muscle}</Text>
                      </View>
                    </View>

                    {/* Trash/Remove Icon Button */}
                    <TouchableOpacity
                      onPress={() => handleRemoveExerciseFromRoutine(rIdx, exId, exName)}
                      className="p-1.5 bg-zinc-900 rounded-lg border border-zinc-800"
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="bg-zinc-950/80 p-3 rounded-xl border border-dashed border-zinc-800 mb-2 items-center">
              <Text className="text-xs text-zinc-500">No exercises added yet. Tap "+ Add Exercise".</Text>
            </View>
          )}
        </View>
      ))}

      {/* Save Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleSave}
        className="bg-accent-cyan p-4 rounded-2xl items-center mb-10 shadow-lg shadow-cyan-500/20"
      >
        <Text className="text-black font-extrabold text-base">
          {isEditing ? 'Save Changes' : 'Save & Set Active Split'}
        </Text>
      </TouchableOpacity>

      {/* MODAL: ADD EXERCISE TO ROUTINE */}
      <Modal visible={activePickerRoutineIdx !== null} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 p-5 rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <View>
                <Text className="text-base font-black text-white">Add Exercise to Routine</Text>
                <Text className="text-xs text-zinc-400">
                  {activePickerRoutineIdx !== null ? routines[activePickerRoutineIdx]?.name : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActivePickerRoutineIdx(null)}>
                <Ionicons name="close-circle" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-3">
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search by name, muscle, or equipment..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs font-medium"
              />
              {pickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPickerSearch('')}>
                  <Ionicons name="close" size={16} color="#A1A1AA" />
                </TouchableOpacity>
              )}
            </View>

            {/* List of exercises */}
            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[380px]">
              {exercises
                .filter((ex) => {
                  if (!pickerSearch.trim()) return true;
                  const q = pickerSearch.toLowerCase();
                  return (
                    ex.name.toLowerCase().includes(q) ||
                    ex.muscleGroup.toLowerCase().includes(q) ||
                    ex.equipment.toLowerCase().includes(q)
                  );
                })
                .map((ex) => {
                  const currentRoutine =
                    activePickerRoutineIdx !== null ? routines[activePickerRoutineIdx] : null;
                  const isAlreadyIncluded = currentRoutine?.exerciseIds.includes(ex.id) || false;

                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => {
                        if (activePickerRoutineIdx !== null) {
                          if (isAlreadyIncluded) {
                            handleRemoveExerciseFromRoutine(activePickerRoutineIdx, ex.id, ex.name);
                          } else {
                            handleAddExerciseToRoutine(activePickerRoutineIdx, ex.id);
                          }
                        }
                      }}
                      className={`p-3 rounded-xl mb-2 border flex-row items-center justify-between ${
                        isAlreadyIncluded
                          ? 'bg-zinc-800/90 border-accent-cyan'
                          : 'bg-zinc-950 border-zinc-800/70'
                      }`}
                    >
                      <View className="flex-1 mr-2">
                        <Text
                          className={`text-xs font-bold ${
                            isAlreadyIncluded ? 'text-accent-cyan' : 'text-white'
                          }`}
                        >
                          {ex.name}
                        </Text>
                        <Text className="text-[10px] text-zinc-400 mt-0.5">
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>

                      <View
                        className={`w-7 h-7 rounded-lg items-center justify-center border ${
                          isAlreadyIncluded
                            ? 'bg-accent-cyan border-accent-cyan'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <Ionicons
                          name={isAlreadyIncluded ? 'checkmark' : 'add'}
                          size={16}
                          color={isAlreadyIncluded ? '#09090B' : '#A1A1AA'}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            {/* Done button */}
            <TouchableOpacity
              onPress={() => setActivePickerRoutineIdx(null)}
              className="bg-accent-cyan p-3.5 rounded-xl items-center mt-3"
            >
              <Text className="text-black font-extrabold text-sm">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* Share Workout Split Modal */}
      {existingSplit && (
        <ShareWorkoutModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareCode={shareCode}
          title={existingSplit.name}
          type="split"
          routinesCount={existingSplit.routines.length}
          exercisesCount={existingSplit.routines.reduce(
            (acc, r) => acc + (r.exerciseIds?.length || 0),
            0
          )}
          isGenerating={isGeneratingShare}
        />
      )}
    </ScrollView>
  );
}
