import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { calculateBarbellPlates } from '../utils/plateCalculator';
import { BarbellPlateVisualizer } from './BarbellPlateVisualizer';

interface PlateCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  initialWeight?: number;
  onApplyWeight?: (weight: number) => void;
  lifterName?: string;
}

export const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({
  visible,
  onClose,
  initialWeight = 60,
  onApplyWeight,
  lifterName,
}) => {
  const [barWeight, setBarWeight] = useState<15 | 20>(20);
  const [weightInput, setWeightInput] = useState<string>(
    initialWeight ? initialWeight.toString() : '60'
  );

  useEffect(() => {
    if (visible && initialWeight) {
      setWeightInput(initialWeight.toString());
    }
  }, [visible, initialWeight]);

  const numericWeight = parseFloat(weightInput) || barWeight;

  const calculation = useMemo(() => {
    return calculateBarbellPlates(numericWeight, barWeight);
  }, [numericWeight, barWeight]);

  const handleAdjustWeight = (delta: number) => {
    Haptics.selectionAsync();
    const current = parseFloat(weightInput) || barWeight;
    const next = Math.max(barWeight, Math.round((current + delta) * 100) / 100);
    setWeightInput(next.toString());
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onApplyWeight) {
      onApplyWeight(calculation.totalCalculatedWeight);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/85 justify-end"
      >
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[90%] shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 items-center justify-center">
                <Ionicons name="barbell-outline" size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-lg font-black text-white">Plate Calculator</Text>
                {lifterName && (
                  <Text className="text-[11px] font-semibold text-accent-cyan">
                    Lifting as: {lifterName}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mt-3">
            {/* Barbell Weight Toggle */}
            <View className="flex-row items-center justify-between bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl mb-3.5">
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setBarWeight(20);
                }}
                className={`flex-1 py-2 rounded-lg items-center ${
                  barWeight === 20 ? 'bg-accent-cyan' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    barWeight === 20 ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  20 kg Standard Bar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setBarWeight(15);
                }}
                className={`flex-1 py-2 rounded-lg items-center ${
                  barWeight === 15 ? 'bg-accent-cyan' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    barWeight === 15 ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  15 kg Technique Bar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Target Weight Input & Steppers */}
            <View className="bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl mb-3">
              <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                Target Lift Weight (kg)
              </Text>

              <View className="flex-row items-center justify-between">
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor="#52525B"
                  className="bg-black border border-zinc-700 rounded-xl px-4 py-2.5 text-2xl font-black text-white w-36 text-center"
                />

                {/* Quick adjustments */}
                <View className="flex-row flex-wrap gap-1.5 justify-end flex-1 ml-3">
                  {[-10, -2.5, 2.5, 10].map((step) => (
                    <TouchableOpacity
                      key={step}
                      onPress={() => handleAdjustWeight(step)}
                      className="bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg"
                    >
                      <Text className="text-xs font-extrabold text-zinc-300">
                        {step > 0 ? `+${step}` : step}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Extended stepping buttons */}
              <View className="flex-row justify-between mt-2.5 pt-2 border-t border-zinc-850">
                {[-20, -5, 5, 20].map((step) => (
                  <TouchableOpacity
                    key={`ext-${step}`}
                    onPress={() => handleAdjustWeight(step)}
                    className="bg-zinc-850 border border-zinc-800 px-3 py-1 rounded-md"
                  >
                    <Text className="text-[11px] font-bold text-zinc-400">
                      {step > 0 ? `+${step}kg` : `${step}kg`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Visual Barbell Visualizer */}
            <BarbellPlateVisualizer calculation={calculation} maxVisualHeight={120} />

            {/* Action Buttons */}
            <View className="flex-row items-center space-x-3 mt-4 mb-2">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-3.5 rounded-xl items-center"
              >
                <Text className="text-sm font-bold text-zinc-300">Cancel</Text>
              </TouchableOpacity>

              {onApplyWeight && (
                <TouchableOpacity
                  onPress={handleApply}
                  className="flex-1 bg-accent-cyan py-3.5 rounded-xl items-center shadow-lg shadow-cyan-500/20"
                >
                  <Text className="text-sm font-black text-black">
                    Apply {calculation.totalCalculatedWeight} kg
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
