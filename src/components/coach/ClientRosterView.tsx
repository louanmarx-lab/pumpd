import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import { ClientProfile, PrescribedMealArchetype } from '../../types/trainer';

const EMOJI_OPTIONS = ['⚡', '🔥', '🦁', '💪', '🚀', '🎯', '🦅', '🦍', '⭐', '🏆'];

export const ClientRosterView: React.FC = () => {
  const router = useRouter();
  const {
    coachProfile,
    clients,
    splits,
    addClient,
    updateClient,
    deleteClient,
    assignClientArchetypes,
  } = useUserWorkspace();

  // Add / Edit Client Modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientEmoji, setClientEmoji] = useState('⚡');
  const [clientNotes, setClientNotes] = useState('');
  const [clientCalories, setClientCalories] = useState('2500');
  const [clientProtein, setClientProtein] = useState('180');
  const [clientCarbs, setClientCarbs] = useState('260');
  const [clientFats, setClientFats] = useState('75');
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);

  // Prescribed Archetypes Modal
  const [activeClientForArchetypes, setActiveClientForArchetypes] = useState<ClientProfile | null>(null);
  const [showArchetypeModal, setShowArchetypeModal] = useState(false);
  const [newArchName, setNewArchName] = useState('');
  const [newArchEmoji, setNewArchEmoji] = useState('🍗');
  const [newArchCalories, setNewArchCalories] = useState('500');
  const [newArchProtein, setNewArchProtein] = useState('45');
  const [newArchCarbs, setNewArchCarbs] = useState('55');
  const [newArchFats, setNewArchFats] = useState('10');
  const [newArchInstructions, setNewArchInstructions] = useState('');

  // Collect all routines across splits
  const allRoutines = splits.flatMap((s) =>
    s.routines.map((r) => ({
      id: r.id,
      name: r.name,
      splitName: s.name,
    }))
  );

  const openAddClient = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingClientId(null);
    setClientName('');
    setClientEmail('');
    setClientEmoji('⚡');
    setClientNotes('');
    setClientCalories('2500');
    setClientProtein('180');
    setClientCarbs('260');
    setClientFats('75');
    setSelectedRoutineIds([]);
    setShowClientModal(true);
  };

  const openEditClient = (client: ClientProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingClientId(client.id);
    setClientName(client.name);
    setClientEmail(client.email || '');
    setClientEmoji(client.avatarEmoji || '⚡');
    setClientNotes(client.notes || '');
    setClientCalories(client.macroTargets.calories.toString());
    setClientProtein(client.macroTargets.protein.toString());
    setClientCarbs(client.macroTargets.carbs.toString());
    setClientFats(client.macroTargets.fats.toString());
    setSelectedRoutineIds(client.assignedRoutineIds || []);
    setShowClientModal(true);
  };

  const handleSaveClient = () => {
    if (!clientName.trim()) {
      Alert.alert('Required', 'Please provide a client name.');
      return;
    }

    const assignedRoutineNames = selectedRoutineIds
      .map((id) => allRoutines.find((r) => r.id === id)?.name)
      .filter((name): name is string => Boolean(name));

    const macroTargets = {
      calories: parseInt(clientCalories, 10) || 2400,
      protein: parseInt(clientProtein, 10) || 160,
      carbs: parseInt(clientCarbs, 10) || 240,
      fats: parseInt(clientFats, 10) || 70,
    };

    if (editingClientId) {
      const existing = clients.find((c) => c.id === editingClientId);
      if (existing) {
        updateClient({
          ...existing,
          name: clientName.trim(),
          email: clientEmail.trim() || undefined,
          avatarEmoji: clientEmoji,
          notes: clientNotes.trim() || undefined,
          macroTargets,
          assignedRoutineIds: selectedRoutineIds,
          assignedRoutineNames,
        });
      }
    } else {
      addClient({
        name: clientName.trim(),
        email: clientEmail.trim() || undefined,
        avatarEmoji: clientEmoji,
        notes: clientNotes.trim() || undefined,
        macroTargets,
        assignedRoutineIds: selectedRoutineIds,
        assignedRoutineNames,
        prescribedArchetypes: [],
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowClientModal(false);
  };

  const handleDeleteClient = (clientId: string, name: string) => {
    Alert.alert('Remove Client', `Are you sure you want to remove ${name} from your roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteClient(clientId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  // Launch live coaching session
  const handleStartCoaching = (client: ClientProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/active-session',
      params: {
        routineTitle: client.assignedRoutineNames[0] || `${client.name}'s Training`,
        clientId: client.id,
        clientName: client.name,
      },
    });
  };

  // Export Plan Card
  const handleExportPlan = async (client: ClientProfile) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const planText = [
      `🏋️ ${coachProfile.businessName || 'COACHING PLAN'}`,
      `Coached by: ${coachProfile.name} (${coachProfile.instagramHandle})`,
      `Athlete: ${client.name}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎯 TARGET MACROS:`,
      `• Calories: ${client.macroTargets.calories} kcal`,
      `• Protein: ${client.macroTargets.protein}g`,
      `• Carbs: ${client.macroTargets.carbs}g`,
      `• Fats: ${client.macroTargets.fats}g`,
      ``,
      `📋 ASSIGNED WORKOUTS:`,
      ...(client.assignedRoutineNames.length > 0
        ? client.assignedRoutineNames.map((r) => `• ${r}`)
        : ['• Custom Coach-Led Split']),
      ``,
      `🥗 PRESCRIBED MEAL ARCHETYPES:`,
      ...(client.prescribedArchetypes.length > 0
        ? client.prescribedArchetypes.map(
            (a) => `• ${a.emoji} ${a.name}: ${a.protein}P / ${a.carbs}C / ${a.fats}F (${a.calories} kcal)${a.instructions ? ` - ${a.instructions}` : ''}`
          )
        : ['• None prescribed yet']),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Sync with Pumpd App using room pin or JSON import.`,
    ].join('\n');

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${client.name}'s Coaching Plan`,
          text: planText,
        });
      } else {
        await Share.share({
          message: planText,
          title: `${client.name}'s Coaching Plan`,
        });
      }
    } catch {
      Alert.alert('Plan Copied', 'Client plan summary copied!');
    }
  };

  // Archetypes Prescribing
  const openArchetypesForClient = (client: ClientProfile) => {
    setActiveClientForArchetypes(client);
    setShowArchetypeModal(true);
  };

  const handleAddPrescribedArchetype = () => {
    if (!activeClientForArchetypes || !newArchName.trim()) {
      Alert.alert('Required', 'Please enter a meal archetype name.');
      return;
    }

    const newArch: PrescribedMealArchetype = {
      id: `arch_${Date.now()}`,
      name: newArchName.trim(),
      emoji: newArchEmoji,
      calories: parseInt(newArchCalories, 10) || 400,
      protein: parseInt(newArchProtein, 10) || 40,
      carbs: parseInt(newArchCarbs, 10) || 40,
      fats: parseInt(newArchFats, 10) || 10,
      prescribedBy: coachProfile.businessName || coachProfile.name,
      instructions: newArchInstructions.trim() || undefined,
    };

    const updated = [...activeClientForArchetypes.prescribedArchetypes, newArch];
    assignClientArchetypes(activeClientForArchetypes.id, updated);
    setActiveClientForArchetypes({ ...activeClientForArchetypes, prescribedArchetypes: updated });

    setNewArchName('');
    setNewArchInstructions('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteArchetype = (archId: string) => {
    if (!activeClientForArchetypes) return;
    const updated = activeClientForArchetypes.prescribedArchetypes.filter((a) => a.id !== archId);
    assignClientArchetypes(activeClientForArchetypes.id, updated);
    setActiveClientForArchetypes({ ...activeClientForArchetypes, prescribedArchetypes: updated });
  };

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      {/* Coach Deck Header Card */}
      <View className="bg-dark-card border border-cyan-500/30 rounded-3xl p-5 mb-5 shadow-xl relative overflow-hidden">
        <View className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2.5">
            <View className="w-10 h-10 rounded-2xl bg-accent-cyan items-center justify-center shadow-md shadow-cyan-500/30">
              <Ionicons name="shield-checkmark" size={22} color="#09090B" />
            </View>
            <View>
              <Text className="text-base font-black text-white">
                {coachProfile.businessName || 'Coach Deck'}
              </Text>
              <Text className="text-xs text-accent-cyan font-bold">
                {coachProfile.name} • {coachProfile.instagramHandle || '@pumpd_coach'}
              </Text>
            </View>
          </View>

          <View className="bg-cyan-500/15 border border-cyan-500/40 px-3 py-1 rounded-full">
            <Text className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
              COACH ACTIVE
            </Text>
          </View>
        </View>

        {/* Quick Performance Metrics */}
        <View className="flex-row justify-between bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 mt-2">
          <View className="items-center flex-1 border-r border-zinc-850">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Clients</Text>
            <Text className="text-xl font-black text-white">{clients.length}</Text>
          </View>
          <View className="items-center flex-1 border-r border-zinc-850">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Routines</Text>
            <Text className="text-xl font-black text-accent-cyan">
              {clients.reduce((acc, c) => acc + (c.assignedRoutineIds?.length || 0), 0)}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Prescribed</Text>
            <Text className="text-xl font-black text-accent-emerald">
              {clients.reduce((acc, c) => acc + (c.prescribedArchetypes?.length || 0), 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Client Roster List Section Header */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <View className="flex-row items-center space-x-2">
          <Ionicons name="people" size={18} color="#06B6D4" />
          <Text className="text-base font-black text-white">Client Directory</Text>
          <View className="bg-zinc-800 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-zinc-300">{clients.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={openAddClient}
          className="bg-accent-cyan px-3.5 py-1.5 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
        >
          <Ionicons name="person-add" size={14} color="#09090B" />
          <Text className="text-xs font-black text-black">+ Add Client</Text>
        </TouchableOpacity>
      </View>

      {/* Roster Cards */}
      {clients.length === 0 ? (
        <View className="bg-dark-card border border-dashed border-zinc-800 rounded-2xl p-8 items-center justify-center my-4">
          <Ionicons name="people-outline" size={36} color="#71717A" />
          <Text className="text-sm font-bold text-white mt-2">No Athletes in Roster Yet</Text>
          <Text className="text-xs text-zinc-400 text-center mt-1">
            Add your clients to pre-assign workouts, set macro targets, and prescribe meal archetypes.
          </Text>
          <TouchableOpacity
            onPress={openAddClient}
            className="mt-4 bg-accent-cyan px-4 py-2 rounded-xl"
          >
            <Text className="text-xs font-black text-black">+ Add First Client</Text>
          </TouchableOpacity>
        </View>
      ) : (
        clients.map((client) => (
          <View
            key={client.id}
            className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-3.5 shadow-md"
          >
            {/* Top row: Avatar, Name, Edit/Delete */}
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-850">
              <View className="flex-row items-center space-x-3 flex-1">
                <View className="w-11 h-11 rounded-2xl bg-zinc-850 border border-zinc-750 items-center justify-center">
                  <Text className="text-xl">{client.avatarEmoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-black text-white" numberOfLines={1}>
                    {client.name}
                  </Text>
                  <Text className="text-xs text-zinc-400" numberOfLines={1}>
                    {client.email || 'Direct Athlete'}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center space-x-1.5">
                <TouchableOpacity
                  onPress={() => openEditClient(client)}
                  className="p-2 bg-zinc-850 border border-zinc-750 rounded-xl"
                >
                  <Ionicons name="create-outline" size={15} color="#A1A1AA" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteClient(client.id, client.name)}
                  className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl"
                >
                  <Ionicons name="trash-outline" size={15} color="#F43F5E" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes if present */}
            {client.notes ? (
              <View className="mt-2.5 bg-zinc-900/60 rounded-xl px-3 py-2 border border-zinc-800/80">
                <Text className="text-xs text-zinc-300 italic">"{client.notes}"</Text>
              </View>
            ) : null}

            {/* Nutrition Targets Row */}
            <View className="flex-row justify-between items-center bg-zinc-950/80 border border-zinc-850 rounded-xl p-2.5 mt-3">
              <View className="items-center flex-1">
                <Text className="text-[9px] text-zinc-500 font-bold uppercase">Energy</Text>
                <Text className="text-xs font-black text-accent-cyan">
                  {client.macroTargets.calories} kcal
                </Text>
              </View>
              <View className="items-center flex-1 border-x border-zinc-850">
                <Text className="text-[9px] text-zinc-500 font-bold uppercase">Protein</Text>
                <Text className="text-xs font-black text-accent-emerald">
                  {client.macroTargets.protein}g
                </Text>
              </View>
              <View className="items-center flex-1 border-r border-zinc-850">
                <Text className="text-[9px] text-zinc-500 font-bold uppercase">Carbs</Text>
                <Text className="text-xs font-black text-cyan-300">
                  {client.macroTargets.carbs}g
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-[9px] text-zinc-500 font-bold uppercase">Fats</Text>
                <Text className="text-xs font-black text-amber-400">
                  {client.macroTargets.fats}g
                </Text>
              </View>
            </View>

            {/* Assigned Routines Tags */}
            {client.assignedRoutineNames && client.assignedRoutineNames.length > 0 && (
              <View className="mt-3 flex-row flex-wrap items-center">
                <Text className="text-[10px] font-bold text-zinc-400 mr-2 uppercase">Workouts:</Text>
                {client.assignedRoutineNames.map((rName, idx) => (
                  <View
                    key={`r-${idx}`}
                    className="bg-zinc-850 border border-zinc-750 px-2 py-0.5 rounded-md mr-1.5 mb-1"
                  >
                    <Text className="text-[10px] font-medium text-zinc-300">{rName}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Bar */}
            <View className="flex-row items-center space-x-2 mt-4 pt-3 border-t border-zinc-850">
              <TouchableOpacity
                onPress={() => handleStartCoaching(client)}
                className="flex-1 bg-accent-cyan py-2.5 rounded-xl flex-row items-center justify-center space-x-1.5 shadow-md shadow-cyan-500/20"
              >
                <Ionicons name="play" size={13} color="#09090B" />
                <Text className="text-xs font-black text-black">Coach Live</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openArchetypesForClient(client)}
                className="bg-zinc-850 border border-zinc-750 px-3 py-2.5 rounded-xl flex-row items-center space-x-1"
              >
                <Ionicons name="nutrition" size={14} color="#10B981" />
                <Text className="text-xs font-bold text-zinc-200">
                  Meals ({client.prescribedArchetypes?.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleExportPlan(client)}
                className="p-2.5 bg-zinc-850 border border-zinc-750 rounded-xl"
              >
                <Ionicons name="share-social-outline" size={16} color="#06B6D4" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Modal 1: Add/Edit Client */}
      <Modal visible={showClientModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <Text className="text-lg font-black text-white">
                {editingClientId ? 'Edit Athlete' : 'Add New Athlete'}
              </Text>
              <TouchableOpacity onPress={() => setShowClientModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Emoji Picker */}
              <Text className="text-xs font-bold text-zinc-400 mb-1.5">Avatar Icon</Text>
              <View className="flex-row space-x-2 mb-4">
                {EMOJI_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => setClientEmoji(emoji)}
                    className={`w-9 h-9 rounded-xl items-center justify-center border ${
                      clientEmoji === emoji
                        ? 'bg-accent-cyan/20 border-accent-cyan'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text className="text-lg">{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-bold text-zinc-400 mb-1">Athlete Name *</Text>
              <TextInput
                value={clientName}
                onChangeText={setClientName}
                placeholder="e.g. Marcus Vance"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold"
              />

              <Text className="text-xs font-bold text-zinc-400 mb-1">Email / Contact (Optional)</Text>
              <TextInput
                value={clientEmail}
                onChangeText={setClientEmail}
                placeholder="marcus@example.com"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3"
              />

              <Text className="text-xs font-bold text-zinc-400 mb-1">Coach Notes / Focus Areas</Text>
              <TextInput
                value={clientNotes}
                onChangeText={setClientNotes}
                placeholder="e.g. Progressive overload on bench, knee rehab"
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={2}
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4"
              />

              {/* Macro Targets */}
              <Text className="text-xs font-bold text-accent-cyan mb-2">Prescribed Daily Macros</Text>
              <View className="flex-row space-x-2 mb-4">
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-zinc-400 mb-1">Calories</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={clientCalories}
                    onChangeText={setClientCalories}
                    className="bg-zinc-900 border border-zinc-800 text-white p-2.5 rounded-xl font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-emerald-400 mb-1">Protein (g)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={clientProtein}
                    onChangeText={setClientProtein}
                    className="bg-zinc-900 border border-zinc-800 text-white p-2.5 rounded-xl font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-cyan-400 mb-1">Carbs (g)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={clientCarbs}
                    onChangeText={setClientCarbs}
                    className="bg-zinc-900 border border-zinc-800 text-white p-2.5 rounded-xl font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-amber-400 mb-1">Fats (g)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={clientFats}
                    onChangeText={setClientFats}
                    className="bg-zinc-900 border border-zinc-800 text-white p-2.5 rounded-xl font-bold text-center"
                  />
                </View>
              </View>

              {/* Assign Routines Selection */}
              <Text className="text-xs font-bold text-zinc-400 mb-1.5">Assign Workout Routines</Text>
              {allRoutines.length === 0 ? (
                <Text className="text-xs text-zinc-500 mb-3">No routines created in splits yet.</Text>
              ) : (
                <View className="mb-4">
                  {allRoutines.map((routine) => {
                    const isSelected = selectedRoutineIds.includes(routine.id);
                    return (
                      <TouchableOpacity
                        key={routine.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedRoutineIds((prev) => prev.filter((id) => id !== routine.id));
                          } else {
                            setSelectedRoutineIds((prev) => [...prev, routine.id]);
                          }
                        }}
                        className={`p-3 rounded-xl mb-1.5 flex-row items-center justify-between border ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/50'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <View>
                          <Text
                            className={`text-xs font-bold ${
                              isSelected ? 'text-cyan-300' : 'text-zinc-200'
                            }`}
                          >
                            {routine.name}
                          </Text>
                          <Text className="text-[10px] text-zinc-500">{routine.splitName}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={isSelected ? '#06B6D4' : '#71717A'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                onPress={handleSaveClient}
                className="bg-accent-cyan py-3.5 rounded-xl items-center mt-2 shadow-lg shadow-cyan-500/30"
              >
                <Text className="text-black font-extrabold text-sm">Save Athlete</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Prescribe Meal Archetypes for Client */}
      <Modal visible={showArchetypeModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <View>
                <Text className="text-base font-black text-white">Prescribed Meal Archetypes</Text>
                <Text className="text-xs text-accent-emerald font-bold">
                  For: {activeClientForArchetypes?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowArchetypeModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Existing Prescribed List */}
              <Text className="text-xs font-bold text-zinc-400 mb-2 uppercase">
                Current Prescriptions:
              </Text>
              {!activeClientForArchetypes?.prescribedArchetypes?.length ? (
                <Text className="text-xs text-zinc-500 italic mb-4">
                  No meal archetypes prescribed yet.
                </Text>
              ) : (
                activeClientForArchetypes.prescribedArchetypes.map((arch) => (
                  <View
                    key={arch.id}
                    className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl mb-2 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center space-x-1.5">
                        <Text className="text-lg">{arch.emoji}</Text>
                        <Text className="text-xs font-black text-white">{arch.name}</Text>
                      </View>
                      <Text className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        <Text className="text-emerald-400 font-bold">{arch.protein}g P</Text> •{' '}
                        <Text className="text-cyan-400 font-bold">{arch.carbs}g C</Text> •{' '}
                        <Text className="text-amber-400 font-bold">{arch.fats}g F</Text> ({arch.calories} kcal)
                      </Text>
                      {arch.instructions ? (
                        <Text className="text-[10px] text-zinc-500 mt-1 italic">
                          "{arch.instructions}"
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteArchetype(arch.id)}
                      className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg"
                    >
                      <Ionicons name="trash-outline" size={13} color="#F43F5E" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Creator Card */}
              <View className="bg-zinc-950/80 border border-zinc-800 p-3.5 rounded-2xl mt-3">
                <Text className="text-xs font-bold text-accent-cyan mb-2">
                  + Prescribe New Staple Template
                </Text>

                <View className="flex-row space-x-2 mb-2">
                  <TextInput
                    value={newArchEmoji}
                    onChangeText={setNewArchEmoji}
                    className="w-11 bg-zinc-900 border border-zinc-800 text-center text-lg rounded-xl"
                  />
                  <TextInput
                    value={newArchName}
                    onChangeText={setNewArchName}
                    placeholder="Meal name (e.g. Post-Workout Shake)"
                    placeholderTextColor="#71717A"
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl text-xs font-bold"
                  />
                </View>

                <View className="flex-row space-x-1.5 mb-2">
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold text-zinc-400 mb-0.5">Calories</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newArchCalories}
                      onChangeText={setNewArchCalories}
                      className="bg-zinc-900 border border-zinc-800 text-white p-1.5 rounded-lg text-xs font-bold text-center"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold text-emerald-400 mb-0.5">Protein</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newArchProtein}
                      onChangeText={setNewArchProtein}
                      className="bg-zinc-900 border border-zinc-800 text-white p-1.5 rounded-lg text-xs font-bold text-center"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold text-cyan-400 mb-0.5">Carbs</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newArchCarbs}
                      onChangeText={setNewArchCarbs}
                      className="bg-zinc-900 border border-zinc-800 text-white p-1.5 rounded-lg text-xs font-bold text-center"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold text-amber-400 mb-0.5">Fats</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={newArchFats}
                      onChangeText={setNewArchFats}
                      className="bg-zinc-900 border border-zinc-800 text-white p-1.5 rounded-lg text-xs font-bold text-center"
                    />
                  </View>
                </View>

                <TextInput
                  value={newArchInstructions}
                  onChangeText={setNewArchInstructions}
                  placeholder="Instructions: (e.g. with 400ml water right after workout)"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl text-xs mb-3"
                />

                <TouchableOpacity
                  onPress={handleAddPrescribedArchetype}
                  className="bg-emerald-500 py-2.5 rounded-xl items-center shadow-md shadow-emerald-500/20"
                >
                  <Text className="text-black font-black text-xs">Prescribe to Athlete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
