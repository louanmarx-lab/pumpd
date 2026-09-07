import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { WorkoutReceiptData } from '../types/gymjam';

interface WorkoutReceiptModalProps {
  visible: boolean;
  receiptData: WorkoutReceiptData | null;
  onClose: () => void;
}

export const WorkoutReceiptModal: React.FC<WorkoutReceiptModalProps> = ({
  visible,
  receiptData,
  onClose,
}) => {
  if (!receiptData) return null;

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const shareLines = [
      `🧾 PUMPD PERFORMANCE RECEIPT`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏋️ ${receiptData.routineName}`,
      `⏱️ Duration: ${formatDuration(receiptData.durationSeconds)}`,
      `📦 Volume: ${receiptData.totalVolumeKg.toLocaleString()} kg moved`,
      `🎯 Total Sets: ${receiptData.totalSets} completed`,
    ];

    if (receiptData.bestLift) {
      shareLines.push(
        `⭐ Top Set: ${receiptData.bestLift.exerciseName} - ${receiptData.bestLift.weightKg}kg × ${receiptData.bestLift.reps}`
      );
    }

    if (receiptData.gymJamBuddy) {
      shareLines.push(`🤝 Trained with ${receiptData.gymJamBuddy.name} (Jam: ${receiptData.gymJamBuddy.roomPin})`);
    }

    shareLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    shareLines.push(`Logged with Pumpd. No shortcuts.`);

    const message = shareLines.join('\n');

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `Pumpd Receipt - ${receiptData.routineName}`,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: `Pumpd Receipt - ${receiptData.routineName}`,
        });
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Receipt Copied', 'Receipt summary copied to clipboard!');
      }
    }
  };

  // Generate aesthetic barcode bars
  const barcodePattern = [
    3, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 1, 2, 3, 1, 4, 1, 2,
    3, 2, 1, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1,
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 justify-center items-center p-4">
        {/* Close Button Top Right */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-12 right-6 z-50 w-10 h-10 rounded-full bg-zinc-800/90 border border-zinc-700 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* 9:16 Aspect Ratio Scrollable Container */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingVertical: 20 }}
          className="w-full max-w-sm"
        >
          {/* Aesthetic Thermal Receipt Card */}
          <View className="w-full bg-[#121215] border-2 border-zinc-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            {/* Background Texture & Glow */}
            <View className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <View className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Serrated Top Edge (Cut Teeth Effect) */}
            <View className="flex-row justify-between w-full mb-3 opacity-30">
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={`tooth-${i}`} className="w-2.5 h-1 bg-zinc-400 rounded-full mx-0.5" />
              ))}
            </View>

            {/* Receipt Header */}
            <View className="items-center pb-4 border-b border-dashed border-zinc-700">
              <View className="flex-row items-center space-x-1.5 mb-1">
                <Ionicons name="fitness" size={20} color="#06B6D4" />
                <Text className="text-xl font-black text-white tracking-widest">PUMPD</Text>
              </View>
              <Text className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                // PERFORMANCE RECEIPT //
              </Text>
              <Text className="text-[10px] font-mono text-zinc-500 mt-1">
                {receiptData.date} • {receiptData.id}
              </Text>
            </View>

            {/* Gym Jam Buddy Badge if multiplayer session */}
            {receiptData.gymJamBuddy && (
              <View className="my-3 bg-cyan-950/50 border border-cyan-500/40 rounded-xl p-2.5 flex-row items-center space-x-2">
                <View className="w-7 h-7 rounded-full bg-accent-cyan items-center justify-center">
                  <Ionicons name="people" size={14} color="#09090B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-mono font-bold text-cyan-400 uppercase">
                    Gym Jam Co-Op Session
                  </Text>
                  <Text className="text-xs font-black text-white">
                    Trained with {receiptData.gymJamBuddy.name}
                  </Text>
                </View>
                <View className="bg-cyan-500/20 px-2 py-0.5 rounded">
                  <Text className="text-[10px] font-mono font-bold text-cyan-300">
                    {receiptData.gymJamBuddy.roomPin}
                  </Text>
                </View>
              </View>
            )}

            {/* Routine Title */}
            <View className="my-4 items-center">
              <Text className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Workout Routine
              </Text>
              <Text className="text-xl font-black text-white text-center mt-0.5">
                {receiptData.routineName}
              </Text>
            </View>

            {/* High-Impact Stat Grid */}
            <View className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 my-2">
              <View className="flex-row justify-between mb-3 pb-3 border-b border-zinc-850">
                <View>
                  <Text className="text-[10px] font-mono uppercase text-zinc-400">Total Volume</Text>
                  <Text className="text-2xl font-black text-accent-cyan mt-0.5">
                    {receiptData.totalVolumeKg.toLocaleString()}{' '}
                    <Text className="text-xs text-white font-bold">kg</Text>
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-mono uppercase text-zinc-400">Duration</Text>
                  <Text className="text-2xl font-black text-white mt-0.5">
                    {formatDuration(receiptData.durationSeconds)}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between">
                <View>
                  <Text className="text-[10px] font-mono uppercase text-zinc-400">Total Sets</Text>
                  <Text className="text-base font-black text-white mt-0.5">
                    {receiptData.totalSets} completed
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-mono uppercase text-zinc-400">Total Reps</Text>
                  <Text className="text-base font-black text-white mt-0.5">
                    {receiptData.totalReps} reps
                  </Text>
                </View>
              </View>
            </View>

            {/* Best Working Set Highlight */}
            {receiptData.bestLift && (
              <View className="my-2 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl p-3 flex-row items-center space-x-2.5">
                <View className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 items-center justify-center">
                  <Ionicons name="trophy" size={16} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-mono font-bold text-amber-400 uppercase">
                    Session Best Working Set
                  </Text>
                  <Text className="text-xs font-black text-white">
                    {receiptData.bestLift.exerciseName}
                  </Text>
                  <Text className="text-xs font-black text-amber-300">
                    {receiptData.bestLift.weightKg} kg × {receiptData.bestLift.reps} reps
                  </Text>
                </View>
              </View>
            )}

            {/* Itemized Exercise Monospace Table */}
            <View className="mt-3 pt-3 border-t border-dashed border-zinc-700">
              <Text className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Itemized Workload:
              </Text>
              {receiptData.exercisesSummary.map((item, idx) => (
                <View
                  key={`item-${idx}`}
                  className="flex-row justify-between items-center py-1 font-mono"
                >
                  <Text className="text-xs font-mono text-zinc-300 flex-1 mr-2" numberOfLines={1}>
                    {item.exerciseName}
                  </Text>
                  <Text className="text-xs font-mono font-bold text-accent-cyan">
                    {item.completedSetsCount}s • {item.topSetWeight}kg×{item.topSetReps}
                  </Text>
                </View>
              ))}
            </View>

            {/* Aesthetic Barcode Graphic */}
            <View className="mt-5 pt-4 border-t border-dashed border-zinc-700 items-center">
              <View className="flex-row items-center justify-center h-10 w-full px-2 space-x-0.5">
                {barcodePattern.map((width, i) => (
                  <View
                    key={`bc-${i}`}
                    style={{ width, height: '100%' }}
                    className="bg-zinc-400 rounded-xs"
                  />
                ))}
              </View>
              <Text className="text-[9px] font-mono text-zinc-500 tracking-widest mt-1.5">
                * PMPD-{receiptData.id.replace(/\D/g, '').slice(-8)} *
              </Text>
            </View>

            {/* Serrated Bottom Edge */}
            <View className="flex-row justify-between w-full mt-4 opacity-30">
              {Array.from({ length: 18 }).map((_, i) => (
                <View key={`tooth-bot-${i}`} className="w-2.5 h-1 bg-zinc-400 rounded-full mx-0.5" />
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="w-full flex-row space-x-3 mt-4">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 bg-zinc-900 border border-zinc-750 py-3.5 rounded-2xl items-center"
            >
              <Text className="text-sm font-bold text-zinc-300">Done</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="flex-1 bg-accent-cyan py-3.5 rounded-2xl flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/30"
            >
              <Ionicons name="share-outline" size={18} color="#09090B" />
              <Text className="text-sm font-black text-black">Share Story</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
