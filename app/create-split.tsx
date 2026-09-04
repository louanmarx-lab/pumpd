import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { Routine } from '../src/types';

export default function CreateSplitScreen() {
  const router = useRouter();
  const { activeUser, exercises, addSplit } = useUserWorkspace();

  const [splitName, setSplitName] = useState('');
  const [routines, setRoutines] = useState<Omit<Routine, 'id'>[]>([
    { name: 'Routine 1 (e.g. Upper)', exerciseIds: ['ex_1', 'ex_5'] },
    { name: 'Routine 2 (e.g. Lower)', exerciseIds: ['ex_8', 'ex_11'] },
  ]);

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
    <ScrollView className="flex-1 bg-dark-bg px-4 py-4" showsVerticalScrollIndicator={false}>
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
        <TouchableOpacity
          onPress={handleAddRoutine}
          className="bg-cyan-500/20 border border-cyan-500 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-xs font-bold text-cyan-400">+ Add Routine</Text>
        </TouchableOpacity>
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

          <Text className="text-xs text-zinc-400 mb-2">Select Included Exercises:</Text>
          <View className="flex-row flex-wrap">
            {exercises.map((ex) => {
              const isSelected = r.exerciseIds.includes(ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleToggleExerciseInRoutine(rIdx, ex.id)}
                  className={`px-3 py-1.5 rounded-lg mr-2 mb-2 border ${
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
    </ScrollView>
  );
}
