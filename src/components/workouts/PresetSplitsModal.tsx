import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PRESET_SPLITS, PresetSplitTemplate } from '../../utils/presetSplits';

interface PresetSplitsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPreset: (preset: PresetSplitTemplate) => void;
}

export const PresetSplitsModal: React.FC<PresetSplitsModalProps> = ({
  visible,
  onClose,
  onSelectPreset,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetSplitTemplate>(PRESET_SPLITS[0]);

  const handleApply = (preset: PresetSplitTemplate) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelectPreset(preset);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-dark-bg">
        {/* Header */}
        <View className="px-4 pt-5 pb-3.5 border-b border-zinc-800 flex-row items-center justify-between">
          <View className="flex-row items-center space-x-2">
            <View className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 items-center justify-center">
              <Ionicons name="sparkles" size={16} color="#06B6D4" />
            </View>
            <View>
              <Text className="text-base font-extrabold text-white">Popular Workout Splits</Text>
              <Text className="text-[11px] text-zinc-400">Science-based & legendary bodybuilder splits</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        {/* Preset Selector Tabs */}
        <View className="px-4 pt-3 pb-2 border-b border-zinc-850">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PRESET_SPLITS.map((p) => {
              const isSelected = selectedPreset.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPreset(p);
                  }}
                  className={`mr-2.5 px-3.5 py-2 rounded-xl border flex-row items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <Ionicons
                    name="barbell"
                    size={13}
                    color={isSelected ? '#06B6D4' : '#71717A'}
                  />
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-cyan-300' : 'text-zinc-400'
                    }`}
                  >
                    {p.name.split(' (')[0].split(':')[0].slice(0, 24)}...
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Preset Details */}
        <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
          {/* Main Card */}
          <View className="bg-dark-card border border-zinc-800 p-4 rounded-2xl mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View
                style={{ backgroundColor: `${selectedPreset.badgeColor}20`, borderColor: `${selectedPreset.badgeColor}40` }}
                className="px-2.5 py-1 rounded-full border"
              >
                <Text
                  style={{ color: selectedPreset.badgeColor }}
                  className="text-[10px] font-black uppercase tracking-wider"
                >
                  {selectedPreset.tag}
                </Text>
              </View>
              <View className="bg-zinc-800 px-2 py-0.5 rounded">
                <Text className="text-[10px] font-bold text-zinc-300">
                  {selectedPreset.daysPerWeek} Days / Week
                </Text>
              </View>
            </View>

            <Text className="text-lg font-black text-white mb-1.5 tracking-tight">
              {selectedPreset.name}
            </Text>
            <Text className="text-xs text-zinc-400 leading-5 mb-4">
              {selectedPreset.description}
            </Text>

            {/* Weekly Schedule Flow Preview */}
            <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Weekly Flow:
            </Text>
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              {selectedPreset.schedulePattern.map((step, idx) => {
                const isRest = step.toLowerCase().includes('rest');
                return (
                  <View
                    key={idx}
                    className={`px-2 py-1 rounded-lg border ${
                      isRest
                        ? 'bg-zinc-850/60 border-zinc-800'
                        : 'bg-cyan-500/10 border-cyan-500/30'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        isRest ? 'text-zinc-500' : 'text-cyan-300'
                      }`}
                    >
                      D{idx + 1}: {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Included Routines Breakdown */}
          <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-2.5 px-0.5">
            Included Routines ({selectedPreset.routines.length})
          </Text>

          {selectedPreset.routines.map((routine, rIdx) => (
            <View
              key={rIdx}
              className="bg-dark-card border border-zinc-800 p-3.5 rounded-xl mb-3"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-bold text-white flex-1 mr-2">
                  {routine.name}
                </Text>
                <View className="bg-zinc-800 px-2 py-0.5 rounded">
                  <Text className="text-[10px] font-semibold text-zinc-400">
                    {routine.exerciseNames.length} Exercises
                  </Text>
                </View>
              </View>

              {routine.description && (
                <Text className="text-[11px] text-zinc-500 mb-2.5 italic">
                  {routine.description}
                </Text>
              )}

              {/* Exercise bullets */}
              <View className="space-y-1">
                {routine.exerciseNames.map((exName, exIdx) => (
                  <View key={exIdx} className="flex-row items-center space-x-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <Text className="text-xs text-zinc-300">{exName}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer Apply Button */}
        <View className="p-4 border-t border-zinc-800 bg-dark-card">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleApply(selectedPreset)}
            className="bg-accent-cyan py-3.5 rounded-xl items-center flex-row justify-center space-x-2 shadow-lg shadow-cyan-500/20"
          >
            <Ionicons name="flash" size={18} color="#09090B" />
            <Text className="text-black font-extrabold text-sm tracking-wide">
              Activate This Split
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
