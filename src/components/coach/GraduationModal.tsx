import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace } from '../../context/UserWorkspaceContext';

interface GraduationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GraduationModal: React.FC<GraduationModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    activeUser,
    workoutLogs,
    athleteMembership,
    completeGraduation,
  } = useUserWorkspace();

  if (!visible) return null;

  const userLogs = workoutLogs.filter((l) => l.userId === activeUser.id);
  const totalWorkouts = userLogs.length;

  const totalVolumeKg = userLogs.reduce((total, log) => {
    return (
      total +
      (log.exercises || []).reduce((exTotal, ex) => {
        return (
          exTotal +
          (ex.sets || [])
            .filter((s) => s.isCompleted)
            .reduce((sTotal, s) => sTotal + (s.weightKg || 0) * (s.reps || 0), 0)
        );
      }, 0)
    );
  }, 0);

  const coachName = athleteMembership.coachName || 'your coach';
  const coachBusiness = athleteMembership.coachBusiness;

  const handleSelectPlan = (plan: 'trial' | 'free') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeGraduation(plan);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-black/85 justify-end">
        <View className="bg-dark-card border-t border-cyan-500/40 rounded-t-3xl p-6 max-h-[90%] shadow-2xl">
          {/* Top Graduation Badge */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400 items-center justify-center mb-3 shadow-lg shadow-cyan-500/30">
              <Text className="text-3xl">🎓</Text>
            </View>
            <View className="bg-cyan-500/20 border border-cyan-400/60 px-3 py-1 rounded-full mb-1.5">
              <Text className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
                Milestone Achieved
              </Text>
            </View>
            <Text className="text-2xl font-black text-white text-center tracking-tight">
              You've Graduated!
            </Text>
            <Text className="text-xs text-zinc-400 text-center mt-1 px-4 leading-relaxed">
              Congratulations on completing your dedicated coaching journey with{' '}
              <Text className="text-white font-bold">{coachName}</Text>
              {coachBusiness ? ` (${coachBusiness})` : ''}! You now have the knowledge and discipline to crush your goals.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
            {/* Historical Milestones Card */}
            <View className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4">
              <Text className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-3">
                Your Coaching Track Record:
              </Text>

              <View className="flex-row justify-between items-center">
                <View className="items-center flex-1">
                  <Text className="text-xl font-black text-cyan-400 font-mono">
                    {totalWorkouts}
                  </Text>
                  <Text className="text-[10px] font-semibold text-zinc-400 mt-0.5 uppercase">
                    Workouts
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-zinc-800" />

                <View className="items-center flex-1">
                  <Text className="text-xl font-black text-emerald-400 font-mono">
                    {totalVolumeKg > 1000
                      ? `${(totalVolumeKg / 1000).toFixed(1)}k`
                      : totalVolumeKg}{' '}
                    kg
                  </Text>
                  <Text className="text-[10px] font-semibold text-zinc-400 mt-0.5 uppercase">
                    Volume Moved
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-zinc-800" />

                <View className="items-center flex-1">
                  <Text className="text-xl font-black text-amber-400 font-mono">
                    100%
                  </Text>
                  <Text className="text-[10px] font-semibold text-zinc-400 mt-0.5 uppercase">
                    Data Kept
                  </Text>
                </View>
              </View>
            </View>

            {/* 100% Data Preservation Guarantee */}
            <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center space-x-2 mb-2">
                <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                <Text className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  Lifetime Account Preservation
                </Text>
              </View>
              <View className="space-y-1.5">
                <Text className="text-xs text-zinc-300 leading-snug">
                  ✓ <Text className="font-bold text-white">All past workout logs</Text> and performance receipts stay permanently in your account.
                </Text>
                <Text className="text-xs text-zinc-300 leading-snug">
                  ✓ <Text className="font-bold text-white">All personal records (1RMs)</Text> and strength charts are safely saved.
                </Text>
                <Text className="text-xs text-zinc-300 leading-snug">
                  ✓ <Text className="font-bold text-white">Your custom splits & routines</Text> remain active and ready to train.
                </Text>
                <Text className="text-xs text-zinc-300 leading-snug">
                  ✓ <Text className="font-bold text-white">Macro targets & diet history</Text> are preserved.
                </Text>
              </View>
            </View>

            {/* Graduation Options */}
            <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5 px-1">
              Choose How You Want to Continue Solo:
            </Text>

            {/* Option 1: 7-Day Free Trial of RIPPED Solo Pro */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSelectPlan('trial')}
              className="bg-cyan-950/40 border border-cyan-400 p-4 rounded-2xl mb-3 shadow-md shadow-cyan-500/10 relative overflow-hidden"
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="flash" size={18} color="#06B6D4" />
                  <Text className="text-base font-black text-white">
                    RIPPED Solo Pro (Free Trial)
                  </Text>
                </View>
                <View className="bg-cyan-500 px-2 py-0.5 rounded-full">
                  <Text className="text-[9px] font-black text-black uppercase">
                    7 Days Free
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-zinc-300 leading-relaxed mb-3">
                Continue with full evidence-based features: unlimited custom splits, live RIPPED BUDDY co-op, 1RM analytics, and rolling rotations.
              </Text>
              <View className="bg-accent-cyan py-3 rounded-xl items-center shadow-md">
                <Text className="text-black font-extrabold text-xs tracking-wide">
                  Start 7-Day Free Trial (R59/mo)
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Standard Free Plan */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelectPlan('free')}
              className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-2"
            >
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="barbell-outline" size={16} color="#A1A1AA" />
                  <Text className="text-sm font-bold text-white">Standard Free Plan</Text>
                </View>
                <Text className="text-xs font-bold text-zinc-400">Free Forever</Text>
              </View>
              <Text className="text-[11px] text-zinc-400 leading-snug">
                Log basic workouts and access your history. No credit card required.
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
