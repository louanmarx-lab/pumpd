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
import {
  ClientProfile,
  PrescribedMealArchetype,
  TrainerSubscriptionTier,
  TIER_CONFIGS,
} from '../../types/trainer';
import { SeatUpgradeModal } from './SeatUpgradeModal';
import { DowngradeReconcileModal } from './DowngradeReconcileModal';
import { ClaimClientModal } from './ClaimClientModal';

const EMOJI_OPTIONS = ['⚡', '🔥', '🦁', '💪', '🚀', '🎯', '🦅', '🦍', '⭐', '🏆'];

export const ClientRosterView: React.FC = () => {
  const router = useRouter();
  const {
    currentUser,
    coachProfile,
    clients,
    splits,
    trainerSubscription,
    activeSeatsUsed,
    addClient,
    updateClient,
    deleteClient,
    unlinkClient,
    generateClientClaimToken,
    upgradeTrainerSubscription,
    reconcileDowngradeSeats,
    assignClientArchetypes,
    startManagingClient,
    stopManagingClient,
    enterPersonalAthleteMode,
    setUserRole,
    setAccountType,
  } = useUserWorkspace();

  const handleOpenMyProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    enterPersonalAthleteMode();
    router.push('/(tabs)/workouts' as any);
  };

  const handleEnterAthleteMode = (client: ClientProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startManagingClient(client);
    router.push('/(tabs)/workouts' as any);
  };


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


  // Seat Monetization & Claim Modals
  const [showSeatUpgradeModal, setShowSeatUpgradeModal] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgradeTargetTier, setDowngradeTargetTier] = useState<TrainerSubscriptionTier | null>(null);
  const [claimClientTarget, setClaimClientTarget] = useState<ClientProfile | null>(null);



  const [clientSearch, setClientSearch] = useState('');
  const currentTierConfig = TIER_CONFIGS[trainerSubscription.tier] || TIER_CONFIGS.starter;
  const activeClients = clients.filter((c) => c.status !== 'archived' && c.status !== 'graduated');
  const displayedClients = activeClients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.assignedRoutineNames && c.assignedRoutineNames.some((r) => r.toLowerCase().includes(q))) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  const openAddClient = () => {
    // Check if active seat capacity reached
    if (activeSeatsUsed >= trainerSubscription.seatLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Active Seat Capacity Full 🚀',
        `You have used all ${trainerSubscription.seatLimit} seats on your ${currentTierConfig.name}. Upgrade your client seats to add more athletes.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Seats',
            onPress: () => setShowSeatUpgradeModal(true),
          },
        ]
      );
      return;
    }

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
      Alert.alert('Required', 'Please provide an athlete name.');
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
        type: 'shadow',
        status: 'active',
        macroTargets,
        assignedRoutineIds: selectedRoutineIds,
        assignedRoutineNames,
        prescribedArchetypes: [],
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowClientModal(false);
  };




  const handleUnlinkClient = (clientId: string, name: string) => {
    Alert.alert(
      'Unlink App Account',
      `Are you sure you want to disconnect ${name}'s app account? They will be reverted to a shadow client in your roster and their past workout history will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink Account',
          style: 'destructive',
          onPress: () => {
            unlinkClient(clientId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDeleteClient = (clientId: string, name: string) => {
    Alert.alert('Permanently Delete', `Are you sure you want to permanently delete ${name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Permanently',
        style: 'destructive',
        onPress: () => {
          deleteClient(clientId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  // Roster Live Coaching Routine Picker State
  const [selectedClientForRoutineLaunch, setSelectedClientForRoutineLaunch] = useState<ClientProfile | null>(null);
  const [showRosterRoutinePickerModal, setShowRosterRoutinePickerModal] = useState(false);

  const getClientRoutinesWithDetails = (client: ClientProfile) => {
    return (client.assignedRoutineIds || []).map((rId) => {
      for (const s of splits) {
        const found = s.routines.find((r) => r.id === rId);
        if (found) {
          return {
            id: found.id,
            name: found.name,
            splitId: s.id,
            splitName: s.name,
            exerciseIds: found.exerciseIds || [],
          };
        }
      }
      const idx = client.assignedRoutineIds.indexOf(rId);
      return {
        id: rId,
        name: client.assignedRoutineNames[idx] || 'Workout Day',
        splitId: 'split_custom',
        splitName: 'Program',
        exerciseIds: [],
      };
    });
  };

  const launchSpecificRoutineForClient = (
    client: ClientProfile,
    routine: { name: string; splitId?: string; exerciseIds: string[] }
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowRosterRoutinePickerModal(false);
    setSelectedClientForRoutineLaunch(null);
    router.push({
      pathname: '/active-session',
      params: {
        routineTitle: routine.name,
        splitId: routine.splitId || 'split_custom',
        exerciseIds:
          routine.exerciseIds && routine.exerciseIds.length > 0
            ? JSON.stringify(routine.exerciseIds)
            : undefined,
        clientId: client.id,
        clientName: client.name,
        startedAt: Date.now().toString(),
      },
    });
  };

  // Launch live coaching session (prompts for routine if multiple exist)
  const handleStartCoaching = (client: ClientProfile) => {
    const details = getClientRoutinesWithDetails(client);
    if (details.length === 0) {
      launchSpecificRoutineForClient(client, {
        name: `${client.name}'s Training`,
        exerciseIds: [],
      });
      return;
    }
    if (details.length === 1) {
      launchSpecificRoutineForClient(client, details[0]);
      return;
    }
    Haptics.selectionAsync();
    setSelectedClientForRoutineLaunch(client);
    setShowRosterRoutinePickerModal(true);
  };

  // Export Plan Card
  const handleExportPlan = async (client: ClientProfile) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const planText = [
      `🏋️ ${coachProfile.businessName || 'COACHING PLAN'}`,
      `Coached by: ${coachProfile.name} (${coachProfile.instagramHandle || '@ripped_coach'})`,
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
      `Sync with RIPPED App using your invite code or scan.`,
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

  const handleDowngradeReconcileTrigger = (targetTier: TrainerSubscriptionTier) => {
    setDowngradeTargetTier(targetTier);
    setShowDowngradeModal(true);
  };

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      {/* Coach Deck Header Card */}
      <View className="bg-dark-card border border-cyan-500/30 rounded-3xl p-5 mb-4 shadow-xl relative overflow-hidden">
        <View className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2.5 flex-1 mr-2 min-w-0">
            <View className="w-10 h-10 rounded-2xl bg-accent-cyan items-center justify-center shadow-md shadow-cyan-500/30 shrink-0">
              <Ionicons name="shield-checkmark" size={22} color="#09090B" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-base font-black text-white" numberOfLines={1}>
                {coachProfile.businessName || 'Coach Deck'}
              </Text>
              <Text className="text-xs text-accent-cyan font-bold" numberOfLines={1}>
                {coachProfile.name} • {coachProfile.instagramHandle || '@ripped_coach'}
              </Text>
            </View>
          </View>

          <View className="bg-cyan-500/15 border border-cyan-500/40 px-3 py-1 rounded-full shrink-0">
            <Text className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
              COACH ACTIVE
            </Text>
          </View>
        </View>

        {/* Quick Performance Metrics */}
        <View className="flex-row justify-between bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 mt-1">
          <View className="items-center flex-1 border-r border-zinc-850">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Clients</Text>
            <Text className="text-xl font-black text-white">{activeClients.length}</Text>
          </View>
          <View className="items-center flex-1 border-r border-zinc-850">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Meals</Text>
            <Text className="text-xl font-black text-emerald-400">
              {clients.reduce((acc, c) => acc + (c.prescribedArchetypes?.length || 0), 0)}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-[10px] text-zinc-500 font-bold uppercase">Routines</Text>
            <Text className="text-xl font-black text-accent-cyan">
              {clients.reduce((acc, c) => acc + (c.assignedRoutineIds?.length || 0), 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* Seat Monetization Tier & Quota Banner */}
      <View className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 mb-4 shadow-md">
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center space-x-2">
            <View className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 items-center justify-center">
              <Ionicons name="sparkles" size={14} color="#F59E0B" />
            </View>
            <View>
              <Text className="text-xs font-black text-white">
                {currentTierConfig.name} • R{currentTierConfig.priceZar}/mo
              </Text>
              <Text className="text-[10px] text-zinc-400">
                {activeSeatsUsed} of {trainerSubscription.seatLimit} active seats occupied
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowSeatUpgradeModal(true)}
            className="bg-amber-400 px-3 py-1.5 rounded-xl flex-row items-center space-x-1 shadow-sm"
          >
            <Ionicons name="trending-up" size={12} color="#09090B" />
            <Text className="text-[11px] font-black text-black">Upgrade / Manage</Text>
          </TouchableOpacity>
        </View>

        {/* Capacity Bar */}
        <View className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
          <View
            className={`h-full rounded-full ${
              activeSeatsUsed >= trainerSubscription.seatLimit ? 'bg-rose-500' : 'bg-amber-400'
            }`}
            style={{
              width: `${Math.min(100, Math.round((activeSeatsUsed / trainerSubscription.seatLimit) * 100))}%`,
            }}
          />
        </View>
        <Text className="text-[9px] text-zinc-500 font-semibold text-right">
          {activeSeatsUsed >= trainerSubscription.seatLimit
            ? 'Capacity full • Upgrade to add more athletes'
            : `${trainerSubscription.seatLimit - activeSeatsUsed} seats available`}
        </Text>
      </View>

      {/* Personal Trainer's Own Athlete Profile Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpenMyProfile}
        className="bg-dark-card border border-cyan-500/30 rounded-2xl p-4 mb-4 shadow-md"
      >
        <View className="flex-row items-center space-x-3 mb-3">
          <View className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 items-center justify-center shrink-0 shadow-sm">
            <Ionicons name="barbell" size={20} color="#06B6D4" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-black text-white" numberOfLines={1}>
              {coachProfile.name || currentUser.displayName || 'Personal Profile'} (You)
            </Text>
            <Text className="text-xs text-zinc-400 mt-0.5">
              Personal workouts & nutrition
            </Text>
          </View>
        </View>

        <View className="bg-accent-cyan py-2.5 rounded-xl items-center flex-row justify-center space-x-1.5 shadow-sm shadow-cyan-500/20">
          <Text className="text-xs font-black text-black">Open My Profile</Text>
          <Ionicons name="arrow-forward" size={13} color="#09090B" />
        </View>
      </TouchableOpacity>

      {/* Client Roster List Section Header */}
      <View className="flex-row items-center justify-between mb-2.5 px-1">
        <View className="flex-row items-center space-x-2">
          <Ionicons name="people" size={17} color="#06B6D4" />
          <Text className="text-base font-black text-white">Active Athletes</Text>
          <View className="bg-zinc-800 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-bold text-zinc-300">
              {clientSearch ? `${displayedClients.length} of ${activeClients.length}` : displayedClients.length}
            </Text>
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

      {/* Search Bar for Clients */}
      {activeClients.length > 0 && (
        <View className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 mb-3 flex-row items-center space-x-2">
          <Ionicons name="search" size={15} color="#71717A" />
          <TextInput
            value={clientSearch}
            onChangeText={setClientSearch}
            placeholder="Search clients by name, email, or routine..."
            placeholderTextColor="#71717A"
            className="flex-1 text-white text-xs font-medium"
          />
          {clientSearch.length > 0 && (
            <TouchableOpacity onPress={() => setClientSearch('')}>
              <Ionicons name="close-circle" size={16} color="#71717A" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Roster Cards */}
      {displayedClients.length === 0 ? (
        <View className="bg-dark-card border border-dashed border-zinc-800 rounded-2xl p-8 items-center justify-center my-4">
          <Ionicons
            name={clientSearch ? 'search-outline' : 'people-outline'}
            size={36}
            color="#71717A"
          />
          <Text className="text-sm font-bold text-white mt-2">
            {clientSearch ? 'No Clients Found' : 'No Athletes in Roster'}
          </Text>
          <Text className="text-xs text-zinc-400 text-center mt-1">
            {clientSearch
              ? `No clients match "${clientSearch}". Try another name or clear your search.`
              : 'Add your clients to track workouts, assign splits, and view their Athlete Profile.'}
          </Text>
          {clientSearch ? (
            <TouchableOpacity
              onPress={() => setClientSearch('')}
              className="mt-4 bg-zinc-800 px-4 py-2 rounded-xl"
            >
              <Text className="text-xs font-bold text-zinc-200">Clear Search</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={openAddClient}
              className="mt-4 bg-accent-cyan px-4 py-2 rounded-xl"
            >
              <Text className="text-xs font-black text-black">+ Add First Client</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        displayedClients.map((client) => {
          const isArchived = client.status === 'archived';
          const isGraduated = client.status === 'graduated';
          const isInactive = isArchived || isGraduated;

          return (
            <View
              key={client.id}
              className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-3.5 shadow-md"
            >
              {/* Top row: Avatar, Name, Email — tap opens athlete mode */}
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-850">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleEnterAthleteMode(client)}
                  className="flex-row items-center space-x-3 flex-1 min-w-0 mr-2"
                >
                  <View className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 items-center justify-center shrink-0 shadow-sm">
                    <Text className="text-2xl">{client.avatarEmoji}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center space-x-1">
                      <Text className="text-[15px] font-black text-white" numberOfLines={1}>
                        {client.name}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color="#52525B" />
                    </View>
                    <Text className="text-[11px] text-zinc-400 mt-0.5" numberOfLines={1}>
                      {client.email || 'No email — Shadow Client'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Icon buttons: Unlink (if linked) + Edit + Delete */}
                <View className="flex-row items-center space-x-1.5 shrink-0">
                  {client.type === 'linked' && (
                    <TouchableOpacity
                      onPress={() => handleUnlinkClient(client.id, client.name)}
                      className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                      accessibilityLabel="Unlink athlete account"
                    >
                      <Ionicons name="link-outline" size={14} color="#F59E0B" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => openEditClient(client)}
                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl"
                  >
                    <Ionicons name="create-outline" size={14} color="#71717A" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteClient(client.id, client.name)}
                    className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl"
                  >
                    <Ionicons name="trash-outline" size={14} color="#F43F5E" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status / type badge row */}
              <View className="flex-row items-center space-x-2 mt-2.5">
                {client.type === 'linked' ? (
                  <View className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full flex-row items-center space-x-1">
                    <Ionicons name="cloud-done" size={10} color="#10B981" />
                    <Text className="text-[10px] font-black text-emerald-400 uppercase tracking-wide">
                      App User
                    </Text>
                  </View>
                ) : (
                  <View className="bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full flex-row items-center space-x-1">
                    <Ionicons name="person-add-outline" size={10} color="#F59E0B" />
                    <Text className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                      Shadow
                    </Text>
                  </View>
                )}

                {/* Meal count badge */}
                {client.prescribedArchetypes && client.prescribedArchetypes.length > 0 && (
                  <View className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex-row items-center space-x-1">
                    <Ionicons name="nutrition-outline" size={10} color="#10B981" />
                    <Text className="text-[10px] font-bold text-emerald-400">
                      {client.prescribedArchetypes.length} Meals
                    </Text>
                  </View>
                )}
              </View>

              {/* Notes if present */}
              {client.notes ? (
                <View className="mt-2.5 bg-zinc-950/80 rounded-xl px-3 py-2 border border-zinc-800/60 flex-row items-start space-x-2">
                  <Ionicons name="chatbubble-ellipses-outline" size={11} color="#52525B" style={{ marginTop: 1 }} />
                  <Text className="text-[11px] text-zinc-400 italic flex-1" numberOfLines={2}>
                    {client.notes}
                  </Text>
                </View>
              ) : null}

              {/* Macro Targets Row */}
              <View className="flex-row mt-3 bg-zinc-950/70 border border-zinc-850 rounded-2xl overflow-hidden">
                <View className="flex-1 min-w-0 items-center py-2.5 px-1 border-r border-zinc-850">
                  <Text className="text-[8px] text-zinc-600 font-bold uppercase mb-0.5" numberOfLines={1}>Energy</Text>
                  <Text className="text-[11px] font-black text-accent-cyan" numberOfLines={1} adjustsFontSizeToFit>
                    {client.macroTargets.calories}
                  </Text>
                  <Text className="text-[8px] text-zinc-600">kcal</Text>
                </View>
                <View className="flex-1 min-w-0 items-center py-2.5 px-1 border-r border-zinc-850">
                  <Text className="text-[8px] text-zinc-600 font-bold uppercase mb-0.5" numberOfLines={1}>Protein</Text>
                  <Text className="text-[11px] font-black text-emerald-400" numberOfLines={1} adjustsFontSizeToFit>
                    {client.macroTargets.protein}g
                  </Text>
                  <Text className="text-[8px] text-zinc-600">daily</Text>
                </View>
                <View className="flex-1 min-w-0 items-center py-2.5 px-1 border-r border-zinc-850">
                  <Text className="text-[8px] text-zinc-600 font-bold uppercase mb-0.5" numberOfLines={1}>Carbs</Text>
                  <Text className="text-[11px] font-black text-cyan-300" numberOfLines={1} adjustsFontSizeToFit>
                    {client.macroTargets.carbs}g
                  </Text>
                  <Text className="text-[8px] text-zinc-600">daily</Text>
                </View>
                <View className="flex-1 min-w-0 items-center py-2.5 px-1">
                  <Text className="text-[8px] text-zinc-600 font-bold uppercase mb-0.5" numberOfLines={1}>Fats</Text>
                  <Text className="text-[11px] font-black text-amber-400" numberOfLines={1} adjustsFontSizeToFit>
                    {client.macroTargets.fats}g
                  </Text>
                  <Text className="text-[8px] text-zinc-600">daily</Text>
                </View>
              </View>

              {/* Workout Program — display-only chips, tap opens athlete mode */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => handleEnterAthleteMode(client)}
                className="mt-2.5 bg-zinc-950/60 border border-zinc-850 rounded-xl px-3 py-2.5 flex-row items-center justify-between"
              >
                {client.assignedRoutineNames && client.assignedRoutineNames.length > 0 ? (
                  <View className="flex-1 mr-2">
                    <Text className="text-[9px] font-bold text-zinc-500 uppercase mb-1.5" numberOfLines={1}>
                      {client.assignedSplitName || 'Program'} · {client.assignedRoutineNames.length} Days
                    </Text>
                    <View className="flex-row flex-wrap">
                      {client.assignedRoutineNames.map((name, idx) => (
                        <View
                          key={`chip-${idx}`}
                          className="bg-zinc-800 border border-zinc-750 px-2 py-0.5 rounded-lg mr-1 mb-1 flex-row items-center space-x-1"
                        >
                          <Ionicons name="barbell-outline" size={8} color="#06B6D4" />
                          <Text className="text-[9px] font-bold text-zinc-300">{name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center space-x-2 flex-1">
                    <Ionicons name="barbell-outline" size={13} color="#3F3F46" />
                    <Text className="text-[11px] text-zinc-600">No program yet — tap to assign</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={13} color="#3F3F46" />
              </TouchableOpacity>

              {/* Action Bar — Manage as Athlete + Send Code (all clients) */}
              <View className="flex-row items-center space-x-2 mt-3 pt-3 border-t border-zinc-900">
                {/* Primary: Manage as Athlete */}
                <TouchableOpacity
                  onPress={() => handleEnterAthleteMode(client)}
                  className="flex-1 bg-amber-400 py-3 rounded-2xl flex-row items-center justify-center space-x-1.5 shadow-md shadow-amber-400/25 min-w-0"
                >
                  <Ionicons name="barbell" size={15} color="#09090B" />
                  <Text className="text-xs font-black text-black" numberOfLines={1}>Manage as Athlete</Text>
                </TouchableOpacity>

                {/* Send Invite Code — shown for ALL clients */}
                <TouchableOpacity
                  onPress={() => setClaimClientTarget(client)}
                  className="bg-zinc-900 border border-cyan-500/40 px-3 py-3 rounded-2xl flex-row items-center space-x-1.5 shrink-0"
                >
                  <Ionicons name="qr-code-outline" size={14} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-300" numberOfLines={1}>Send Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Modal: Add/Edit Client */}
      {showClientModal && (
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
                placeholder="e.g., Sarah Davis"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl font-bold mb-3 text-sm"
              />

              <Text className="text-xs font-bold text-zinc-400 mb-1">Email (Optional)</Text>
              <TextInput
                value={clientEmail}
                onChangeText={setClientEmail}
                placeholder="sarah@example.com"
                placeholderTextColor="#71717A"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl font-medium mb-3 text-sm"
              />

              <Text className="text-xs font-bold text-zinc-400 mb-1">Coaching Notes (Optional)</Text>
              <TextInput
                value={clientNotes}
                onChangeText={setClientNotes}
                placeholder="e.g., Focus on squat depth, recovering from shoulder strain"
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={2}
                className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl font-medium mb-3 text-sm"
              />

              {/* Macro Targets */}
              <Text className="text-xs font-bold text-zinc-400 mb-1">Prescribed Macros (Daily)</Text>
              <View className="flex-row space-x-2 mb-4">
                <View className="flex-1">
                  <Text className="text-[10px] text-zinc-500 font-bold mb-0.5">Calories</Text>
                  <TextInput
                    value={clientCalories}
                    onChangeText={setClientCalories}
                    keyboardType="numeric"
                    className="bg-zinc-900 border border-zinc-800 text-white p-2 rounded-xl text-xs font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-emerald-400 font-bold mb-0.5">Protein (g)</Text>
                  <TextInput
                    value={clientProtein}
                    onChangeText={setClientProtein}
                    keyboardType="numeric"
                    className="bg-zinc-900 border border-zinc-800 text-white p-2 rounded-xl text-xs font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-cyan-400 font-bold mb-0.5">Carbs (g)</Text>
                  <TextInput
                    value={clientCarbs}
                    onChangeText={setClientCarbs}
                    keyboardType="numeric"
                    className="bg-zinc-900 border border-zinc-800 text-white p-2 rounded-xl text-xs font-bold text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-amber-400 font-bold mb-0.5">Fats (g)</Text>
                  <TextInput
                    value={clientFats}
                    onChangeText={setClientFats}
                    keyboardType="numeric"
                    className="bg-zinc-900 border border-zinc-800 text-white p-2 rounded-xl text-xs font-bold text-center"
                  />
                </View>
              </View>

              {/* Assign Routines */}
              <Text className="text-xs font-bold text-zinc-400 mb-1.5">Assign Workouts to Athlete</Text>
              {allRoutines.length === 0 ? (
                <Text className="text-xs text-zinc-500 italic mb-4">
                  No routines found. Create workout splits in the Workouts tab first.
                </Text>
              ) : (
                <View className="space-y-1 mb-4">
                  {allRoutines.map((r) => {
                    const isSelected = selectedRoutineIds.includes(r.id);
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedRoutineIds(selectedRoutineIds.filter((id) => id !== r.id));
                          } else {
                            setSelectedRoutineIds([...selectedRoutineIds, r.id]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex-row items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-500/10 border-accent-cyan'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <View>
                          <Text className="text-xs font-bold text-white">{r.name}</Text>
                          <Text className="text-[10px] text-zinc-500">{r.splitName}</Text>
                        </View>
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={isSelected ? '#06B6D4' : '#52525B'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                onPress={handleSaveClient}
                className="w-full bg-accent-cyan py-3.5 rounded-xl items-center justify-center shadow-lg shadow-cyan-500/20"
              >
                <Text className="text-black font-black text-sm">
                  {editingClientId ? 'Update Athlete' : 'Add to Active Roster'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      {/* Modal: Prescribe Meal Archetype */}
      {showArchetypeModal && (
        <Modal visible={showArchetypeModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <View>
                <Text className="text-base font-black text-white">Prescribe Meal Archetype</Text>
                <Text className="text-xs text-accent-cyan">
                  {activeClientForArchetypes?.name || 'Athlete'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowArchetypeModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Existing prescribed archetypes */}
              {activeClientForArchetypes?.prescribedArchetypes &&
                activeClientForArchetypes.prescribedArchetypes.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-xs font-bold text-zinc-400 mb-2 uppercase">
                      Current Prescriptions
                    </Text>
                    {activeClientForArchetypes.prescribedArchetypes.map((arch) => (
                      <View
                        key={arch.id}
                        className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl mb-2 flex-row items-center justify-between"
                      >
                        <View className="flex-row items-center space-x-2 flex-1">
                          <Text className="text-lg">{arch.emoji}</Text>
                          <View className="flex-1">
                            <Text className="text-xs font-bold text-white">{arch.name}</Text>
                            <Text className="text-[10px] text-zinc-400">
                              {arch.protein}P • {arch.carbs}C • {arch.fats}F ({arch.calories} kcal)
                            </Text>
                            {arch.instructions ? (
                              <Text className="text-[9px] text-accent-cyan mt-0.5">
                                {arch.instructions}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteArchetype(arch.id)}
                          className="p-1.5 bg-rose-500/10 rounded-lg"
                        >
                          <Ionicons name="trash-outline" size={14} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

              {/* Form to add a new archetype */}
              <View className="border-t border-zinc-800 pt-3">
                <Text className="text-xs font-black text-white mb-2 uppercase">
                  + Prescribe New Meal
                </Text>

                <TextInput
                  value={newArchName}
                  onChangeText={setNewArchName}
                  placeholder="Meal Name (e.g. Post-Workout Shake)"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white px-3 py-2 rounded-xl text-xs font-bold mb-2"
                />

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
      )}

      {/* Modal: Seat Tier Upgrade & Management */}
      {showSeatUpgradeModal && (
        <SeatUpgradeModal
          visible={showSeatUpgradeModal}
          onClose={() => setShowSeatUpgradeModal(false)}
          currentSubscription={trainerSubscription}
          activeSeatsUsed={activeSeatsUsed}
          isCurrentlyAthlete={false}
          onUpgradeSuccess={(tier, customSeats) => upgradeTrainerSubscription(tier, customSeats)}
          onRequireDowngradeReconcile={handleDowngradeReconcileTrigger}
          onSwitchToAthlete={() => {
            setAccountType('athlete');
            router.push('/(tabs)/workouts' as any);
          }}
        />
      )}

      {/* Modal: Downgrade Seat Reconciliation */}
      {showDowngradeModal && (
        <DowngradeReconcileModal
          visible={showDowngradeModal}
          onClose={() => setShowDowngradeModal(false)}
          targetTier={downgradeTargetTier}
          activeClients={activeClients}
          onConfirmReconcile={(tier, selectedIds) => {
            reconcileDowngradeSeats(tier, selectedIds);
            Alert.alert(
              'Tier Downgraded',
              `Switched to ${TIER_CONFIGS[tier].name}. ${selectedIds.length} clients are active and the remainder were archived.`
            );
          }}
        />
      )}

      {/* Modal: Claim Account / QR PIN */}
      {Boolean(claimClientTarget) && (
        <ClaimClientModal
          visible={Boolean(claimClientTarget)}
          onClose={() => setClaimClientTarget(null)}
          client={claimClientTarget}
          coachName={coachProfile.name}
          onGenerateToken={(clientId, force) => generateClientClaimToken(clientId, force)}
        />
      )}

      {/* Modal: Pick Routine to Coach for Client */}
      {selectedClientForRoutineLaunch && showRosterRoutinePickerModal ? (
        <Modal
          visible={showRosterRoutinePickerModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowRosterRoutinePickerModal(false);
            setSelectedClientForRoutineLaunch(null);
          }}
        >
          <View className="flex-1 bg-black/80 justify-end">
            <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <View className="flex-row items-center space-x-2.5">
                  <View className="w-8 h-8 rounded-lg bg-accent-cyan items-center justify-center">
                    <Ionicons name="play" size={16} color="#09090B" />
                  </View>
                  <View>
                    <Text className="text-base font-black text-white">Choose Workout to Coach</Text>
                    <Text className="text-xs text-zinc-400">
                      Coaching {selectedClientForRoutineLaunch.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowRosterRoutinePickerModal(false);
                    setSelectedClientForRoutineLaunch(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
                {getClientRoutinesWithDetails(selectedClientForRoutineLaunch).map((routine, idx) => (
                  <TouchableOpacity
                    key={routine.id || `choose-roster-${idx}`}
                    activeOpacity={0.8}
                    onPress={() =>
                      launchSpecificRoutineForClient(selectedClientForRoutineLaunch, routine)
                    }
                    className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-2.5 flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-black text-white">{routine.name}</Text>
                      <Text className="text-xs text-accent-cyan font-bold mt-0.5">
                        {routine.splitName} • {routine.exerciseIds.length} Exercises
                      </Text>
                    </View>

                    <View className="bg-accent-cyan px-3.5 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20">
                      <Ionicons name="play" size={13} color="#09090B" />
                      <Text className="text-xs font-black text-black">Start</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Free Custom Workout Option */}
                <TouchableOpacity
                  onPress={() => {
                    launchSpecificRoutineForClient(selectedClientForRoutineLaunch, {
                      name: `${selectedClientForRoutineLaunch.name}'s Training`,
                      exerciseIds: [],
                    });
                  }}
                  className="bg-zinc-950 border border-dashed border-zinc-750 p-3.5 rounded-2xl flex-row items-center justify-between mt-1"
                >
                  <View className="flex-row items-center space-x-2.5">
                    <Ionicons name="add" size={18} color="#A1A1AA" />
                    <View>
                      <Text className="text-xs font-bold text-zinc-200">Free / Custom Session</Text>
                      <Text className="text-[10px] text-zinc-500">Pick exercises on the fly</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#71717A" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
};
