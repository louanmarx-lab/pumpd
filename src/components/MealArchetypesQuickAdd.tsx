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

const STORAGE_KEY_PREFIX = '@pumpd_meal_archetypes_v3';
const LEGACY_STORAGE_KEY = '@pumpd_custom_meal_archetypes';

const POPULAR_EMOJIS = ['🥗', '🍗', '🥤', '🥩', '🍳', '🍫', '🥑', '🍚', '🥪', '🥣', '🍎', '🥞', '🍣', '🍱'];

interface MealArchetypesQuickAddProps {
  onLogMeal: (meal: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => void;
}

export const MealArchetypesQuickAdd: React.FC<MealArchetypesQuickAddProps> = ({ onLogMeal }) => {
  const { activeUser, prescribedArchetypes, setPrescribedArchetypes, coachProfile, userRole } = useUserWorkspace();

  const storageKey = useMemo(() => {
    return activeUser?.id ? `${STORAGE_KEY_PREFIX}_${activeUser.id}` : STORAGE_KEY_PREFIX;
  }, [activeUser?.id]);

  const [archetypes, setArchetypes] = useState<MealArchetype[]>([]);
  const [isManaging, setIsManaging] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingArchetype, setEditingArchetype] = useState<MealArchetype | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Form states for new/editing archetype
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('🥗');
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formCarbs, setFormCarbs] = useState('');
  const [formFats, setFormFats] = useState('');

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

    if (editingArchetype) {
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
            }
          : a
      );
      saveArchetypes(updated);
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
        prescribedBy: userRole === 'coach' ? coachProfile.businessName || coachProfile.name : undefined,
      };
      const updated = [...archetypes, created];
      saveArchetypes(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setShowModal(false);
  };

  // Delete archetype (works on both default and custom!)
  const handleDeleteArchetype = (arch: MealArchetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Archetype', `Are you sure you want to remove "${arch.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const updated = archetypes.filter((a) => a.id !== arch.id);
          saveArchetypes(updated);
          if (editingArchetype?.id === arch.id) {
            setShowModal(false);
          }
        },
      },
    ]);
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
    Alert.alert(
      `${arch.emoji} ${arch.name}`,
      `${arch.calories} kcal • ${arch.protein}g P • ${arch.carbs}g C • ${arch.fats}g F`,
      [
        {
          text: 'Edit Preset',
          onPress: () => openEditModal(arch),
        },
        {
          text: 'Delete Preset',
          style: 'destructive',
          onPress: () => handleDeleteArchetype(arch),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Import Coach Plan from JSON
  const handleImportPlan = () => {
    try {
      if (!importJsonText.trim()) {
        Alert.alert('Empty', 'Please paste plan JSON.');
        return;
      }
      const parsed = JSON.parse(importJsonText.trim());
      if (Array.isArray(parsed)) {
        const validated: MealArchetype[] = parsed.map((item, idx) => ({
          id: item.id || `arch_imported_${Date.now()}_${idx}`,
          name: item.name || 'Imported Meal',
          emoji: item.emoji || '🍱',
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fats || 0,
          isCustom: true,
          instructions: item.instructions,
        }));
        const updated = [...archetypes, ...validated];
        saveArchetypes(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowImportModal(false);
        setImportJsonText('');
        Alert.alert('Imported', `Successfully imported ${validated.length} meal presets!`);
      } else {
        Alert.alert('Format Error', 'Expected a list of meal archetype objects.');
      }
    } catch {
      Alert.alert('Invalid JSON', 'Could not parse JSON. Check the format.');
    }
  };

  // Combine stored user archetypes with any coach prescribed archetypes
  const prescribedList: MealArchetype[] = (prescribedArchetypes || []).map((pa) => ({
    id: pa.id,
    name: pa.name,
    emoji: pa.emoji,
    calories: pa.calories,
    protein: pa.protein,
    carbs: pa.carbs,
    fats: pa.fats,
    isCustom: true,
    prescribedBy: pa.prescribedBy || coachProfile.businessName || 'Coach',
    instructions: pa.instructions,
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
        <View className="flex-row items-center space-x-1.5">
          <Ionicons name="flash-outline" size={15} color="#06B6D4" />
          <Text className="text-xs font-black text-cyan-400 uppercase tracking-wider">
            Quick-Add Meal Archetypes
          </Text>
        </View>

        <View className="flex-row items-center space-x-2">
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

          {/* Reset Defaults button (visible only in Manage mode) */}
          {isManaging && (
            <TouchableOpacity
              onPress={handleResetDefaults}
              className="bg-zinc-800/90 border border-zinc-750 px-2 py-0.5 rounded-md"
            >
              <Text className="text-[10px] font-bold text-zinc-400">Reset</Text>
            </TouchableOpacity>
          )}

          {/* Import JSON Button */}
          <TouchableOpacity
            onPress={() => setShowImportModal(true)}
            className="bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-750"
          >
            <Text className="text-[10px] font-bold text-zinc-400">Import</Text>
          </TouchableOpacity>
        </View>
      </View>

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
              className={`border mr-2.5 p-3 rounded-2xl w-44 justify-between shadow-sm relative ${
                isManaging
                  ? 'border-cyan-500/60 bg-zinc-900/90'
                  : arch.prescribedBy
                  ? 'bg-emerald-950/20 border-emerald-500/50'
                  : 'bg-dark-card border-dark-border'
              }`}
            >
              {/* Manage Mode Overlays: Delete & Edit Badges */}
              {isManaging ? (
                <>
                  {/* Top-Right Trash Delete Button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleDeleteArchetype(arch);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="absolute -top-2 -right-2 bg-rose-600 w-6 h-6 rounded-full items-center justify-center shadow-lg border-2 border-zinc-950 z-20"
                  >
                    <Ionicons name="trash" size={11} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Top-Left Edit Indicator */}
                  <View className="absolute top-2 left-2 bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/40">
                    <Text className="text-[8px] font-black text-cyan-400">EDIT</Text>
                  </View>
                </>
              ) : (
                <>
                  {arch.prescribedBy ? (
                    <View className="absolute top-2 right-2 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/40">
                      <Text className="text-[8px] font-black text-emerald-400">COACH</Text>
                    </View>
                  ) : arch.isCustom ? (
                    <View className="absolute top-2 right-2 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                      <Text className="text-[8px] font-bold text-cyan-400">CUSTOM</Text>
                    </View>
                  ) : null}
                </>
              )}

              <View className="flex-row items-center space-x-1.5 mb-1.5 pr-8 mt-1">
                <Text className="text-lg">{arch.emoji}</Text>
                <Text className="text-xs font-extrabold text-white flex-1" numberOfLines={1}>
                  {arch.name}
                </Text>
              </View>

              <View className="flex-row items-baseline justify-between mt-0.5 mb-1.5">
                <Text className="text-base font-black text-accent-cyan">{arch.calories}</Text>
                <Text className="text-[10px] font-bold text-zinc-400">kcal</Text>
              </View>

              <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-lg px-2 py-1 flex-row justify-between items-center mb-1">
                <Text className="text-[10px] font-black text-emerald-400">{arch.protein}g P</Text>
                <Text className="text-[10px] font-black text-cyan-300">{arch.carbs}g C</Text>
                <Text className="text-[10px] font-black text-amber-400">{arch.fats}g F</Text>
              </View>

              {arch.instructions ? (
                <Text className="text-[9px] text-zinc-400 italic mt-0.5" numberOfLines={1}>
                  {arch.instructions}
                </Text>
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
              <Text className="text-[10px] text-zinc-500 italic mb-4">
                💡 Leave Calories blank to auto-compute from (Protein × 4) + (Carbs × 4) + (Fats × 9).
              </Text>

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

      {/* IMPORT PLAN MODAL */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <Text className="text-base font-black text-white">Import Prescribed Archetypes</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-3">
              Paste the JSON meal template exported from your coach to add their prescribed staples to your 1-tap list:
            </Text>

            <TextInput
              multiline
              numberOfLines={6}
              value={importJsonText}
              onChangeText={setImportJsonText}
              placeholder='[{"name": "Post-Workout Shake", "emoji": "🥤", "calories": 320, "protein": 45, "carbs": 30, "fats": 2}]'
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-mono text-xs mb-4 max-h-36"
            />

            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={() => setShowImportModal(false)}
                className="flex-1 bg-zinc-800 py-3 rounded-xl items-center"
              >
                <Text className="text-zinc-300 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleImportPlan}
                className="flex-1 bg-accent-cyan py-3 rounded-xl items-center"
              >
                <Text className="text-black font-black text-xs">Import Presets</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
