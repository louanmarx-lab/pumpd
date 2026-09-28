import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { MealArchetype } from '../types/gymjam';
import { DEFAULT_ARCHETYPES } from '../utils/mealArchetypes';
import { useUserWorkspace } from '../context/UserWorkspaceContext';
import { PrescribedMealArchetype } from '../types/trainer';

export { DEFAULT_ARCHETYPES };

const STORAGE_KEY_PREFIX = '@ripped_meal_archetypes_v3';
const LEGACY_STORAGE_KEY = '@ripped_custom_meal_archetypes';

const POPULAR_EMOJIS = ['🥗', '🍗', '🥤', '🥩', '🍳', '🍫', '🥑', '🍚', '🥪', '🥣', '🍎', '🥞', '🍣', '🍱'];

interface MealArchetypesQuickAddProps {
  onLogMeal: (meal: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    recipe?: string;
  }) => void;
}

export const MealArchetypesQuickAdd: React.FC<MealArchetypesQuickAddProps> = ({ onLogMeal }) => {
  const {
    activeUser,
    prescribedArchetypes,
    setPrescribedArchetypes,
    coachProfile,
    userRole,
    managedClient,
    assignClientArchetypes,
  } = useUserWorkspace();

  const storageKey = useMemo(() => {
    return activeUser?.id ? `${STORAGE_KEY_PREFIX}_${activeUser.id}` : STORAGE_KEY_PREFIX;
  }, [activeUser?.id]);

  const [archetypes, setArchetypes] = useState<MealArchetype[]>([]);
  const [isManaging, setIsManaging] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingArchetype, setEditingArchetype] = useState<MealArchetype | null>(null);

  // Form states for new/editing archetype
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('🥗');
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFats, setFormFats] = useState('');
  const [formRecipe, setFormRecipe] = useState('');

  // Load archetypes from AsyncStorage
  useEffect(() => {
    const loadArchetypes = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setArchetypes(parsed);
            return;
          }
        }

        // Check legacy storage
        const legacyStored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyStored !== null) {
          try {
            const legacyParsed = JSON.parse(legacyStored);
            if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
              const combined = [...DEFAULT_ARCHETYPES, ...legacyParsed];
              setArchetypes(combined);
              await AsyncStorage.setItem(storageKey, JSON.stringify(combined));
              return;
            }
          } catch {}
        }

        // Initialize with default archetypes
        setArchetypes(DEFAULT_ARCHETYPES);
        await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_ARCHETYPES));
      } catch (err) {
        console.warn('Failed to load meal archetypes:', err);
        setArchetypes(DEFAULT_ARCHETYPES);
      }
    };

    loadArchetypes();
  }, [storageKey]);

  const saveArchetypes = async (list: MealArchetype[]) => {
    setArchetypes(list);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save meal archetypes:', err);
    }
  };

  const handleQuickLog = (archetype: MealArchetype) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLogMeal({
      label: `${archetype.emoji} ${archetype.name}`,
      calories: archetype.calories,
      protein: archetype.protein,
      carbs: archetype.carbs,
      fats: archetype.fats,
      recipe: archetype.recipe || archetype.instructions,
    });
  };

  // Open Create Modal
  const openCreateModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingArchetype(null);
    setFormName('');
    setFormEmoji('🥗');
    setFormCalories('');
    setFormProtein('');
    setFormCarbs('');
    setFormFats('');
    setFormRecipe('');
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (arch: MealArchetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingArchetype(arch);
    setFormName(arch.name);
    setFormEmoji(arch.emoji);
    setFormCalories(arch.calories > 0 ? arch.calories.toString() : '');
    setFormProtein(arch.protein > 0 ? arch.protein.toString() : '');
    setFormCarbs(arch.carbs > 0 ? arch.carbs.toString() : '');
    setFormFats(arch.fats > 0 ? arch.fats.toString() : '');
    setFormRecipe(arch.recipe || arch.instructions || '');
    setShowModal(true);
  };

  // Save Create or Edit
  const handleSaveForm = () => {
    if (!formName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for your meal archetype.');
      return;
    }

    const p = parseFloat(formProtein) || 0;
    const c = parseFloat(formCarbs) || 0;
    const f = parseFloat(formFats) || 0;
    const userCals = parseInt(formCalories, 10) || 0;

    // Auto-calculate calories if left blank
    const finalCalories = userCals > 0 ? userCals : Math.round(p * 4 + c * 4 + f * 9);
    const cleanedRecipe = formRecipe.trim() || undefined;

    if (editingArchetype) {
      const isPrescribed =
        (prescribedArchetypes || []).some((pa) => pa.id === editingArchetype.id) ||
        (managedClient?.prescribedArchetypes || []).some((pa) => pa.id === editingArchetype.id);

      if (isPrescribed) {
        setPrescribedArchetypes((prev) =>
          prev.map((pa) =>
            pa.id === editingArchetype.id
              ? {
                  ...pa,
                  name: formName.trim(),
                  emoji: formEmoji.trim() || '🍱',
                  calories: finalCalories,
                  protein: p,
                  carbs: c,
                  fats: f,
                  recipe: cleanedRecipe,
                  instructions: cleanedRecipe,
                }
              : pa
          )
        );
        if (managedClient) {
          assignClientArchetypes(
            managedClient.id,
            (managedClient.prescribedArchetypes || []).map((pa) =>
              pa.id === editingArchetype.id
                ? {
                    ...pa,
                    name: formName.trim(),
                    emoji: formEmoji.trim() || '🍱',
                    calories: finalCalories,
                    protein: p,
                    carbs: c,
                    fats: f,
                    recipe: cleanedRecipe,
                    instructions: cleanedRecipe,
                  }
                : pa
            )
          );
        }
      }

      const existsInArchetypes = archetypes.some((a) => a.id === editingArchetype.id);
      if (existsInArchetypes) {
        const updated = archetypes.map((a) =>
          a.id === editingArchetype.id
            ? {
                ...a,
                name: formName.trim(),
                emoji: formEmoji.trim() || '🍱',
                calories: finalCalories,
                protein: p,
                carbs: c,
                fats: f,
                recipe: cleanedRecipe,
                instructions: cleanedRecipe,
              }
            : a
        );
        saveArchetypes(updated);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const created: MealArchetype = {
        id: `arch_custom_${Date.now()}`,
        name: formName.trim(),
        emoji: formEmoji.trim() || '🍱',
        calories: finalCalories,
        protein: p,
        carbs: c,
        fats: f,
        isCustom: true,
        recipe: cleanedRecipe,
        instructions: cleanedRecipe,
        prescribedBy: userRole === 'coach' ? coachProfile.businessName || coachProfile.name : undefined,
      };
      const updated = [...archetypes, created];
      saveArchetypes(updated);

      // If currently managing a client, automatically allocate this new meal archetype to the client!
      if (managedClient) {
        const newPrescribed: PrescribedMealArchetype = {
          id: created.id,
          name: created.name,
          emoji: created.emoji,
          calories: created.calories,
          protein: created.protein,
          carbs: created.carbs,
          fats: created.fats,
          prescribedBy: coachProfile.businessName || coachProfile.name || 'Personal Trainer',
          instructions: created.recipe || created.instructions,
        };
        const currentPrescribed = managedClient.prescribedArchetypes || [];
        const nextPrescribed = [...currentPrescribed, newPrescribed];
        assignClientArchetypes(managedClient.id, nextPrescribed);
        setPrescribedArchetypes((prev) => [...prev, newPrescribed]);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setShowModal(false);
  };

  // Delete archetype (works on default, prescribed, and custom!)
  const handleDeleteArchetype = (arch: MealArchetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Archetype', `Are you sure you want to remove "${arch.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          // 1. Remove from local stored archetypes
          const updated = archetypes.filter((a) => a.id !== arch.id);
          saveArchetypes(updated);

          // 2. Remove from prescribedArchetypes in context
          setPrescribedArchetypes((prev) => prev.filter((pa) => pa.id !== arch.id));

          // 3. Remove from managedClient if currently managing a client
          if (managedClient) {
            assignClientArchetypes(
              managedClient.id,
              (managedClient.prescribedArchetypes || []).filter((pa) => pa.id !== arch.id)
            );
          }

          if (editingArchetype?.id === arch.id) {
            setShowModal(false);
          }
        },
      },
    ]);
  };

  // Clear all archetypes (presets and prescribed)
  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear All Presets?',
      'Are you sure you want to remove all meal presets and prescribed archetypes? You can restore defaults at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            saveArchetypes([]);
            setPrescribedArchetypes([]);
            if (managedClient) {
              assignClientArchetypes(managedClient.id, []);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  // Reset to original factory defaults
  const handleResetDefaults = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Reset Presets to Defaults?',
      'This will restore the 4 default meal archetypes (Shake, Chicken & Rice, Eggs & Toast, Protein Bar).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Defaults',
          style: 'destructive',
          onPress: () => {
            saveArchetypes(DEFAULT_ARCHETYPES);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Long-press options menu
  const handleCardLongPress = (arch: MealArchetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const recipeText = arch.recipe || arch.instructions;
    Alert.alert(
      `${arch.emoji} ${arch.name}`,
      `${arch.calories} kcal • ${arch.protein}g P • ${arch.carbs}g C • ${arch.fats}g F${
        recipeText ? `\n\n📝 Recipe / Ingredients:\n${recipeText}` : ''
      }`,
      [
        {
          text: 'Log This Meal',
          onPress: () => handleQuickLog(arch),
        },
        {
          text: 'Edit Preset',
          onPress: () => openEditModal(arch),
        },
        {
          text: 'Delete Preset',
          style: 'destructive',
          onPress: () => handleDeleteArchetype(arch),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  // Combine stored user archetypes with any coach prescribed archetypes
  const isCoachUser = userRole === 'coach';
  const prescribedSource = managedClient
    ? managedClient.prescribedArchetypes || []
    : prescribedArchetypes || [];

  const prescribedList: MealArchetype[] = prescribedSource.map((pa) => ({
    id: pa.id,
    name: pa.name,
    emoji: pa.emoji,
    calories: pa.calories,
    protein: pa.protein,
    carbs: pa.carbs,
    fats: pa.fats,
    isCustom: true,
    prescribedBy: isCoachUser
      ? pa.prescribedBy || coachProfile.businessName || 'Coach'
      : pa.prescribedBy || 'Coach',
    instructions: pa.instructions,
    recipe: pa.recipe || pa.instructions,
  }));

  // Prescribed archetypes shown first, followed by stored archetypes
  const allArchetypes = useMemo(() => {
    const existingIds = new Set(prescribedList.map((p) => p.id));
    const nonDuplicatedStored = archetypes.filter((a) => !existingIds.has(a.id));
    return [...prescribedList, ...nonDuplicatedStored];
  }, [prescribedList, archetypes]);

  return (
    <View className="mb-4">
      {/* Section Header with Controls */}
      <View className="flex-row items-center justify-between px-1 mb-2">
        <View className="flex-row items-center space-x-1.5 flex-1 mr-2 min-w-0">
          <Ionicons name="flash-outline" size={15} color="#06B6D4" />
          <Text
            className="text-xs font-black text-cyan-400 uppercase tracking-wider"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Meal Archetypes
          </Text>
        </View>

        <View className="flex-row items-center space-x-1.5 shrink-0">
          {/* + New Button */}
          <TouchableOpacity
            onPress={openCreateModal}
            className="bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md flex-row items-center space-x-1"
          >
            <Ionicons name="add" size={12} color="#06B6D4" />
            <Text className="text-[10px] font-extrabold text-accent-cyan">New</Text>
          </TouchableOpacity>

          {/* Manage / Done Toggle Button */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsManaging(!isManaging);
            }}
            className={`px-2 py-0.5 rounded-md flex-row items-center space-x-1 border ${
              isManaging
                ? 'bg-accent-cyan border-cyan-400'
                : 'bg-zinc-800 border-zinc-700'
            }`}
          >
            <Ionicons
              name={isManaging ? 'checkmark' : 'create-outline'}
              size={11}
              color={isManaging ? '#09090B' : '#A1A1AA'}
            />
            <Text
              className={`text-[10px] font-bold ${
                isManaging ? 'text-black font-black' : 'text-zinc-300'
              }`}
            >
              {isManaging ? 'Done' : 'Manage'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Management Toolbar (visible only in Manage mode) */}
      {isManaging && (
        <View className="flex-row items-center justify-between bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl mb-2.5 mx-1">
          <Text className="text-[10px] text-zinc-400 font-semibold">Presets Manager</Text>
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={handleClearAll}
              className="bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-lg flex-row items-center space-x-1"
            >
              <Ionicons name="trash-outline" size={11} color="#F43F5E" />
              <Text className="text-[10px] font-bold text-rose-400">Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResetDefaults}
              className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg flex-row items-center space-x-1"
            >
              <Ionicons name="refresh-outline" size={11} color="#A1A1AA" />
              <Text className="text-[10px] font-bold text-zinc-300">Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 4 }}
      >
        {allArchetypes.length === 0 ? (
          <View className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mr-2.5 items-center justify-center w-56">
            <Text className="text-xs font-bold text-zinc-400 mb-1">No presets found</Text>
            <Text className="text-[10px] text-zinc-500 text-center mb-2.5">
              Create a custom preset or restore default archetypes.
            </Text>
            <TouchableOpacity
              onPress={handleResetDefaults}
              className="bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700"
            >
              <Text className="text-[10px] font-bold text-cyan-400">Restore Defaults</Text>
            </TouchableOpacity>
          </View>
        ) : (
          allArchetypes.map((arch) => (
            <TouchableOpacity
              key={arch.id}
              activeOpacity={0.8}
              onPress={() => {
                if (isManaging) {
                  openEditModal(arch);
                } else {
                  handleQuickLog(arch);
                }
              }}
              onLongPress={() => handleCardLongPress(arch)}
              className={`border mr-2.5 p-3 rounded-2xl w-48 justify-between shadow-sm relative ${
                isManaging
                  ? 'border-cyan-500/60 bg-zinc-900/90'
                  : arch.prescribedBy
                  ? 'bg-emerald-950/20 border-emerald-500/50'
                  : 'bg-dark-card border-dark-border'
              }`}
            >
              {/* Top Row: Emoji & Status Badges */}
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xl">{arch.emoji}</Text>
                {isManaging ? (
                  <View className="flex-row items-center space-x-1">
                    <View className="bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/40">
                      <Text className="text-[8px] font-black text-cyan-400">EDIT</Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeleteArchetype(arch);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      className="bg-rose-600 w-5 h-5 rounded-full items-center justify-center shadow-lg"
                    >
                      <Ionicons name="trash" size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : arch.prescribedBy ? (
                  <View className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    <Text className="text-[8px] font-black text-emerald-400">COACH</Text>
                  </View>
                ) : arch.isCustom ? (
                  <View className="bg-cyan-500/15 px-1.5 py-0.5 rounded">
                    <Text className="text-[8px] font-bold text-cyan-400">CUSTOM</Text>
                  </View>
                ) : null}
              </View>

              {/* Title with full width & up to 2 lines without truncation */}
              <Text className="text-xs font-extrabold text-white mb-2 leading-tight" numberOfLines={2}>
                {arch.name}
              </Text>

              <View className="flex-row items-baseline justify-between mt-0.5 mb-1.5">
                <Text className="text-base font-black text-accent-cyan">{arch.calories}</Text>
                <Text className="text-[10px] font-bold text-zinc-400">kcal</Text>
              </View>

              <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-lg px-2 py-1 flex-row justify-between items-center mb-1">
                <Text className="text-[10px] font-black text-emerald-400">{arch.protein}g P</Text>
                <Text className="text-[10px] font-black text-cyan-300">{arch.carbs}g C</Text>
                <Text className="text-[10px] font-black text-amber-400">{arch.fats}g F</Text>
              </View>

              {(arch.recipe || arch.instructions) ? (
                <View className="flex-row items-center space-x-1 mt-1 bg-zinc-900/80 rounded px-1.5 py-1 border border-zinc-800/60">
                  <Ionicons name="receipt-outline" size={9} color="#06B6D4" />
                  <Text className="text-[9px] text-zinc-300 italic flex-1" numberOfLines={1}>
                    {arch.recipe || arch.instructions}
                  </Text>
                </View>
              ) : isManaging ? (
                <Text className="text-[9px] text-cyan-400 font-semibold mt-0.5">
                  Tap to edit details
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}

        {/* Add Custom Archetype Button Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openCreateModal}
          className="bg-zinc-900/80 border border-dashed border-zinc-700 mr-2 p-3 rounded-2xl w-28 items-center justify-center"
        >
          <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center mb-1">
            <Ionicons name="add" size={18} color="#06B6D4" />
          </View>
          <Text className="text-xs font-bold text-zinc-300 text-center">+ Preset</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* CREATE & EDIT ARCHETYPE MODAL */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/85 justify-end"
        >
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons
                  name={editingArchetype ? 'pencil' : 'add-circle'}
                  size={20}
                  color="#06B6D4"
                />
                <Text className="text-lg font-black text-white">
                  {editingArchetype ? 'Edit Meal Archetype' : 'New Meal Archetype'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs text-zinc-400 mb-3">
                {editingArchetype
                  ? 'Update this meal archetype to automatically log your macros in 1 tap.'
                  : 'Create a custom meal archetype with exact macro distribution for fast logging.'}
              </Text>

              {/* Emoji Picker Pill Selector */}
              <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">
                Choose Emoji
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerStyle={{ paddingVertical: 2 }}
              >
                {POPULAR_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => setFormEmoji(emoji)}
                    className={`w-10 h-10 rounded-xl items-center justify-center mr-2 border ${
                      formEmoji === emoji
                        ? 'bg-cyan-500/20 border-cyan-400'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text className="text-lg">{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Emoji and Name */}
              <View className="flex-row space-x-2 mb-3">
                <TextInput
                  value={formEmoji}
                  onChangeText={setFormEmoji}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-center text-xl"
                  maxLength={4}
                />
                <TextInput
                  placeholder="Archetype Name (e.g. Protein Smoothie)"
                  placeholderTextColor="#71717A"
                  value={formName}
                  onChangeText={setFormName}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-semibold text-sm"
                />
              </View>

              {/* Macros Input */}
              <View className="flex-row space-x-2 mb-2">
                <View className="flex-1">
                  <Text className="text-[10px] text-zinc-400 font-bold mb-1">Calories</Text>
                  <TextInput
                    placeholder="Auto"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    value={formCalories}
                    onChangeText={setFormCalories}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-bold text-sm text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-emerald-400 font-bold mb-1">Protein (g)</Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    value={formProtein}
                    onChangeText={setFormProtein}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-bold text-sm text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-cyan-400 font-bold mb-1">Carbs (g)</Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    value={formCarbs}
                    onChangeText={setFormCarbs}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-bold text-sm text-center"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] text-amber-400 font-bold mb-1">Fats (g)</Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor="#71717A"
                    keyboardType="numeric"
                    value={formFats}
                    onChangeText={setFormFats}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-bold text-sm text-center"
                  />
                </View>
              </View>
              <Text className="text-[10px] text-zinc-500 italic mb-3">
                💡 Leave Calories blank to auto-compute from (Protein × 4) + (Carbs × 4) + (Fats × 9).
              </Text>

              {/* Recipe & Ingredients Field */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                    Recipe & Ingredients (Optional)
                  </Text>
                  <Text className="text-[10px] text-zinc-500 italic">How you make it</Text>
                </View>
                <TextInput
                  placeholder="e.g. 2 scoops whey, 100g oats, 1 banana, 400ml milk, 1 tbsp peanut butter"
                  placeholderTextColor="#71717A"
                  multiline
                  numberOfLines={3}
                  value={formRecipe}
                  onChangeText={setFormRecipe}
                  textAlignVertical="top"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-xs leading-relaxed min-h-[70px]"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveForm}
                className="bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/20 mb-3"
              >
                <Text className="text-black font-extrabold text-sm">
                  {editingArchetype ? 'Update Archetype' : 'Save Archetype'}
                </Text>
              </TouchableOpacity>

              {/* Delete button inside edit modal */}
              {editingArchetype && (
                <TouchableOpacity
                  onPress={() => handleDeleteArchetype(editingArchetype)}
                  className="bg-rose-950/30 border border-rose-800/50 py-3 rounded-xl items-center mb-2"
                >
                  <Text className="text-rose-400 font-bold text-xs">
                    Delete Archetype
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
