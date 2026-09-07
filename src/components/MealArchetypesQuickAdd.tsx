import React, { useState, useEffect } from 'react';
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

export { DEFAULT_ARCHETYPES };

const STORAGE_KEY = '@pumpd_custom_meal_archetypes';

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
  const [customArchetypes, setCustomArchetypes] = useState<MealArchetype[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for new archetype
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🥗');
  const [newCalories, setNewCalories] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newCarbs, setNewCarbs] = useState('');
  const [newFats, setNewFats] = useState('');

  // Load custom archetypes from AsyncStorage
  useEffect(() => {
    const loadArchetypes = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setCustomArchetypes(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to load custom meal archetypes:', err);
      }
    };
    loadArchetypes();
  }, []);

  const saveCustomArchetypes = async (list: MealArchetype[]) => {
    setCustomArchetypes(list);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save custom meal archetypes:', err);
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

  const handleCreateCustom = () => {
    if (!newName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for your meal archetype.');
      return;
    }

    const cals = parseInt(newCalories, 10) || 0;
    const p = parseFloat(newProtein) || 0;
    const c = parseFloat(newCarbs) || 0;
    const f = parseFloat(newFats) || 0;

    // Auto-calculate calories if left blank
    const calculatedCals = cals > 0 ? cals : Math.round(p * 4 + c * 4 + f * 9);

    const created: MealArchetype = {
      id: `arch_custom_${Date.now()}`,
      name: newName.trim(),
      emoji: newEmoji.trim() || '🍱',
      calories: calculatedCals,
      protein: p,
      carbs: c,
      fats: f,
      isCustom: true,
    };

    const updated = [...customArchetypes, created];
    saveCustomArchetypes(updated);

    // Reset and close
    setNewName('');
    setNewCalories('');
    setNewProtein('');
    setNewCarbs('');
    setNewFats('');
    setShowCreateModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteCustom = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Archetype', `Remove "${name}" from your quick-log templates?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updated = customArchetypes.filter((a) => a.id !== id);
          saveCustomArchetypes(updated);
        },
      },
    ]);
  };

  const allArchetypes = [...DEFAULT_ARCHETYPES, ...customArchetypes];

  return (
    <View className="mb-4">
      {/* Section Header */}
      <View className="flex-row items-center justify-between px-1 mb-2">
        <View className="flex-row items-center space-x-1.5">
          <Ionicons name="flash-outline" size={15} color="#06B6D4" />
          <Text className="text-xs font-black text-cyan-400 uppercase tracking-wider">
            Quick-Add Meal Archetypes
          </Text>
        </View>
        <Text className="text-[10px] text-zinc-500 font-semibold">1-Tap Log</Text>
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 2 }}
      >
        {allArchetypes.map((arch) => (
          <TouchableOpacity
            key={arch.id}
            activeOpacity={0.8}
            onPress={() => handleQuickLog(arch)}
            onLongPress={() => {
              if (arch.isCustom) {
                handleDeleteCustom(arch.id, arch.name);
              }
            }}
            className="bg-dark-card border border-dark-border mr-2.5 p-3 rounded-2xl w-40 justify-between shadow-sm relative"
          >
            {arch.isCustom && (
              <View className="absolute top-2 right-2 bg-cyan-500/15 px-1.5 py-0.5 rounded">
                <Text className="text-[8px] font-bold text-cyan-400">CUSTOM</Text>
              </View>
            )}

            <View className="flex-row items-center space-x-1.5 mb-1.5">
              <Text className="text-lg">{arch.emoji}</Text>
              <Text className="text-xs font-extrabold text-white flex-1" numberOfLines={1}>
                {arch.name}
              </Text>
            </View>

            <View className="flex-row items-baseline justify-between mt-1 mb-1.5">
              <Text className="text-base font-black text-accent-cyan">{arch.calories}</Text>
              <Text className="text-[10px] font-bold text-zinc-400">kcal</Text>
            </View>

            <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-lg px-2 py-1 flex-row justify-between items-center">
              <Text className="text-[10px] font-black text-emerald-400">{arch.protein}g P</Text>
              <Text className="text-[10px] font-black text-amber-400">{arch.carbs}g C</Text>
              <Text className="text-[10px] font-black text-rose-400">{arch.fats}g F</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Add Custom Archetype Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreateModal(true);
          }}
          className="bg-zinc-900/80 border border-dashed border-zinc-700 mr-2 p-3 rounded-2xl w-28 items-center justify-center"
        >
          <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center mb-1">
            <Ionicons name="add" size={18} color="#06B6D4" />
          </View>
          <Text className="text-xs font-bold text-zinc-300 text-center">New Preset</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* CREATE CUSTOM ARCHETYPE MODAL */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/85 justify-end"
        >
          <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[85%] shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
              <View className="flex-row items-center space-x-2">
                <Text className="text-xl">✨</Text>
                <Text className="text-lg font-black text-white">Create Meal Archetype</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700"
              >
                <Ionicons name="close" size={18} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-3" showsVerticalScrollIndicator={false}>
              {/* Preset Emoji Picker */}
              <Text className="text-zinc-400 text-xs font-bold uppercase mb-1.5">Choose Icon</Text>
              <View className="flex-row gap-2 mb-3">
                {['🥗', '🥩', '🥑', '🥪', '🍜', '🍣', '🥞', '🥤'].map((em) => (
                  <TouchableOpacity
                    key={em}
                    onPress={() => setNewEmoji(em)}
                    className={`w-10 h-10 rounded-xl items-center justify-center border ${
                      newEmoji === em ? 'bg-cyan-500/20 border-cyan-400' : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text className="text-xl">{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Archetype Name */}
              <Text className="text-zinc-400 text-xs font-bold uppercase mb-1.5">Template Name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Greek Yogurt & Berries"
                placeholderTextColor="#52525B"
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white font-medium mb-3"
              />

              {/* Macros Row */}
              <View className="flex-row space-x-2 mb-3">
                <View className="flex-1">
                  <Text className="text-emerald-400 text-[10px] font-bold uppercase mb-1">
                    Protein (g)
                  </Text>
                  <TextInput
                    value={newProtein}
                    onChangeText={setNewProtein}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor="#52525B"
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-white font-black text-center"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-amber-400 text-[10px] font-bold uppercase mb-1">
                    Carbs (g)
                  </Text>
                  <TextInput
                    value={newCarbs}
                    onChangeText={setNewCarbs}
                    keyboardType="numeric"
                    placeholder="40"
                    placeholderTextColor="#52525B"
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-white font-black text-center"
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-rose-400 text-[10px] font-bold uppercase mb-1">
                    Fats (g)
                  </Text>
                  <TextInput
                    value={newFats}
                    onChangeText={setNewFats}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor="#52525B"
                    className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-white font-black text-center"
                  />
                </View>
              </View>

              {/* Total Calories (Optional manual override) */}
              <Text className="text-zinc-400 text-xs font-bold uppercase mb-1.5">
                Total Calories (Optional override)
              </Text>
              <TextInput
                value={newCalories}
                onChangeText={setNewCalories}
                keyboardType="numeric"
                placeholder="Auto-calculated from macros if left blank"
                placeholderTextColor="#52525B"
                className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white font-medium mb-4"
              />

              {/* Buttons */}
              <View className="flex-row space-x-3 mb-2">
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 py-3.5 rounded-xl items-center"
                >
                  <Text className="text-sm font-bold text-zinc-300">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreateCustom}
                  className="flex-1 bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/20"
                >
                  <Text className="text-sm font-black text-black">Save Archetype</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};
