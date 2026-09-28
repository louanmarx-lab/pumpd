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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { PrescribedMealArchetype, ClientProfile } from '../../../src/types/trainer';

const MEAL_EMOJIS = ['🍗', '🥩', '🍳', '🥤', '🥑', '🥣', '🥗', '🐟', '🥞', '🥪'];

export default function MealPlansScreen() {
  const router = useRouter();
  const {
    coachProfile,
    clients,
    coachMeals,
    addCoachMeal,
    deleteCoachMeal,
    updateClient,
    assignClientArchetypes,
    assignClientMacros,
    assignMealToSelf,
    enterPersonalAthleteMode,
    currentUser,
    updateMacroTargets,
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

  // Create Archetype Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍗');
  const [calories, setCalories] = useState('500');
  const [protein, setProtein] = useState('45');
  const [carbs, setCarbs] = useState('50');
  const [fats, setFats] = useState('12');
  const [instructions, setInstructions] = useState('');

  // Prescribe to Client Modal
  const [selectedArchetypeToAssign, setSelectedArchetypeToAssign] =
    useState<PrescribedMealArchetype | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Macro Goals Prescription Modal
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [selectedClientIdForMacros, setSelectedClientIdForMacros] = useState<string | null>(null);
  const [targetCalories, setTargetCalories] = useState('2400');
  const [targetProtein, setTargetProtein] = useState('180');
  const [targetCarbs, setTargetCarbs] = useState('240');
  const [targetFats, setTargetFats] = useState('70');

  const handleCreateArchetype = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a meal name.');
      return;
    }

    addCoachMeal({
      name: name.trim(),
      emoji,
      calories: parseInt(calories, 10) || 400,
      protein: parseInt(protein, 10) || 30,
      carbs: parseInt(carbs, 10) || 40,
      fats: parseInt(fats, 10) || 10,
      prescribedBy: coachProfile.businessName || coachProfile.name,
      instructions: instructions.trim() || undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setName('');
    setCalories('500');
    setProtein('45');
    setCarbs('50');
    setFats('12');
    setInstructions('');
    setShowCreateModal(false);
  };

  const handleDeleteArchetype = (archId: string, archName: string) => {
    Alert.alert('Remove Meal Template', `Remove "${archName}" from library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteCoachMeal(archId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleAssignArchetypeToSelf = () => {
    if (!selectedArchetypeToAssign) return;

    assignMealToSelf(selectedArchetypeToAssign);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      '✅ Added to Your Meals!',
      `"${selectedArchetypeToAssign.name}" has been added to your personal athlete profile. You can log it anytime in your Nutrition tab.`,
      [
        {
          text: 'View in My Nutrition →',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            enterPersonalAthleteMode();
            router.push('/(tabs)/nutrition');
          },
        },
        { text: 'Done', style: 'cancel' },
      ]
    );
    setShowAssignModal(false);
    setSelectedArchetypeToAssign(null);
  };

  const handleAssignArchetype = (clientId: string) => {
    if (!selectedArchetypeToAssign) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const exists = client.prescribedArchetypes.some(
      (a) => a.id === selectedArchetypeToAssign.id
    );

    const updatedArchetypes = exists
      ? client.prescribedArchetypes
      : [...client.prescribedArchetypes, selectedArchetypeToAssign];

    const updatedClient: ClientProfile = {
      ...client,
      prescribedArchetypes: updatedArchetypes,
    };

    // Push directly to client's Firestore profile & coach roster
    assignClientArchetypes(clientId, updatedArchetypes);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      '✅ Meal Prescribed!',
      `"${selectedArchetypeToAssign.name}" has been added to ${client.name}'s Nutrition profile. They can see it immediately in the app.`,
      [
        {
          text: 'View in Profile →',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            startManagingClient(updatedClient);
            router.push('/(tabs)/nutrition');
          },
        },
        { text: 'Done', style: 'cancel' },
      ]
    );
    setShowAssignModal(false);
    setSelectedArchetypeToAssign(null);
  };

  const handleSaveClientMacros = () => {
    if (!selectedClientIdForMacros) return;

    const newTargets = {
      calories: parseInt(targetCalories, 10) || 2400,
      protein: parseInt(targetProtein, 10) || 160,
      carbs: parseInt(targetCarbs, 10) || 240,
      fats: parseInt(targetFats, 10) || 70,
    };

    if (selectedClientIdForMacros === currentUser.id) {
      updateMacroTargets(newTargets);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Macro Goals Updated', 'Personal daily macro goals saved.');
      setShowMacroModal(false);
      setSelectedClientIdForMacros(null);
      return;
    }

    const client = clients.find((c) => c.id === selectedClientIdForMacros);
    if (!client) return;

    // Push macro targets directly to client's Firestore profile & coach roster
    assignClientMacros(selectedClientIdForMacros, newTargets);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Macro Goals Updated', `Prescribed macro goals saved for ${client.name}.`);
    setShowMacroModal(false);
    setSelectedClientIdForMacros(null);
  };

  const handleShareDietPlan = async (clientName: string, clientMacros: any, archetypes: PrescribedMealArchetype[]) => {
    try {
      Haptics.selectionAsync();
      const message = [
        `🥗 ${coachProfile.businessName || 'COACH DIET PRESCRIPTION'}`,
        `Client: ${clientName}`,
        `Coach: ${coachProfile.name} (${coachProfile.instagramHandle})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 DAILY MACRO GOALS:`,
        `• Calories: ${clientMacros.calories} kcal`,
        `• Protein: ${clientMacros.protein}g`,
        `• Carbs: ${clientMacros.carbs}g`,
        `• Fats: ${clientMacros.fats}g`,
        ``,
        `📋 PRESCRIBED MEALS:`,
        ...(archetypes.length > 0
          ? archetypes.map(
              (a) => `• ${a.emoji} ${a.name}: ${a.protein}P / ${a.carbs}C / ${a.fats}F (${a.calories} kcal)${a.instructions ? ` - ${a.instructions}` : ''}`
            )
          : ['• Flexible dieting adhering to macros']),
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Track directly in RIPPED App.`,
      ].join('\n');

      await Share.share({
        message,
        title: `${clientName}'s Diet Plan`,
      });
    } catch (err) {
      // Ignored
    }
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header action bar */}
      <View className="bg-dark-card border-b border-dark-border px-4 py-3 flex-row items-center justify-between">
        <View className="flex-1 mr-3 min-w-0">
          <Text className="text-white font-extrabold text-base" numberOfLines={1}>
            Meal Plans & Diets
          </Text>
          <Text className="text-zinc-400 text-xs" numberOfLines={1}>
            Prescribe meals & macro targets to clients
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowCreateModal(true);
          }}
          className="bg-accent-cyan px-3 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20 shrink-0"
        >
          <Ionicons name="add" size={18} color="#09090B" />
          <Text className="text-black font-extrabold text-xs">New Meal</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 mb-4 flex-row items-center space-x-3">
          <View className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/50 items-center justify-center">
            <Ionicons name="restaurant" size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-emerald-300">Coach Diet Suite</Text>
            <Text className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
              Design standardized meal archetypes and prescribe custom daily macro goals for each of your athletes.
            </Text>
          </View>
        </View>

        {/* Client Macro Goals Quick Section */}
        <View className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md">
          <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
            <View className="flex-row items-center space-x-2">
              <Ionicons name="pie-chart" size={16} color="#06B6D4" />
              <Text className="text-sm font-black text-white">Client Macro Prescriptions</Text>
            </View>
          </View>

          {/* Coach's Own Macro Goals Card */}
          <View className="bg-cyan-950/20 border border-cyan-500/40 rounded-xl p-3 mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 items-center justify-center">
                <Text className="text-base">👤</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center space-x-1.5">
                  <Text className="text-xs font-bold text-white">Myself (Personal Targets)</Text>
                  <View className="bg-cyan-500/20 px-1 py-0.2 rounded">
                    <Text className="text-[8px] font-black text-cyan-400">YOU</Text>
                  </View>
                </View>
                <Text className="text-[10px] text-cyan-300/80 font-mono">
                  {currentUser.macroTargets.calories} kcal • {currentUser.macroTargets.protein}P • {currentUser.macroTargets.carbs}C • {currentUser.macroTargets.fats}F
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedClientIdForMacros(currentUser.id);
                setTargetCalories(currentUser.macroTargets.calories.toString());
                setTargetProtein(currentUser.macroTargets.protein.toString());
                setTargetCarbs(currentUser.macroTargets.carbs.toString());
                setTargetFats(currentUser.macroTargets.fats.toString());
                setShowMacroModal(true);
              }}
              className="bg-cyan-500/20 border border-cyan-500/50 px-2.5 py-1.5 rounded-lg"
            >
              <Text className="text-[10px] font-bold text-cyan-300">Edit Goals</Text>
            </TouchableOpacity>
          </View>

          {clients.length === 0 ? (
            <Text className="text-xs text-zinc-500 italic">No clients added yet</Text>
          ) : (
            clients.map((c) => (
              <View
                key={c.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-2 flex-row items-center justify-between"
              >
                <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
                  <Text className="text-xl">{c.avatarEmoji || '⚡'}</Text>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-white">{c.name}</Text>
                    <Text className="text-[10px] text-zinc-400 font-mono">
                      {c.macroTargets.calories} kcal • {c.macroTargets.protein}P • {c.macroTargets.carbs}C • {c.macroTargets.fats}F
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center space-x-1.5">
                  <TouchableOpacity
                    onPress={() =>
                      handleShareDietPlan(c.name, c.macroTargets, c.prescribedArchetypes)
                    }
                    className="bg-zinc-800 p-2 rounded-lg"
                  >
                    <Ionicons name="share-social-outline" size={14} color="#A1A1AA" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedClientIdForMacros(c.id);
                      setTargetCalories(c.macroTargets.calories.toString());
                      setTargetProtein(c.macroTargets.protein.toString());
                      setTargetCarbs(c.macroTargets.carbs.toString());
                      setTargetFats(c.macroTargets.fats.toString());
                      setShowMacroModal(true);
                    }}
                    className="bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1.5 rounded-lg"
                  >
                    <Text className="text-[10px] font-bold text-cyan-300">Edit Goals</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Prescribed Meal Archetypes Library */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Meal Archetypes Library ({coachMeals.length})
            </Text>
          </View>

          {coachMeals.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="fast-food-outline" size={36} color="#71717A" />
              <Text className="text-zinc-400 text-xs mt-2">No meal templates created yet.</Text>
            </View>
          ) : (
            coachMeals.map((arch) => (
              <View
                key={arch.id}
                className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-3 shadow-md"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center space-x-2.5 flex-1 pr-2">
                    <Text className="text-2xl">{arch.emoji || '🍗'}</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-white">{arch.name}</Text>
                      {arch.instructions ? (
                        <Text className="text-xs text-zinc-400 mt-0.5" numberOfLines={2}>
                          {arch.instructions}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteArchetype(arch.id, arch.name)}
                    className="p-1.5"
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Macro Pills */}
                <View className="flex-row items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl my-1 border border-zinc-800">
                  <View className="flex-1 items-center">
                    <Text className="text-[10px] text-zinc-400 uppercase">Calories</Text>
                    <Text className="text-xs font-black text-accent-cyan">{arch.calories}</Text>
                  </View>
                  <View className="w-px h-5 bg-zinc-800" />
                  <View className="flex-1 items-center">
                    <Text className="text-[10px] text-zinc-400 uppercase">Protein</Text>
                    <Text className="text-xs font-black text-rose-400">{arch.protein}g</Text>
                  </View>
                  <View className="w-px h-5 bg-zinc-800" />
                  <View className="flex-1 items-center">
                    <Text className="text-[10px] text-zinc-400 uppercase">Carbs</Text>
                    <Text className="text-xs font-black text-amber-400">{arch.carbs}g</Text>
                  </View>
                  <View className="w-px h-5 bg-zinc-800" />
                  <View className="flex-1 items-center">
                    <Text className="text-[10px] text-zinc-400 uppercase">Fats</Text>
                    <Text className="text-xs font-black text-purple-400">{arch.fats}g</Text>
                  </View>
                </View>

                {/* Prescribe Button */}
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedArchetypeToAssign(arch);
                    setShowAssignModal(true);
                  }}
                  className="bg-zinc-850 border border-zinc-750 py-2 rounded-xl items-center flex-row justify-center space-x-1.5 mt-2.5"
                >
                  <Ionicons name="person-add" size={14} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-300">Prescribe to Client</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* CREATE ARCHE TYPE MODAL */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-zinc-800">
              <Text className="text-lg font-bold text-white">Create Meal Template</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            {/* Emoji Selector */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Select Emoji
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {MEAL_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEmoji(e);
                  }}
                  className={`w-10 h-10 rounded-xl items-center justify-center border ${
                    emoji === e ? 'bg-cyan-500/20 border-cyan-400' : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <Text className="text-xl">{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Meal Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pre-Workout Oatmeal & Whey"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm mb-3 font-semibold"
            />

            {/* Macros 4-column */}
            <View className="flex-row space-x-2 mb-3">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Calories</Text>
                <TextInput
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white text-center font-bold text-xs"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Protein (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white text-center font-bold text-xs"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Carbs (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white text-center font-bold text-xs"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Fats (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={fats}
                  onChangeText={setFats}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white text-center font-bold text-xs"
                />
              </View>
            </View>

            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Instructions / Ingredients Notes
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="e.g. 80g rolled oats, 1 scoop isolate, 1 tbsp peanut butter"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-xs mb-4"
            />

            <TouchableOpacity
              onPress={handleCreateArchetype}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-extrabold text-sm">Save Meal to Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PRESCRIBE ARCHE TYPE MODAL */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <View>
                <Text className="text-lg font-bold text-white">Prescribe Meal to Client</Text>
                <Text className="text-xs text-accent-cyan font-semibold mt-0.5">
                  {selectedArchetypeToAssign?.emoji} {selectedArchetypeToAssign?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mb-4">
              {/* Option 1: Coach's own Personal Athlete Profile */}
              <TouchableOpacity
                onPress={handleAssignArchetypeToSelf}
                className="p-3.5 bg-cyan-950/30 border border-cyan-500/50 rounded-xl mb-2.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center space-x-3 flex-1 mr-2">
                  <View className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 items-center justify-center">
                    <Text className="text-xl">🥗</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center space-x-2">
                      <Text className="text-sm font-bold text-white">Myself (Personal Profile)</Text>
                      <View className="bg-cyan-500/20 px-1.5 py-0.5 rounded">
                        <Text className="text-[9px] font-black text-cyan-400">YOU</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-cyan-300/80">
                      Add to your personal Quick Add meal archetypes
                    </Text>
                  </View>
                </View>

                <View className="px-3 py-1.5 rounded-lg bg-cyan-500">
                  <Text className="text-xs font-bold text-black">Add to Me</Text>
                </View>
              </TouchableOpacity>

              <View className="h-px bg-zinc-800 my-2" />
              <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                Clients Roster ({clients.length})
              </Text>

              {clients.length === 0 ? (
                <Text className="text-zinc-500 text-xs text-center py-4">No clients in roster yet.</Text>
              ) : (
                clients.map((c) => {
                  const alreadyPrescribed = c.prescribedArchetypes.some(
                    (a) => a.id === selectedArchetypeToAssign?.id
                  );

                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => handleAssignArchetype(c.id)}
                      className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center space-x-3">
                        <Text className="text-2xl">{c.avatarEmoji || '⚡'}</Text>
                        <View>
                          <Text className="text-sm font-bold text-white">{c.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {c.prescribedArchetypes.length} meals currently prescribed
                          </Text>
                        </View>
                      </View>

                      <View
                        className={`px-3 py-1.5 rounded-lg ${
                          alreadyPrescribed ? 'bg-zinc-800' : 'bg-cyan-500'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            alreadyPrescribed ? 'text-zinc-400' : 'text-black'
                          }`}
                        >
                          {alreadyPrescribed ? 'Added ✓' : 'Prescribe'}
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

      {/* EDIT CLIENT MACROS MODAL */}
      <Modal visible={showMacroModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <Text className="text-lg font-bold text-white">Prescribe Daily Macro Targets</Text>
              <TouchableOpacity onPress={() => setShowMacroModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <View className="flex-row space-x-2 mb-5">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Calories</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetCalories}
                  onChangeText={setTargetCalories}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2.5 text-white text-center font-bold text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Protein (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetProtein}
                  onChangeText={setTargetProtein}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2.5 text-white text-center font-bold text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Carbs (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetCarbs}
                  onChangeText={setTargetCarbs}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2.5 text-white text-center font-bold text-sm"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Fats (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetFats}
                  onChangeText={setTargetFats}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2.5 text-white text-center font-bold text-sm"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveClientMacros}
              className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/25"
            >
              <Text className="text-black font-extrabold text-sm">Save Macro Prescription</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
