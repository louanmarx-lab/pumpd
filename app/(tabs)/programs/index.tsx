import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { Split, Routine, Exercise, MuscleGroup } from '../../../src/types';

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

const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Smith Machine',
  'Bodyweight',
  'Bands',
  'Kettlebell',
  'EZ-Bar',
  'Other',
];

const MUSCLE_COLORS: Record<MuscleGroup, { bg: string; border: string; text: string }> = {
  Chest: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300' },
  Back: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  Quads: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
  Hamstrings: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300' },
  Shoulders: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300' },
  Biceps: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
  Triceps: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300' },
  Calves: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-300' },
  Abs: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300' },
};

interface BuilderRoutine {
  id: string;
  name: string;
  exerciseIds: string[];
}

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
    assignSplitToClient,
    assignSplitToSelf,
    enterPersonalAthleteMode,
    clearAllCoachSplits,
    currentUser,
    addExercise,
    updateExercise,
    deleteExercise,
    toggleStarExercise,
    coachProfile,
    startManagingClient,
    userRole,
    managedClient,
    isViewingPersonalProfile,
  } = useUserWorkspace();

  React.useEffect(() => {
    if (userRole === 'athlete' && !managedClient && !isViewingPersonalProfile) {
      router.replace('/(tabs)/workouts');
    }
  }, [userRole, managedClient, isViewingPersonalProfile]);

  // Top Nav Tab: Programs & Splits vs Exercise Vault
  const [activeTab, setActiveTab] = useState<'programs' | 'exercises'>('programs');

  // Search & Filter State
  const [programSearch, setProgramSearch] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string>('All');
  const [exercisePageSize, setExercisePageSize] = useState(30);

  // Accordion state to collapse/expand program routines for high performance
  const [expandedSplitIds, setExpandedSplitIds] = useState<Record<string, boolean>>({});
  const toggleExpandSplit = (splitId: string) => {
    Haptics.selectionAsync();
    setExpandedSplitIds((prev) => ({ ...prev, [splitId]: !prev[splitId] }));
  };

  // ==========================================
  // PROGRAM BUILDER MODAL STATE (Create / Edit)
  // ==========================================
  const [showProgramBuilderModal, setShowProgramBuilderModal] = useState(false);
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderRoutines, setBuilderRoutines] = useState<BuilderRoutine[]>([]);

  // Sub-modal: Pick Exercises for a specific routine inside builder
  const [builderActiveRoutineIdx, setBuilderActiveRoutineIdx] = useState<number | null>(null);
  const [showBuilderExercisePicker, setShowBuilderExercisePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMuscleFilter, setPickerMuscleFilter] = useState<string>('All');

  // ==========================================
  // ADD ROUTINE TO EXISTING SPLIT MODAL
  // ==========================================
  const [activeSplitForAddRoutine, setActiveSplitForAddRoutine] = useState<Split | null>(null);
  const [showAddRoutineModal, setShowAddRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineExerciseIds, setNewRoutineExerciseIds] = useState<string[]>([]);
  const [routineExerciseSearch, setRoutineExerciseSearch] = useState('');

  // ==========================================
  // EDIT EXISTING ROUTINE MODAL
  // ==========================================
  const [editingSplitForRoutine, setEditingSplitForRoutine] = useState<Split | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [showEditRoutineModal, setShowEditRoutineModal] = useState(false);
  const [editRoutineName, setEditRoutineName] = useState('');
  const [editRoutineExerciseIds, setEditRoutineExerciseIds] = useState<string[]>([]);
  const [editRoutineSearch, setEditRoutineSearch] = useState('');

  // ==========================================
  // ASSIGN SPLIT TO CLIENT MODAL
  // ==========================================
  const [selectedSplitToAssign, setSelectedSplitToAssign] = useState<Split | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // ==========================================
  // CUSTOM EXERCISE MODAL (Create / Edit)
  // ==========================================
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exName, setExName] = useState('');
  const [exMuscle, setExMuscle] = useState<MuscleGroup>('Chest');
  const [exEquipment, setExEquipment] = useState('Barbell');
  const [exNotes, setExNotes] = useState('');

  // Map of exercise id -> exercise for quick lookups
  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of exercises) {
      map.set(ex.id, ex);
    }
    return map;
  }, [exercises]);

  // Identify all client user IDs to isolate client-specific splits from master coach templates
  const clientUserIds = useMemo(() => {
    return new Set(clients.flatMap((c) => [c.id, c.linkedUserId].filter(Boolean) as string[]));
  }, [clients]);

  // Master coach templates: only splits that are master programs, NOT individual client runtime splits or presets
  const coachMasterSplits = useMemo(() => {
    return splits.filter(
      (s) =>
        !clientUserIds.has(s.userId) &&
        !s.id.startsWith('split_client_') &&
        !s.id.endsWith('_active') &&
        !s.id.startsWith('preset_') &&
        !s.id.startsWith('split_preset_')
    );
  }, [splits, clientUserIds]);

  const MAX_SPLITS_CAP = 50;
  const isAtCap = coachMasterSplits.length >= MAX_SPLITS_CAP;

  // Filtered splits
  const filteredSplits = useMemo(() => {
    if (!programSearch.trim()) return coachMasterSplits;
    const q = programSearch.toLowerCase();
    return coachMasterSplits.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.routines.some((r) => r.name.toLowerCase().includes(q))
    );
  }, [coachMasterSplits, programSearch]);

  // Filtered exercises (Starred exercises sorted to the top)
  const filteredExercises = useMemo(() => {
    return exercises
      .filter((ex) => {
        const matchesSearch =
          !exerciseSearch.trim() ||
          ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
          ex.equipment.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
          ex.muscleGroup.toLowerCase().includes(exerciseSearch.toLowerCase());

        if (!matchesSearch) return false;

        if (selectedMuscleFilter === 'All') return true;
        if (selectedMuscleFilter === 'Starred') return Boolean(ex.isStarred);
        if (selectedMuscleFilter === 'Custom') return Boolean(ex.customByCoach || ex.workspaceId !== null);
        return ex.muscleGroup === selectedMuscleFilter;
      })
      .sort((a, b) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [exercises, exerciseSearch, selectedMuscleFilter]);

  // ==========================================
  // SPLIT ACTIONS
  // ==========================================

  // Open Builder for brand-new Program
  const handleOpenNewProgramBuilder = () => {
    if (isAtCap) {
      Alert.alert(
        'Split Limit Reached (50/50)',
        'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingSplitId(null);
    setBuilderName('');
    setBuilderDescription('');
    setBuilderRoutines([
      { id: `rtn_${Date.now()}_1`, name: 'Day 1: Upper Body', exerciseIds: ['ex_1', 'ex_5', 'ex_13'] },
      { id: `rtn_${Date.now()}_2`, name: 'Day 2: Lower Body', exerciseIds: ['ex_8', 'ex_11', 'ex_20'] },
    ]);
    setShowProgramBuilderModal(true);
  };

  // Open Builder to edit existing Program
  const handleOpenEditSplit = (split: Split) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingSplitId(split.id);
    setBuilderName(split.name);
    setBuilderDescription(split.description || '');
    setBuilderRoutines(
      split.routines.map((r) => ({
        id: r.id,
        name: r.name,
        exerciseIds: [...r.exerciseIds],
      }))
    );
    setShowProgramBuilderModal(true);
  };

  // Clone / Duplicate Split
  const handleDuplicateSplit = (split: Split) => {
    if (isAtCap) {
      Alert.alert(
        'Split Limit Reached (50/50)',
        'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const clonedRoutines: Routine[] = split.routines.map((r, idx) => ({
      id: `rtn_${Date.now()}_${idx}`,
      name: r.name,
      exerciseIds: [...r.exerciseIds],
    }));

    addSplit({
      userId: activeWorkspace.ownerId,
      name: `${split.name} (Copy)`,
      description: split.description,
      routines: clonedRoutines,
      isActive: false,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Program Duplicated! 📑', `Created a copy of "${split.name}" in your library.`);
  };

  // Clear All Programs (with confirmation)
  const handleClearAllPrograms = () => {
    if (coachMasterSplits.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Clear All Programs?',
      `Are you sure you want to permanently delete all ${coachMasterSplits.length} programs from your library? Your library will start fresh at 0/50.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            clearAllCoachSplits();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Library Cleared', 'All programs removed from your coaching library.');
          },
        },
      ]
    );
  };

  // Delete Split with confirmation (No silent restrictions!)
  const handleDeleteSplit = (splitId: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Program',
      `Are you sure you want to permanently remove "${name}" from your library? Clients currently assigned to this split will retain their workout logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Program',
          style: 'destructive',
          onPress: () => {
            deleteSplit(splitId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Deleted', `"${name}" removed from library.`);
          },
        },
      ]
    );
  };

  // Save Builder (Create or Update)
  const handleSaveProgramBuilder = () => {
    if (!editingSplitId && isAtCap) {
      Alert.alert(
        'Split Limit Reached (50/50)',
        'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.'
      );
      return;
    }

    if (!builderName.trim()) {
      Alert.alert('Required', 'Please enter a program name.');
      return;
    }

    if (builderRoutines.length === 0) {
      Alert.alert('Required', 'Please add at least one workout day to this program.');
      return;
    }

    const cleanedRoutines: Routine[] = builderRoutines.map((r, idx) => ({
      id: r.id || `rtn_${Date.now()}_${idx}`,
      name: r.name.trim() || `Workout Day ${idx + 1}`,
      exerciseIds: r.exerciseIds || [],
    }));

    if (editingSplitId) {
      const existing = splits.find((s) => s.id === editingSplitId);
      if (existing) {
        updateSplit({
          ...existing,
          name: builderName.trim(),
          description: builderDescription.trim() || undefined,
          routines: cleanedRoutines,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Program Updated', `"${builderName.trim()}" changes saved.`);
      }
    } else {
      addSplit({
        userId: activeWorkspace.ownerId,
        name: builderName.trim(),
        description: builderDescription.trim() || undefined,
        routines: cleanedRoutines,
        isActive: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Program Created! 🎉', `"${builderName.trim()}" added to your coaching library.`);
    }

    setShowProgramBuilderModal(false);
  };

  // Builder: Add Day
  const handleBuilderAddDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBuilderRoutines((prev) => [
      ...prev,
      {
        id: `rtn_${Date.now()}_${prev.length + 1}`,
        name: `Day ${prev.length + 1}: Workout`,
        exerciseIds: [],
      },
    ]);
  };

  // Builder: Remove Day
  const handleBuilderRemoveDay = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBuilderRoutines((prev) => prev.filter((_, i) => i !== index));
  };

  // Builder: Open Exercise Selector for Day
  const handleOpenBuilderExercisePicker = (routineIdx: number) => {
    Haptics.selectionAsync();
    setBuilderActiveRoutineIdx(routineIdx);
    setPickerSearch('');
    setPickerMuscleFilter('All');
    setShowBuilderExercisePicker(true);
  };

  // Builder: Toggle exercise in active routine
  const handleTogglePickerExercise = (exerciseId: string) => {
    if (builderActiveRoutineIdx === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBuilderRoutines((prev) => {
      const updated = [...prev];
      const target = { ...updated[builderActiveRoutineIdx] };
      if (target.exerciseIds.includes(exerciseId)) {
        target.exerciseIds = target.exerciseIds.filter((id) => id !== exerciseId);
      } else {
        target.exerciseIds = [...target.exerciseIds, exerciseId];
      }
      updated[builderActiveRoutineIdx] = target;
      return updated;
    });
  };

  // ==========================================
  // ROUTINE LEVEL ACTIONS
  // ==========================================

  // Delete Routine from Split
  const handleDeleteRoutineFromSplit = (split: Split, routineId: string, routineName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Workout Day', `Remove "${routineName}" from ${split.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Day',
        style: 'destructive',
        onPress: () => {
          const updatedRoutines = split.routines.filter((r) => r.id !== routineId);
          updateSplit({
            ...split,
            routines: updatedRoutines,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  // Add Routine directly to an existing Split
  const handleOpenAddRoutineModal = (split: Split) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSplitForAddRoutine(split);
    setNewRoutineName(`Day ${split.routines.length + 1}: Workout`);
    setNewRoutineExerciseIds([]);
    setRoutineExerciseSearch('');
    setShowAddRoutineModal(true);
  };

  const handleSaveNewRoutineToSplit = () => {
    if (!activeSplitForAddRoutine || !newRoutineName.trim()) {
      Alert.alert('Required', 'Please enter a routine name.');
      return;
    }

    const newRoutine: Routine = {
      id: `rtn_${Date.now()}`,
      name: newRoutineName.trim(),
      exerciseIds: newRoutineExerciseIds,
    };

    updateSplit({
      ...activeSplitForAddRoutine,
      routines: [...activeSplitForAddRoutine.routines, newRoutine],
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddRoutineModal(false);
    setActiveSplitForAddRoutine(null);
  };

  // Edit Routine Exercises
  const handleOpenEditRoutine = (split: Split, routine: Routine) => {
    Haptics.selectionAsync();
    setEditingSplitForRoutine(split);
    setEditingRoutine(routine);
    setEditRoutineName(routine.name);
    setEditRoutineExerciseIds([...routine.exerciseIds]);
    setEditRoutineSearch('');
    setShowEditRoutineModal(true);
  };

  const handleSaveEditRoutine = () => {
    if (!editingSplitForRoutine || !editingRoutine || !editRoutineName.trim()) {
      Alert.alert('Required', 'Please enter a routine name.');
      return;
    }

    const updatedRoutines = editingSplitForRoutine.routines.map((r) =>
      r.id === editingRoutine.id
        ? { ...r, name: editRoutineName.trim(), exerciseIds: editRoutineExerciseIds }
        : r
    );

    updateSplit({
      ...editingSplitForRoutine,
      routines: updatedRoutines,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditRoutineModal(false);
    setEditingSplitForRoutine(null);
    setEditingRoutine(null);
  };

  // ==========================================
  // ASSIGN SPLIT TO CLIENT / SELF
  // ==========================================
  const handleAssignToSelf = () => {
    if (!selectedSplitToAssign) return;

    assignSplitToSelf(selectedSplitToAssign);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Program Assigned to You! 🏋️',
      `"${selectedSplitToAssign.name}" (${selectedSplitToAssign.routines.length} routines) has been assigned to your personal athlete profile.`,
      [
        {
          text: 'View in My Workouts →',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            enterPersonalAthleteMode();
            router.push('/(tabs)/workouts');
          },
        },
        { text: 'Done', style: 'cancel' },
      ]
    );
    setShowAssignModal(false);
    setSelectedSplitToAssign(null);
  };

  const handleAssignToClient = (clientId: string) => {
    if (!selectedSplitToAssign) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const routineIds = selectedSplitToAssign.routines.map((r) => r.id);
    const routineNames = selectedSplitToAssign.routines.map((r) => r.name);

    // Push split directly to client's Firestore document so their phone receives it
    assignSplitToClient(clientId, selectedSplitToAssign);

    const updatedClient = {
      ...client,
      assignedSplitId: selectedSplitToAssign.id,
      assignedSplitName: selectedSplitToAssign.name,
      assignedRoutineIds: routineIds,
      assignedRoutineNames: routineNames,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Program Assigned! 🎉',
      `Assigned "${selectedSplitToAssign.name}" (${routineNames.length} routines) to ${client.name}.`,
      [
        {
          text: 'View in Client Profile →',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            startManagingClient(updatedClient);
            router.push('/(tabs)/workouts');
          },
        },
        { text: 'Done', style: 'cancel' },
      ]
    );
    setShowAssignModal(false);
    setSelectedSplitToAssign(null);
  };

  // ==========================================
  // CUSTOM EXERCISE ACTIONS
  // ==========================================
  const handleOpenNewExerciseModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditingExerciseId(null);
    setExName('');
    setExMuscle('Chest');
    setExEquipment('Barbell');
    setExNotes('');
    setShowExerciseModal(true);
  };

  const handleOpenEditExerciseModal = (ex: Exercise) => {
    Haptics.selectionAsync();
    setEditingExerciseId(ex.id);
    setExName(ex.name);
    setExMuscle(ex.muscleGroup);
    setExEquipment(ex.equipment);
    setExNotes(ex.notes || '');
    setShowExerciseModal(true);
  };

  const handleSaveExercise = () => {
    if (!exName.trim()) {
      Alert.alert('Required', 'Please enter an exercise name.');
      return;
    }

    if (editingExerciseId) {
      updateExercise({
        id: editingExerciseId,
        workspaceId: activeWorkspace.id,
        name: exName.trim(),
        muscleGroup: exMuscle,
        equipment: exEquipment.trim() || 'Custom',
        notes: exNotes.trim() || undefined,
        customByCoach: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Exercise Updated', `"${exName.trim()}" updated successfully.`);
    } else {
      addExercise({
        workspaceId: activeWorkspace.id,
        name: exName.trim(),
        muscleGroup: exMuscle,
        equipment: exEquipment.trim() || 'Custom',
        notes: exNotes.trim() || undefined,
        customByCoach: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Exercise Added! ⭐', `"${exName.trim()}" is now available in your Exercise Vault and Split Builder.`);
    }

    setShowExerciseModal(false);
  };

  const handleDeleteExercise = (ex: Exercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to remove "${ex.name}" from your Exercise Vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteExercise(ex.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* HEADER: DUAL-TAB SEGMENTED CONTROLLER ONLY (No overlapping titles) */}
      <View className="bg-dark-card border-b border-dark-border px-4 py-2.5">
        <View className="flex-row bg-zinc-900 border border-zinc-800 rounded-2xl p-1">
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('programs');
            }}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row space-x-2 ${
              activeTab === 'programs' ? 'bg-zinc-800 border border-zinc-700' : ''
            }`}
          >
            <Ionicons
              name="barbell"
              size={14}
              color={activeTab === 'programs' ? '#06B6D4' : '#71717A'}
            />
            <Text
              numberOfLines={1}
              className={`text-xs font-bold ${
                activeTab === 'programs' ? 'text-white' : 'text-zinc-400'
              }`}
            >
              Programs ({coachMasterSplits.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('exercises');
            }}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row space-x-2 ${
              activeTab === 'exercises' ? 'bg-zinc-800 border border-zinc-700' : ''
            }`}
          >
            <Ionicons
              name="library"
              size={14}
              color={activeTab === 'exercises' ? '#06B6D4' : '#71717A'}
            />
            <Text
              numberOfLines={1}
              className={`text-xs font-bold ${
                activeTab === 'exercises' ? 'text-white' : 'text-zinc-400'
              }`}
            >
              Exercise Vault ({exercises.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: PROGRAMS & SPLITS LIBRARY */}
      {/* ========================================================================= */}
      {activeTab === 'programs' && (
        <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
          {/* Quick Metrics Bar with 50 Cap Indicator */}
          <View className="flex-row justify-between bg-zinc-950/80 border border-zinc-850 rounded-2xl p-3 mb-3.5">
            <View className="items-center flex-1 border-r border-zinc-850">
              <Text className="text-[9px] text-zinc-500 font-bold uppercase">Library Cap</Text>
              <Text className={`text-base font-black ${isAtCap ? 'text-amber-400' : 'text-white'}`}>
                {coachMasterSplits.length} / {MAX_SPLITS_CAP}
              </Text>
            </View>
            <View className="items-center flex-1 border-r border-zinc-850">
              <Text className="text-[9px] text-zinc-500 font-bold uppercase">Workout Days</Text>
              <Text className="text-base font-black text-accent-cyan">
                {coachMasterSplits.reduce((acc, s) => acc + s.routines.length, 0)}
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-[9px] text-zinc-500 font-bold uppercase">Assigned Clients</Text>
              <Text className="text-base font-black text-emerald-400">
                {clients.filter((c) => c.assignedRoutineNames && c.assignedRoutineNames.length > 0).length}
              </Text>
            </View>
          </View>

          {/* Action Row: Search Bar + Clear All + Build Program Button */}
          <View className="flex-row items-center space-x-2 mb-3.5">
            <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 flex-row items-center space-x-2">
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                value={programSearch}
                onChangeText={setProgramSearch}
                placeholder="Search programs by title or focus..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs font-medium"
              />
              {programSearch.length > 0 && (
                <TouchableOpacity onPress={() => setProgramSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#71717A" />
                </TouchableOpacity>
              )}
            </View>

            {coachMasterSplits.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAllPrograms}
                className="p-2.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl items-center justify-center shrink-0"
                accessibilityLabel="Clear All Programs"
              >
                <Ionicons name="trash-outline" size={16} color="#F43F5E" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleOpenNewProgramBuilder}
              className={`px-3.5 py-2.5 rounded-2xl flex-row items-center space-x-1.5 shadow-md shrink-0 ${
                isAtCap ? 'bg-zinc-800 opacity-60' : 'bg-accent-cyan shadow-cyan-500/20'
              }`}
            >
              <Ionicons name="add" size={17} color={isAtCap ? '#A1A1AA' : '#09090B'} />
              <Text className={`font-black text-xs ${isAtCap ? 'text-zinc-400' : 'text-black'}`}>
                Build
              </Text>
            </TouchableOpacity>
          </View>

          {/* Programs List */}
          {filteredSplits.length === 0 ? (
            <View className="bg-dark-card border border-dashed border-zinc-800 rounded-3xl p-8 items-center justify-center my-6">
              <View className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center mb-3">
                <Ionicons name="barbell-outline" size={28} color="#71717A" />
              </View>
              <Text className="text-white font-bold text-base mb-1">
                {programSearch ? 'No Programs Match Search' : 'No Programs in Library Yet'}
              </Text>
              <Text className="text-zinc-400 text-xs text-center leading-relaxed mb-4 max-w-xs">
                {programSearch
                  ? 'Try searching for a different routine or keyword.'
                  : 'Design your custom master workout splits here before assigning them to clients. (Cap: 50 splits)'}
              </Text>
              <TouchableOpacity
                onPress={handleOpenNewProgramBuilder}
                className="bg-accent-cyan px-4 py-2.5 rounded-xl flex-row items-center space-x-1.5 shadow-md shadow-cyan-500/20"
              >
                <Ionicons name="add-circle" size={16} color="#09090B" />
                <Text className="text-black font-black text-xs">Build Your First Program</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredSplits.map((split) => {
              const totalExercises = split.routines.reduce(
                (acc, r) => acc + (r.exerciseIds?.length || 0),
                0
              );
              const isExpanded = Boolean(expandedSplitIds[split.id]);
              const assignedCount = clients.filter(
                (c) => c.assignedSplitId === split.id || c.assignedSplitName === split.name
              ).length;

              return (
                <View
                  key={split.id}
                  className="bg-dark-card border border-dark-border rounded-2xl p-3.5 mb-2.5 shadow-sm"
                >
                  {/* Compact Header Row */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpandSplit(split.id)}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2.5">
                      <View className="flex-row items-center space-x-2">
                        <Text className="text-white font-bold text-sm" numberOfLines={1}>
                          {split.name}
                        </Text>
                      </View>

                      {/* Compact Badges */}
                      <View className="flex-row items-center flex-wrap gap-1.5 mt-1.5">
                        <View className="bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-md flex-row items-center space-x-1">
                          <Ionicons name="calendar-outline" size={10} color="#06B6D4" />
                          <Text className="text-[10px] font-bold text-cyan-300">
                            {split.routines.length} {split.routines.length === 1 ? 'Day' : 'Days'}
                          </Text>
                        </View>

                        <View className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md flex-row items-center space-x-1">
                          <Ionicons name="barbell-outline" size={10} color="#A1A1AA" />
                          <Text className="text-[10px] font-bold text-zinc-400">
                            {totalExercises} Ex
                          </Text>
                        </View>

                        {assignedCount > 0 && (
                          <View className="bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md flex-row items-center space-x-1">
                            <Ionicons name="people" size={10} color="#10B981" />
                            <Text className="text-[10px] font-bold text-emerald-400">
                              {assignedCount} {assignedCount === 1 ? 'Client' : 'Clients'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Quick Actions Right Side */}
                    <View className="flex-row items-center space-x-1.5">
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedSplitToAssign(split);
                          setShowAssignModal(true);
                        }}
                        className="bg-accent-cyan px-2.5 py-1.5 rounded-xl flex-row items-center space-x-1 shadow-sm"
                        accessibilityLabel="Assign to Client"
                      >
                        <Ionicons name="person-add" size={12} color="#09090B" />
                        <Text className="text-[11px] font-black text-black">Assign</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleOpenEditSplit(split)}
                        className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl"
                        accessibilityLabel="Edit Program"
                      >
                        <Ionicons name="create-outline" size={14} color="#A1A1AA" />
                      </TouchableOpacity>

                      <View className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#06B6D4"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Details: Only rendered when user taps this split */}
                  {isExpanded && (
                    <View className="mt-3 pt-3 border-t border-zinc-850">
                      {split.description ? (
                        <Text className="text-zinc-400 text-xs mb-3 leading-relaxed">
                          {split.description}
                        </Text>
                      ) : null}

                      {/* Workout Days List */}
                      <View className="space-y-2 mb-3">
                        {split.routines.length === 0 ? (
                          <View className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80 items-center">
                            <Text className="text-zinc-500 text-xs italic">
                              No workout days configured yet. Tap below to add a day.
                            </Text>
                          </View>
                        ) : (
                          split.routines.map((routine, rIdx) => (
                            <View
                              key={routine.id || `r-${rIdx}`}
                              className="bg-zinc-900/80 border border-zinc-800 p-2.5 rounded-xl"
                            >
                              <View className="flex-row items-center justify-between mb-1">
                                <View className="flex-row items-center space-x-2 flex-1 mr-2">
                                  <View className="w-5 h-5 rounded-md bg-zinc-800 items-center justify-center">
                                    <Text className="text-[10px] font-black text-accent-cyan">
                                      {rIdx + 1}
                                    </Text>
                                  </View>
                                  <Text className="text-xs font-bold text-white flex-1" numberOfLines={1}>
                                    {routine.name}
                                  </Text>
                                </View>

                                <View className="flex-row items-center space-x-1.5">
                                  <TouchableOpacity
                                    onPress={() => handleOpenEditRoutine(split, routine)}
                                    className="p-1 bg-zinc-800 rounded-lg"
                                  >
                                    <Ionicons name="pencil" size={11} color="#06B6D4" />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() =>
                                      handleDeleteRoutineFromSplit(split, routine.id, routine.name)
                                    }
                                    className="p-1 bg-rose-500/10 rounded-lg"
                                  >
                                    <Ionicons name="trash-outline" size={11} color="#F43F5E" />
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Exercise Pills */}
                              {routine.exerciseIds && routine.exerciseIds.length > 0 ? (
                                <View className="flex-row flex-wrap mt-1">
                                  {routine.exerciseIds.slice(0, 5).map((exId, exIdx) => {
                                    const ex = exerciseMap.get(exId);
                                    return (
                                      <View
                                        key={`chip-${exIdx}`}
                                        className="bg-zinc-800/80 border border-zinc-750 px-2 py-0.5 rounded-md mr-1 mb-1 flex-row items-center space-x-1"
                                      >
                                        <Text className="text-[9px] font-semibold text-zinc-300">
                                          {ex ? ex.name : 'Custom Exercise'}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                  {routine.exerciseIds.length > 5 && (
                                    <View className="bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md mr-1 mb-1">
                                      <Text className="text-[9px] font-bold text-cyan-300">
                                        +{routine.exerciseIds.length - 5} more
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              ) : (
                                <Text className="text-[9px] text-zinc-500 italic">
                                  0 exercises — tap edit to add exercises
                                </Text>
                              )}
                            </View>
                          ))
                        )}
                      </View>

                      {/* Card Bottom Actions */}
                      <View className="flex-row items-center justify-between pt-2 border-t border-zinc-850">
                        <View className="flex-row items-center space-x-2">
                          <TouchableOpacity
                            onPress={() => handleOpenAddRoutineModal(split)}
                            className="bg-zinc-900 border border-zinc-750 py-1.5 px-2.5 rounded-xl flex-row items-center space-x-1"
                          >
                            <Ionicons name="add-circle-outline" size={13} color="#06B6D4" />
                            <Text className="text-xs font-bold text-cyan-300">+ Day</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDuplicateSplit(split)}
                            className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl"
                            accessibilityLabel="Duplicate Program"
                          >
                            <Ionicons name="copy-outline" size={13} color="#A1A1AA" />
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteSplit(split.id, split.name)}
                          className="py-1.5 px-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex-row items-center space-x-1"
                          accessibilityLabel="Delete Program"
                        >
                          <Ionicons name="trash-outline" size={13} color="#F43F5E" />
                          <Text className="text-xs font-bold text-rose-400">Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXERCISE VAULT (Coach Database) */}
      {/* ========================================================================= */}
      {activeTab === 'exercises' && (
        <View className="flex-1 px-4 pt-3">
          {/* Action Row: Search Bar + Custom Exercise Button (Side-by-side, no crowding) */}
          <View className="flex-row items-center space-x-2 mb-2.5">
            <View className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 flex-row items-center space-x-2">
              <Ionicons name="search" size={16} color="#71717A" />
              <TextInput
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                placeholder="Search exercise, muscle, equipment..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs font-medium"
              />
              {exerciseSearch.length > 0 && (
                <TouchableOpacity onPress={() => setExerciseSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#71717A" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleOpenNewExerciseModal}
              className="bg-accent-cyan px-3.5 py-2.5 rounded-2xl flex-row items-center space-x-1.5 shadow-md shadow-cyan-500/20 shrink-0"
            >
              <Ionicons name="add" size={17} color="#09090B" />
              <Text className="text-black font-black text-xs">+ Exercise</Text>
            </TouchableOpacity>
          </View>

          {/* Muscle Group & Starred Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0 mb-3"
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {['All', 'Starred', 'Custom', ...MUSCLE_GROUPS].map((item) => {
              const isSelected = selectedMuscleFilter === item;
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedMuscleFilter(item);
                  }}
                  className={`px-3 py-1.5 rounded-xl mr-1.5 border flex-row items-center space-x-1 ${
                    isSelected
                      ? 'bg-accent-cyan border-accent-cyan'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  {item === 'Starred' && (
                    <Ionicons
                      name="star"
                      size={11}
                      color={isSelected ? '#000' : '#F59E0B'}
                    />
                  )}
                  {item === 'Custom' && (
                    <Ionicons
                      name="sparkles"
                      size={11}
                      color={isSelected ? '#000' : '#06B6D4'}
                    />
                  )}
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    {item === 'Starred' ? '⭐ Starred' : item === 'Custom' ? 'My Custom' : item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Exercises List */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {filteredExercises.length === 0 ? (
              <View className="bg-dark-card border border-dashed border-zinc-800 rounded-3xl p-8 items-center justify-center my-6">
                <Ionicons name="fitness-outline" size={32} color="#71717A" />
                <Text className="text-white font-bold text-base mt-2 mb-1">
                  No Exercises Found
                </Text>
                <Text className="text-zinc-400 text-xs text-center mb-4">
                  {selectedMuscleFilter === 'Starred'
                    ? 'You have not starred any exercises yet. Tap the star icon on any exercise to pin it to the top.'
                    : 'Upload custom exercise variations or adjust your filters.'}
                </Text>
                <TouchableOpacity
                  onPress={handleOpenNewExerciseModal}
                  className="bg-accent-cyan px-4 py-2.5 rounded-xl flex-row items-center space-x-1.5"
                >
                  <Ionicons name="add" size={16} color="#000" />
                  <Text className="text-black font-black text-xs">Create Custom Exercise</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {filteredExercises.slice(0, exercisePageSize).map((ex) => {
                const colors = MUSCLE_COLORS[ex.muscleGroup] || {
                  bg: 'bg-zinc-800',
                  border: 'border-zinc-750',
                  text: 'text-zinc-300',
                };
                const isCustom = Boolean(ex.customByCoach || ex.workspaceId);

                return (
                  <View
                    key={ex.id}
                    className={`bg-dark-card border rounded-2xl p-3.5 mb-2.5 shadow-sm ${
                      ex.isStarred ? 'border-amber-500/40 bg-zinc-900/90' : 'border-dark-border'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center space-x-1.5 flex-wrap">
                          <Text className="text-white font-bold text-sm">{ex.name}</Text>
                          {ex.isStarred && (
                            <View className="bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md flex-row items-center space-x-0.5">
                              <Ionicons name="star" size={8} color="#F59E0B" />
                              <Text className="text-[9px] font-black text-amber-400 uppercase">
                                Starred
                              </Text>
                            </View>
                          )}
                          {isCustom && (
                            <View className="bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 rounded-md flex-row items-center space-x-1">
                              <Ionicons name="sparkles" size={8} color="#06B6D4" />
                              <Text className="text-[9px] font-black text-cyan-300 uppercase">
                                Custom
                              </Text>
                            </View>
                          )}
                        </View>

                        <View className="flex-row items-center space-x-2 mt-1.5">
                          <View
                            className={`${colors.bg} border ${colors.border} px-2 py-0.5 rounded-md`}
                          >
                            <Text className={`text-[10px] font-black uppercase ${colors.text}`}>
                              {ex.muscleGroup}
                            </Text>
                          </View>

                          <View className="bg-zinc-800 border border-zinc-750 px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-medium text-zinc-400">
                              {ex.equipment}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action buttons: Star (all), Edit (custom), Delete (all) */}
                      <View className="flex-row items-center space-x-1.5">
                        {/* Star Button */}
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toggleStarExercise(ex.id);
                          }}
                          className={`p-2 rounded-xl border ${
                            ex.isStarred
                              ? 'bg-amber-500/20 border-amber-500/50'
                              : 'bg-zinc-900 border-zinc-800'
                          }`}
                          accessibilityLabel="Star Exercise"
                        >
                          <Ionicons
                            name={ex.isStarred ? 'star' : 'star-outline'}
                            size={14}
                            color={ex.isStarred ? '#F59E0B' : '#71717A'}
                          />
                        </TouchableOpacity>

                        {/* Edit for custom exercises */}
                        {isCustom && (
                          <TouchableOpacity
                            onPress={() => handleOpenEditExerciseModal(ex)}
                            className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl"
                            accessibilityLabel="Edit Exercise"
                          >
                            <Ionicons name="pencil" size={13} color="#06B6D4" />
                          </TouchableOpacity>
                        )}

                        {/* Delete for ALL exercises (pre-existing and custom) */}
                        <TouchableOpacity
                          onPress={() => handleDeleteExercise(ex)}
                          className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl"
                          accessibilityLabel="Delete Exercise"
                        >
                          <Ionicons name="trash-outline" size={14} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Form Cues / Coaching Notes */}
                    {ex.notes ? (
                      <View className="mt-2.5 bg-zinc-900/70 border border-zinc-850 rounded-xl p-2.5 flex-row items-start space-x-2">
                        <Ionicons
                          name="bulb-outline"
                          size={13}
                          color="#F59E0B"
                          style={{ marginTop: 1 }}
                        />
                        <Text className="text-xs text-zinc-300 italic flex-1">{ex.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {filteredExercises.length > exercisePageSize && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExercisePageSize((prev) => prev + 30);
                  }}
                  className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl items-center my-3"
                >
                  <Text className="text-xs font-bold text-accent-cyan">
                    Load More Exercises ({filteredExercises.length - exercisePageSize} remaining)
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          </ScrollView>
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROGRAM BUILDER (Create / Edit Multi-Day Split) */}
      {/* ========================================================================= */}
      {showProgramBuilderModal && (
        <Modal visible={showProgramBuilderModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black/85 justify-end"
          >
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-black text-white">
                  {editingSplitId ? 'Edit Program' : 'Build New Program'}
                </Text>
                <Text className="text-xs text-accent-cyan">
                  Configure training days and select exercises
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowProgramBuilderModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
              {/* Program Name */}
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Program Title *
              </Text>
              <TextInput
                value={builderName}
                onChangeText={setBuilderName}
                placeholder="e.g. 12-Week Hypertrophy PPL or 4-Day Strength"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-sm mb-3 font-bold"
              />

              {/* Program Focus / Description */}
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Program Focus / Notes (Optional)
              </Text>
              <TextInput
                value={builderDescription}
                onChangeText={setBuilderDescription}
                placeholder="e.g. For intermediate athletes focused on chest and shoulder volume"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-white text-xs mb-4"
              />

              {/* Workout Days Section */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-black text-white uppercase tracking-wider">
                  Workout Days ({builderRoutines.length})
                </Text>
                <TouchableOpacity
                  onPress={handleBuilderAddDay}
                  className="bg-cyan-500/15 border border-cyan-500/40 px-2.5 py-1 rounded-lg flex-row items-center space-x-1"
                >
                  <Ionicons name="add" size={13} color="#06B6D4" />
                  <Text className="text-[11px] font-black text-cyan-300">+ Add Day</Text>
                </TouchableOpacity>
              </View>

              {builderRoutines.map((routine, rIdx) => (
                <View
                  key={routine.id || `b-rtn-${rIdx}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 mb-3"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center space-x-2 flex-1 mr-2">
                      <View className="w-5 h-5 rounded-md bg-accent-cyan items-center justify-center">
                        <Text className="text-[10px] font-black text-black">{rIdx + 1}</Text>
                      </View>
                      <TextInput
                        value={routine.name}
                        onChangeText={(text) => {
                          setBuilderRoutines((prev) => {
                            const updated = [...prev];
                            updated[rIdx] = { ...updated[rIdx], name: text };
                            return updated;
                          });
                        }}
                        placeholder="Day Name (e.g. Push Heavy)"
                        placeholderTextColor="#71717A"
                        className="text-white text-xs font-bold flex-1 bg-zinc-950 border border-zinc-850 px-2.5 py-1.5 rounded-lg"
                      />
                    </View>

                    {builderRoutines.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleBuilderRemoveDay(rIdx)}
                        className="p-1 bg-rose-500/10 rounded-md"
                      >
                        <Ionicons name="trash-outline" size={13} color="#F43F5E" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Exercises in this Day */}
                  {routine.exerciseIds.length > 0 ? (
                    <View className="flex-row flex-wrap mb-2">
                      {routine.exerciseIds.map((exId, idx) => {
                        const ex = exerciseMap.get(exId);
                        return (
                          <View
                            key={`b-chip-${idx}`}
                            className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg mr-1.5 mb-1.5 flex-row items-center space-x-1.5"
                          >
                            <Text className="text-[10px] font-bold text-zinc-200">
                              {ex ? ex.name : 'Exercise'}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setBuilderRoutines((prev) => {
                                  const updated = [...prev];
                                  const r = { ...updated[rIdx] };
                                  r.exerciseIds = r.exerciseIds.filter((id) => id !== exId);
                                  updated[rIdx] = r;
                                  return updated;
                                });
                              }}
                            >
                              <Ionicons name="close-circle" size={12} color="#A1A1AA" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="text-[10px] text-zinc-500 italic mb-2">
                      No exercises selected for this day yet.
                    </Text>
                  )}

                  {/* Pick Exercises Button */}
                  <TouchableOpacity
                    onPress={() => handleOpenBuilderExercisePicker(rIdx)}
                    className="bg-zinc-950 border border-dashed border-zinc-700 py-2 rounded-xl items-center flex-row justify-center space-x-1.5"
                  >
                    <Ionicons name="add" size={14} color="#06B6D4" />
                    <Text className="text-xs font-bold text-cyan-300">
                      Select Exercises ({routine.exerciseIds.length})
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveProgramBuilder}
              className="bg-accent-cyan py-3.5 rounded-2xl items-center shadow-lg shadow-cyan-500/25 mt-1"
            >
              <Text className="text-black font-black text-sm">
                {editingSplitId ? 'Save Program Changes' : 'Save Program to Library'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* SUB-MODAL: PICK EXERCISES FOR A ROUTINE IN BUILDER */}
      {/* ========================================================================= */}
      {showBuilderExercisePicker && (
        <Modal visible={showBuilderExercisePicker} transparent animationType="slide">
          <View className="flex-1 bg-black/85 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <View>
                <Text className="text-base font-black text-white">Select Exercises</Text>
                <Text className="text-xs text-accent-cyan">
                  {builderActiveRoutineIdx !== null && builderRoutines[builderActiveRoutineIdx]
                    ? builderRoutines[builderActiveRoutineIdx].name
                    : 'Workout Day'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBuilderExercisePicker(false)}>
                <Ionicons name="checkmark-circle" size={26} color="#06B6D4" />
              </TouchableOpacity>
            </View>

            {/* Picker Search */}
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-2">
              <Ionicons name="search" size={14} color="#71717A" />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Filter exercises..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs"
              />
            </View>

            {/* Muscle Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-grow-0 mb-3"
            >
              {['All', ...MUSCLE_GROUPS].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPickerMuscleFilter(m)}
                  className={`px-2.5 py-1 rounded-lg mr-1.5 border ${
                    pickerMuscleFilter === m
                      ? 'bg-accent-cyan border-accent-cyan'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      pickerMuscleFilter === m ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* List */}
            <ScrollView className="max-h-72 mb-3">
              {exercises
                .filter((ex) => {
                  const matchSearch =
                    !pickerSearch ||
                    ex.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                    ex.equipment.toLowerCase().includes(pickerSearch.toLowerCase());
                  const matchMuscle =
                    pickerMuscleFilter === 'All' || ex.muscleGroup === pickerMuscleFilter;
                  return matchSearch && matchMuscle;
                })
                .sort((a, b) => {
                  if (a.isStarred && !b.isStarred) return -1;
                  if (!a.isStarred && b.isStarred) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((ex) => {
                  const currentSelected =
                    builderActiveRoutineIdx !== null
                      ? builderRoutines[builderActiveRoutineIdx]?.exerciseIds.includes(ex.id)
                      : false;

                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => handleTogglePickerExercise(ex.id)}
                      className={`p-2.5 rounded-xl mb-1.5 flex-row items-center justify-between border ${
                        currentSelected
                          ? 'bg-cyan-500/15 border-accent-cyan'
                          : ex.isStarred
                          ? 'bg-zinc-900 border-amber-500/30'
                          : 'bg-zinc-900/80 border-zinc-800'
                      }`}
                    >
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center space-x-1">
                          {ex.isStarred && <Ionicons name="star" size={11} color="#F59E0B" />}
                          <Text className="text-xs font-bold text-white">{ex.name}</Text>
                        </View>
                        <Text className="text-[10px] text-zinc-400">
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>
                      <Ionicons
                        name={currentSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={currentSelected ? '#06B6D4' : '#52525B'}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowBuilderExercisePicker(false)}
              className="bg-accent-cyan py-3 rounded-xl items-center"
            >
              <Text className="text-black font-black text-xs">Done Selecting</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD ROUTINE TO EXISTING SPLIT */}
      {/* ========================================================================= */}
      {showAddRoutineModal && (
        <Modal visible={showAddRoutineModal} transparent animationType="slide">
          <View className="flex-1 bg-black/85 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-black text-white">Add Workout Day</Text>
                <Text className="text-xs text-accent-cyan">
                  To {activeSplitForAddRoutine?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddRoutineModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Routine / Day Name *
            </Text>
            <TextInput
              value={newRoutineName}
              onChangeText={setNewRoutineName}
              placeholder="e.g. Push Day, Pull Heavy, Leg Hypertrophy"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-xs mb-3 font-bold"
            />

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Select Exercises ({newRoutineExerciseIds.length} selected)
            </Text>
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-2">
              <Ionicons name="search" size={14} color="#71717A" />
              <TextInput
                value={routineExerciseSearch}
                onChangeText={setRoutineExerciseSearch}
                placeholder="Search exercises..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs"
              />
            </View>

            <ScrollView className="max-h-60 mb-3">
              {exercises
                .filter(
                  (ex) =>
                    !routineExerciseSearch ||
                    ex.name.toLowerCase().includes(routineExerciseSearch.toLowerCase())
                )
                .sort((a, b) => {
                  if (a.isStarred && !b.isStarred) return -1;
                  if (!a.isStarred && b.isStarred) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((ex) => {
                  const isSelected = newRoutineExerciseIds.includes(ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => {
                        setNewRoutineExerciseIds((prev) =>
                          prev.includes(ex.id)
                            ? prev.filter((id) => id !== ex.id)
                            : [...prev, ex.id]
                        );
                      }}
                      className={`p-2.5 rounded-xl mb-1.5 flex-row items-center justify-between border ${
                        isSelected
                          ? 'bg-cyan-500/15 border-accent-cyan'
                          : ex.isStarred
                          ? 'bg-zinc-900 border-amber-500/30'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <View>
                        <View className="flex-row items-center space-x-1">
                          {ex.isStarred && <Ionicons name="star" size={11} color="#F59E0B" />}
                          <Text className="text-xs font-bold text-white">{ex.name}</Text>
                        </View>
                        <Text className="text-[10px] text-zinc-400">
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={isSelected ? '#06B6D4' : '#52525B'}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveNewRoutineToSplit}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/20"
            >
              <Text className="text-black font-black text-xs">Save Routine to Program</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ROUTINE EXERCISES */}
      {/* ========================================================================= */}
      {showEditRoutineModal && (
        <Modal visible={showEditRoutineModal} transparent animationType="slide">
          <View className="flex-1 bg-black/85 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-black text-white">Edit Workout Day</Text>
                <Text className="text-xs text-accent-cyan">
                  {editingSplitForRoutine?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditRoutineModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Day / Routine Name *
            </Text>
            <TextInput
              value={editRoutineName}
              onChangeText={setEditRoutineName}
              placeholder="e.g. Push Day"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-xs mb-3 font-bold"
            />

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Select Exercises ({editRoutineExerciseIds.length} selected)
            </Text>
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex-row items-center space-x-2 mb-2">
              <Ionicons name="search" size={14} color="#71717A" />
              <TextInput
                value={editRoutineSearch}
                onChangeText={setEditRoutineSearch}
                placeholder="Filter exercises..."
                placeholderTextColor="#71717A"
                className="flex-1 text-white text-xs"
              />
            </View>

            <ScrollView className="max-h-60 mb-3">
              {exercises
                .filter(
                  (ex) =>
                    !editRoutineSearch ||
                    ex.name.toLowerCase().includes(editRoutineSearch.toLowerCase())
                )
                .sort((a, b) => {
                  if (a.isStarred && !b.isStarred) return -1;
                  if (!a.isStarred && b.isStarred) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((ex) => {
                  const isSelected = editRoutineExerciseIds.includes(ex.id);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => {
                        setEditRoutineExerciseIds((prev) =>
                          prev.includes(ex.id)
                            ? prev.filter((id) => id !== ex.id)
                            : [...prev, ex.id]
                        );
                      }}
                      className={`p-2.5 rounded-xl mb-1.5 flex-row items-center justify-between border ${
                        isSelected
                          ? 'bg-cyan-500/15 border-accent-cyan'
                          : ex.isStarred
                          ? 'bg-zinc-900 border-amber-500/30'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <View>
                        <View className="flex-row items-center space-x-1">
                          {ex.isStarred && <Ionicons name="star" size={11} color="#F59E0B" />}
                          <Text className="text-xs font-bold text-white">{ex.name}</Text>
                        </View>
                        <Text className="text-[10px] text-zinc-400">
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={isSelected ? '#06B6D4' : '#52525B'}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveEditRoutine}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/20"
            >
              <Text className="text-black font-black text-xs">Save Routine Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN SPLIT TO CLIENT */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <Modal visible={showAssignModal} transparent animationType="slide">
          <View className="flex-1 bg-black/85 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-black text-white">Assign Program to Client</Text>
                <Text className="text-xs text-accent-cyan">
                  {selectedSplitToAssign?.name} ({selectedSplitToAssign?.routines.length} days)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-3">
              {/* Option 1: Coach's own Personal Athlete Profile */}
              <TouchableOpacity
                onPress={handleAssignToSelf}
                className="p-3.5 rounded-2xl mb-2.5 flex-row items-center justify-between border bg-cyan-950/30 border-cyan-500/50"
              >
                <View className="flex-row items-center space-x-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 items-center justify-center">
                    <Text className="text-xl">🏋️</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-sm font-black text-white">Myself (Personal Profile)</Text>
                      <View className="bg-cyan-500/20 px-1.5 py-0.5 rounded">
                        <Text className="text-[9px] font-black text-cyan-400">YOU</Text>
                      </View>
                    </View>
                    <Text className="text-[11px] text-cyan-300/80" numberOfLines={1}>
                      Assign directly to your personal workout rotation
                    </Text>
                  </View>
                </View>

                <View className="px-3 py-1.5 rounded-xl bg-accent-cyan">
                  <Text className="text-xs font-black text-black">Assign to Me</Text>
                </View>
              </TouchableOpacity>

              <View className="h-px bg-zinc-800 my-2" />
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Clients Roster ({clients.length})
              </Text>

              {clients.length === 0 ? (
                <View className="items-center py-4">
                  <Text className="text-zinc-500 text-xs">No clients in your roster yet.</Text>
                </View>
              ) : (
                clients.map((client) => {
                  const isAssigned =
                    client.assignedRoutineNames &&
                    client.assignedRoutineNames.some((name) =>
                      selectedSplitToAssign?.routines.some((r) => r.name === name)
                    );

                  return (
                    <TouchableOpacity
                      key={client.id}
                      onPress={() => handleAssignToClient(client.id)}
                      className={`p-3.5 rounded-2xl mb-2 flex-row items-center justify-between border ${
                        isAssigned
                          ? 'bg-cyan-500/10 border-accent-cyan'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <View className="flex-row items-center space-x-3 flex-1 mr-2">
                        <View className="w-10 h-10 rounded-xl bg-zinc-800 items-center justify-center">
                          <Text className="text-xl">{client.avatarEmoji || '⚡'}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-black text-white">{client.name}</Text>
                          <Text className="text-[11px] text-zinc-400" numberOfLines={1}>
                            {client.assignedRoutineNames && client.assignedRoutineNames.length > 0
                              ? `Current: ${client.assignedRoutineNames.join(', ')}`
                              : 'No program assigned'}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`px-3 py-1.5 rounded-xl ${
                          isAssigned ? 'bg-cyan-500/20' : 'bg-accent-cyan'
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            isAssigned ? 'text-cyan-300' : 'text-black'
                          }`}
                        >
                          {isAssigned ? 'Re-assign' : 'Assign'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOM EXERCISE (Upload / Edit) */}
      {/* ========================================================================= */}
      {showExerciseModal && (
        <Modal visible={showExerciseModal} transparent animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black/85 justify-end"
          >
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-black text-white">
                  {editingExerciseId ? 'Edit Custom Exercise' : 'Upload Custom Exercise'}
                </Text>
                <Text className="text-xs text-accent-cyan">
                  Personalized variations for your split library
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowExerciseModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Exercise Name *
              </Text>
              <TextInput
                value={exName}
                onChangeText={setExName}
                placeholder="e.g. Deficit Romanian Deadlift, Incline Smith Press"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-xs mb-3 font-bold"
              />

              {/* Muscle Group Selector */}
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Primary Muscle Group *
              </Text>
              <View className="flex-row flex-wrap mb-3">
                {MUSCLE_GROUPS.map((m) => {
                  const isSelected = exMuscle === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setExMuscle(m)}
                      className={`px-3 py-1.5 rounded-xl mr-1.5 mb-1.5 border ${
                        isSelected
                          ? 'bg-accent-cyan border-accent-cyan'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-black' : 'text-zinc-400'
                        }`}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Equipment Selector */}
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Equipment Type
              </Text>
              <View className="flex-row flex-wrap mb-3">
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const isSelected = exEquipment === eq;
                  return (
                    <TouchableOpacity
                      key={eq}
                      onPress={() => setExEquipment(eq)}
                      className={`px-2.5 py-1 rounded-xl mr-1.5 mb-1.5 border ${
                        isSelected
                          ? 'bg-zinc-200 border-white'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-black' : 'text-zinc-400'
                        }`}
                      >
                        {eq}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Coaching Notes / Cues */}
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Coaching Cues / Form Instructions (Optional)
              </Text>
              <TextInput
                value={exNotes}
                onChangeText={setExNotes}
                placeholder="e.g. 2-sec eccentric tempo, pause at chest, drive through heels"
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={3}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white text-xs mb-4"
              />
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveExercise}
              className="bg-accent-cyan py-3.5 rounded-2xl items-center shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-black text-sm">
                {editingExerciseId ? 'Update Exercise' : 'Save Exercise to Vault'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}
