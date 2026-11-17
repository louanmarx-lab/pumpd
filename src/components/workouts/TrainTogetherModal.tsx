import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSharePhone: () => void;
  onSeparatePhones: () => void;
  onJoin?: () => void;
  canSharePhone?: boolean;
  canSeparatePhones?: boolean;
}

export function TrainTogetherModal({ visible, onClose, onSharePhone, onSeparatePhones, onJoin, canSharePhone = true, canSeparatePhones = true }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 justify-end bg-black/80">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
          <View className="bg-zinc-950 border border-zinc-700 rounded-t-3xl p-5 gap-4">
            <Text accessibilityRole="header" className="text-xl font-bold text-white">Train together</Text>
            <Text className="text-base text-zinc-300">How would you like to log your workout?</Text>
            {canSharePhone && <TouchableOpacity accessibilityRole="button" onPress={onSharePhone} className="border border-cyan-500 rounded-2xl p-4 min-h-[64px]">
              <Text className="text-lg font-bold text-cyan-300">Share this phone</Text>
              <Text className="text-sm text-zinc-300 mt-1">Take turns logging sets. Works offline. Buddy history stays on this phone until you share it.</Text>
            </TouchableOpacity>}
            {canSeparatePhones && <TouchableOpacity accessibilityRole="button" onPress={onSeparatePhones} className="border border-zinc-600 rounded-2xl p-4 min-h-[64px]">
              <Text className="text-lg font-bold text-white">Use separate phones</Text>
              <Text className="text-sm text-zinc-300 mt-1">Start a shared workout and invite your friend. Both phones need an internet connection.</Text>
            </TouchableOpacity>}
            {!canSeparatePhones && <Text className="text-sm text-zinc-300">Your saved workout uses one phone. Finish it before starting a workout on separate phones.</Text>}
            {onJoin && canSeparatePhones && <TouchableOpacity accessibilityRole="button" onPress={onJoin} className="min-h-[48px] justify-center items-center">
              <Text className="text-base font-semibold text-cyan-300">Join an existing workout with PIN or QR</Text>
            </TouchableOpacity>}
            <TouchableOpacity accessibilityRole="button" onPress={onClose} className="min-h-[48px] justify-center items-center">
              <Text className="text-base font-bold text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
