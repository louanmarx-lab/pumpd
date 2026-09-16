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
import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { Split, Routine } from '../../../src/types';

export default function ProgramsScreen() {
  const router = useRouter();
  const {
    activeWorkspace,
    splits,
    clients,
    exercises,
    addSplit,
    updateSplit,
    deleteSplit,
    updateClient,
  } = useUserWorkspace();

  // Create Split Modal
  const [showCreateSplitModal, setShowCreateSplitModal] = useState(false);
  const [newSplitName, setNewSplitName] = useState('');
  const [newSplitDescription, setNewSplitDescription] = useState('');

  // Assign Split to Client Modal
  const [selectedSplitToAssign, setSelectedSplitToAssign] = useState<Split | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Add Routine to Split Modal
  const [activeSplitForRoutine, setActiveSplitForRoutine] = useState<Split | null>(null);
  const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');

  // Handle Create Split
  const handleCreateSplit = () => {
    if (!newSplitName.trim()) {
      Alert.alert('Required', 'Please enter a split name.');
      return;
    }

    addSplit({
      userId: activeWorkspace.ownerId,
      name: newSplitName.trim(),
      description: newSplitDescription.trim() || undefined,
      routines: [],
      isActive: false,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewSplitName('');
    setNewSplitDescription('');
    setShowCreateSplitModal(false);
  };

  // Handle Assign Split to Client
  const handleAssignToClient = (clientId: string) => {
    if (!selectedSplitToAssign) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const routineIds = selectedSplitToAssign.routines.map((r) => r.id);
    const routineNames = selectedSplitToAssign.routines.map((r) => r.name);

    updateClient({
      ...client,
      assignedRoutineIds: routineIds,
      assignedRoutineNames: routineNames,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Program Assigned! 🎉',
      `Assigned "${selectedSplitToAssign.name}" (${routineNames.length} routines) to ${client.name}.`
    );
    setShowAssignModal(false);
    setSelectedSplitToAssign(null);
  };

  // Handle Add Routine to Split
  const handleAddRoutine = () => {
    if (!activeSplitForRoutine || !newRoutineName.trim()) {
      Alert.alert('Required', 'Please enter a routine name.');
      return;
    }

    const newRoutine: Routine = {
      id: `rtn_${Date.now()}`,
      name: newRoutineName.trim(),
      exerciseIds: selectedExerciseIds,
    };

    updateSplit({
      ...activeSplitForRoutine,
      routines: [...activeSplitForRoutine.routines, newRoutine],
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewRoutineName('');
    setSelectedExerciseIds([]);
    setShowAddRoutineModal(false);
    setActiveSplitForRoutine(null);
  };

  const toggleExerciseSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExerciseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSplit = (splitId: string, name: string) => {
    Alert.alert('Delete Program', `Are you sure you want to remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSplit(splitId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header action bar */}
      <View className="bg-dark-card border-b border-dark-border px-4 py-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white font-extrabold text-base">Client Program Library</Text>
          <Text className="text-zinc-400 text-xs">Build splits & assign routines to clients</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCreateSplitModal(true);
          }}
          className="bg-accent-cyan px-3 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
        >
          <Ionicons name="add" size={18} color="#09090B" />
          <Text className="text-black font-extrabold text-xs">New Program</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-3.5 mb-4 flex-row items-center space-x-3">
          <View className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 items-center justify-center">
            <Ionicons name="barbell" size={18} color="#06B6D4" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-cyan-300">Coach Library Isolation</Text>
            <Text className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
              Programs created here are assigned directly to your clients' portfolios without affecting your personal training logs.
            </Text>
          </View>
        </View>

        {/* Splits List */}
        {splits.length === 0 ? (
          <View className="items-center justify-center py-16 px-6">
            <View className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center mb-3">
              <Ionicons name="folder-open-outline" size={32} color="#71717A" />
            </View>
            <Text className="text-white font-bold text-base mb-1">No Programs Created Yet</Text>
            <Text className="text-zinc-400 text-xs text-center leading-relaxed mb-4">
              Create your first workout split to prescribe to your roster of athletes.
            </Text>
            <TouchableOpacity
              onPress={() => setShowCreateSplitModal(true)}
              className="bg-accent-cyan px-4 py-2.5 rounded-xl flex-row items-center space-x-1.5"
            >
              <Ionicons name="add-circle" size={16} color="#09090B" />
              <Text className="text-black font-black text-xs">Create First Program</Text>
            </TouchableOpacity>
          </View>
        ) : (
          splits.map((split) => (
            <View
              key={split.id}
              className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md"
            >
              {/* Program Header */}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-white font-bold text-base">{split.name}</Text>
                  {split.description ? (
                    <Text className="text-zinc-400 text-xs mt-0.5">{split.description}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteSplit(split.id, split.name)}
                  className="p-1.5"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Routines Badge Grid */}
              <View className="my-2">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Routines ({split.routines.length}):
                </Text>

                {split.routines.length === 0 ? (
                  <Text className="text-xs text-zinc-500 italic">No workout days added yet</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-1.5">
                    {split.routines.map((r) => (
                      <View
                        key={r.id}
                        className="bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg flex-row items-center space-x-1.5"
                      >
                        <Ionicons name="fitness-outline" size={12} color="#06B6D4" />
                        <Text className="text-xs font-bold text-zinc-200">{r.name}</Text>
                        <Text className="text-[10px] text-zinc-500">
                          ({r.exerciseIds.length} ex)
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View className="flex-row items-center space-x-2 mt-3 pt-3 border-t border-zinc-800/80">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveSplitForRoutine(split);
                    setShowAddRoutineModal(true);
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-750 py-2.5 rounded-xl items-center flex-row justify-center space-x-1.5"
                >
                  <Ionicons name="add" size={14} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Add Routine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedSplitToAssign(split);
                    setShowAssignModal(true);
                  }}
                  className="flex-1 bg-accent-cyan py-2.5 rounded-xl items-center flex-row justify-center space-x-1.5 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="person-add" size={14} color="#09090B" />
                  <Text className="text-xs font-black text-black">Assign to Client</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* CREATE SPLIT MODAL */}
      <Modal visible={showCreateSplitModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <Text className="text-lg font-bold text-white">Create New Program</Text>
              <TouchableOpacity onPress={() => setShowCreateSplitModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Program Name
            </Text>
            <TextInput
              value={newSplitName}
              onChangeText={setNewSplitName}
              placeholder="e.g. Hypertrophy PPL or 4-Day Strength Peaking"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm mb-4 font-semibold"
            />

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Description / Focus
            </Text>
            <TextInput
              value={newSplitDescription}
              onChangeText={setNewSplitDescription}
              placeholder="e.g. Designed for intermediate lifters seeking muscle growth"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm mb-6"
            />

            <TouchableOpacity
              onPress={handleCreateSplit}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-extrabold text-sm">Save Program to Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ASSIGN SPLIT TO CLIENT MODAL */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-bold text-white">Assign Program to Client</Text>
                <Text className="text-xs text-accent-cyan font-semibold mt-0.5">
                  {selectedSplitToAssign?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Select Client from Roster
            </Text>

            {clients.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-zinc-400 text-sm mb-2">No clients in your roster yet.</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAssignModal(false);
                    router.push('/clients');
                  }}
                  className="bg-cyan-500/20 px-4 py-2 rounded-xl"
                >
                  <Text className="text-cyan-300 font-bold text-xs">Add Clients in CRM Tab</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView className="mb-4">
                {clients.map((client) => {
                  const isAssigned = client.assignedRoutineNames.some((name) =>
                    selectedSplitToAssign?.routines.some((r) => r.name === name)
                  );

                  return (
                    <TouchableOpacity
                      key={client.id}
                      onPress={() => handleAssignToClient(client.id)}
                      className={`p-3.5 rounded-xl mb-2 flex-row items-center justify-between border ${
                        isAssigned
                          ? 'bg-emerald-950/20 border-emerald-500/50'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <View className="flex-row items-center space-x-3">
                        <Text className="text-2xl">{client.avatarEmoji || '⚡'}</Text>
                        <View>
                          <Text className="text-sm font-bold text-white">{client.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {client.assignedRoutineNames.length > 0
                              ? `Current: ${client.assignedRoutineNames.join(', ')}`
                              : 'No split assigned'}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`px-3 py-1.5 rounded-lg ${
                          isAssigned ? 'bg-emerald-500/20' : 'bg-cyan-500'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isAssigned ? 'text-emerald-400' : 'text-black'
                          }`}
                        >
                          {isAssigned ? 'Re-assign' : 'Assign'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ADD ROUTINE MODAL */}
      <Modal visible={showAddRoutineModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-bold text-white">Add Workout Day</Text>
                <Text className="text-xs text-accent-cyan font-semibold">
                  To {activeSplitForRoutine?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddRoutineModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Routine / Day Name
            </Text>
            <TextInput
              value={newRoutineName}
              onChangeText={setNewRoutineName}
              placeholder="e.g. Push Day, Pull Heavy, Leg Hypertrophy"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm mb-3 font-semibold"
            />

            {/* Exercise Selector */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Select Exercises ({selectedExerciseIds.length} selected)
            </Text>

            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-2">
              <Ionicons name="search" size={14} color="#71717A" />
              <TextInput
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                placeholder="Search exercise..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs"
              />
            </View>

            <ScrollView className="max-h-60 mb-4">
              {exercises
                .filter((ex) => !exerciseSearch || ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                .map((ex) => {
                  const isSelected = selectedExerciseIds.includes(ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => toggleExerciseSelection(ex.id)}
                      className={`p-2.5 rounded-lg mb-1.5 flex-row items-center justify-between border ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500/50'
                          : 'bg-zinc-900/60 border-zinc-800/60'
                      }`}
                    >
                      <View>
                        <Text className="text-xs font-bold text-white">{ex.name}</Text>
                        <Text className="text-[10px] text-zinc-400">
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={isSelected ? '#06B6D4' : '#71717A'}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleAddRoutine}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-extrabold text-sm">Save Routine to Program</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
