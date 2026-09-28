import React, { useState } from 'react';
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
import { useUserWorkspace } from '../context/UserWorkspaceContext';
import { shareRoutineCloud } from '../services/shareSplitService';
import { ShareWorkoutModal } from './workouts/ShareWorkoutModal';
import { Routine } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const { activeUser, splits, exercises } = useUserWorkspace();
  const [showShareRoutineModal, setShowShareRoutineModal] = useState(false);
  const [routineShareCode, setRoutineShareCode] = useState<string | null>(null);
  const [isGeneratingRoutineShare, setIsGeneratingRoutineShare] = useState(false);

  if (!receiptData) return null;

  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const unit = activeUser.weightUnit || 'kg';

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const shareLines = [
      `🧾 RIPPED PERFORMANCE RECEIPT`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ...(receiptData.athleteName ? [`👤 Athlete: ${receiptData.athleteName}`] : []),
      `🏋️ ${receiptData.routineName}`,
      `⏱️ Duration: ${formatDuration(receiptData.durationSeconds)}`,
      `📦 Volume: ${receiptData.totalVolumeKg.toLocaleString()} ${unit} moved`,
      `🎯 Total Sets: ${receiptData.totalSets} completed`,
    ];

    if (receiptData.bestLift) {
      shareLines.push(
        `⭐ Top Set: ${receiptData.bestLift.exerciseName} - ${receiptData.bestLift.weightKg}${unit} × ${receiptData.bestLift.reps}`
      );
    }

    if (receiptData.gymJamBuddy) {
      shareLines.push(`🤝 Trained with ${receiptData.gymJamBuddy.name} (RIPPED BUDDY: ${receiptData.gymJamBuddy.roomPin})`);
    }

    if (receiptData.coachAttribution) {
      shareLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      shareLines.push(
        `🛡️ Coached by: ${receiptData.coachAttribution.name}${
          receiptData.coachAttribution.businessName
            ? ` (${receiptData.coachAttribution.businessName})`
            : ''
        }`
      );
      if (receiptData.coachAttribution.instagramHandle) {
        shareLines.push(`📸 Referral: ${receiptData.coachAttribution.instagramHandle}`);
      }
    }

    shareLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    shareLines.push(`Logged with RIPPED. No shortcuts.`);

    const message = shareLines.join('\n');

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `RIPPED Receipt - ${receiptData.routineName}`,
          text: message,
        });
      } else {
        await Share.share({
          message,
          title: `RIPPED Receipt - ${receiptData.routineName}`,
        });
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Receipt Copied', 'Receipt summary copied to clipboard!');
      }
    }
  };

  const handleShareRoutineFromReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGeneratingRoutineShare(true);
    setRoutineShareCode(null);
    setShowShareRoutineModal(true);

    let matchedRoutine: Routine | null = null;
    let parentSplitName = 'Workout Routine';

    for (const s of splits) {
      const found = s.routines.find(
        (r) => r.name.toLowerCase() === receiptData.routineName.toLowerCase()
      );
      if (found) {
        matchedRoutine = found;
        parentSplitName = s.name;
        break;
      }
    }

    if (!matchedRoutine) {
      const exerciseIds = receiptData.exercisesSummary
        .map(
          (es) =>
            exercises.find(
              (e) => e.name.toLowerCase() === es.exerciseName.toLowerCase()
            )?.id
        )
        .filter((id): id is string => Boolean(id));

      matchedRoutine = {
        id: `rt_receipt_${Date.now()}`,
        name: receiptData.routineName,
        exerciseIds,
      };
    }

    try {
      const code = await shareRoutineCloud(
        matchedRoutine,
        parentSplitName,
        exercises,
        activeUser.displayName,
        activeUser.id
      );
      setRoutineShareCode(code);
      setIsGeneratingRoutineShare(false);
    } catch (err) {
      console.warn('Failed to share routine from receipt:', err);
      setIsGeneratingRoutineShare(false);
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
          style={{ top: Math.max(insets.top + 8, 48) }}
          className="absolute right-6 z-50 w-10 h-10 rounded-full bg-zinc-800/90 border border-zinc-700 items-center justify-center shadow-lg"
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
                <Text className="text-xl font-black text-white tracking-widest">RIPPED</Text>
              </View>
              <Text className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
                // PERFORMANCE RECEIPT //
              </Text>
              {receiptData.athleteName ? (
                <Text className="text-xs font-black text-white mt-1">
                  Athlete: {receiptData.athleteName}
                </Text>
              ) : null}
              <Text className="text-[10px] font-mono text-zinc-500 mt-1">
                {receiptData.date} • {receiptData.id}
              </Text>
            </View>

            {/* Coaching Attribution Badge */}
            {receiptData.coachAttribution && (
              <View className="my-3 bg-zinc-900 border border-cyan-500/40 rounded-2xl p-3 shadow-md">
                <View className="flex-row items-center space-x-2.5">
                  <View className="w-8 h-8 rounded-xl bg-accent-cyan items-center justify-center">
                    <Ionicons name="shield-checkmark" size={16} color="#09090B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[8px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                      // COACHING ATTRIBUTION //
                    </Text>
                    <Text className="text-xs font-black text-white" numberOfLines={1}>
                      Coached by {receiptData.coachAttribution.name}
                    </Text>
                    {receiptData.coachAttribution.businessName ? (
                      <Text className="text-[10px] text-zinc-400 font-medium" numberOfLines={1}>
                        {receiptData.coachAttribution.businessName}
                      </Text>
                    ) : null}
                  </View>
                  {receiptData.coachAttribution.instagramHandle ? (
                    <View className="bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
                      <Text className="text-[10px] font-mono font-bold text-cyan-300">
                        {receiptData.coachAttribution.instagramHandle}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Gym Jam Buddy Badge if multiplayer session */}
            {receiptData.gymJamBuddy && (
              <View className="my-3 bg-cyan-950/50 border border-cyan-500/40 rounded-xl p-2.5 flex-row items-center space-x-2">
                <View className="w-7 h-7 rounded-full bg-accent-cyan items-center justify-center">
                  <Ionicons name="people" size={14} color="#09090B" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-mono font-bold text-cyan-400 uppercase">
                    RIPPED BUDDY Co-Op Session
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
                    <Text className="text-xs text-white font-bold">{unit}</Text>
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
                    {receiptData.bestLift.weightKg} {unit} × {receiptData.bestLift.reps} reps
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
                    {item.completedSetsCount}s • {item.topSetWeight}{unit}×{item.topSetReps}
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
          <View className="w-full mt-4 space-y-2">
            <View className="flex-row space-x-3">
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

            <TouchableOpacity
              onPress={handleShareRoutineFromReceipt}
              className="w-full bg-zinc-900/80 border border-cyan-500/40 py-3 rounded-xl flex-row items-center justify-center space-x-2"
            >
              <Ionicons name="share-social-outline" size={15} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-400">Share Routine Code with Friend</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Routine Share Modal from Receipt */}
      <ShareWorkoutModal
        visible={showShareRoutineModal}
        onClose={() => setShowShareRoutineModal(false)}
        shareCode={routineShareCode}
        title={receiptData.routineName}
        type="routine"
        routinesCount={1}
        exercisesCount={receiptData.exercisesSummary.length}
        isGenerating={isGeneratingRoutineShare}
      />
    </Modal>
  );
};
