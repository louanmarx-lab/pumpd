import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  TrainerSubscriptionTier,
  TIER_CONFIGS,
  ClientProfile,
} from '../../types/trainer';

interface DowngradeReconcileModalProps {
  visible: boolean;
  onClose: () => void;
  targetTier: TrainerSubscriptionTier | null;
  activeClients: ClientProfile[];
  onConfirmReconcile: (newTier: TrainerSubscriptionTier, activeClientIds: string[]) => void;
}

export const DowngradeReconcileModal: React.FC<DowngradeReconcileModalProps> = ({
  visible,
  onClose,
  targetTier,
  activeClients,
  onConfirmReconcile,
}) => {
  if (!targetTier) return null;

  const targetConfig = TIER_CONFIGS[targetTier];
  const maxSeats = targetConfig.seatLimit;

  // Pre-select the first `maxSeats` clients by default
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSelectedIds(activeClients.slice(0, maxSeats).map((c) => c.id));
    }
  }, [visible, maxSeats, activeClients]);

  const toggleClient = (id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      } else {
        if (prev.length >= maxSeats) {
          Alert.alert(
            'Seat Limit Reached',
            `You can only select up to ${maxSeats} active clients for the ${targetConfig.name}. Unselect another client first.`
          );
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleConfirm = () => {
    if (selectedIds.length > maxSeats) {
      Alert.alert('Too Many Selected', `Please select at most ${maxSeats} clients.`);
      return;
    }

    const unselectedCount = activeClients.length - selectedIds.length;

    Alert.alert(
      'Confirm Tier Downgrade',
      `You are switching to ${targetConfig.name}. ${selectedIds.length} clients will remain active and ${unselectedCount} will be archived.\n\nAll workout logs, past benchmarks, and notes for archived clients remain 100% preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Switch',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onConfirmReconcile(targetTier, selectedIds);
            onClose();
          },
        },
      ]
    );
  };

  const unselectedClients = activeClients.filter((c) => !selectedIds.includes(c.id));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[92%] shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-1 min-w-0 mr-2">
              <View className="flex-row items-center space-x-2">
                <View className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 items-center justify-center shrink-0">
                  <Ionicons name="git-branch" size={17} color="#F59E0B" />
                </View>
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  Select Active Clients
                </Text>
              </View>
              <Text className="text-xs text-zinc-400 font-medium mt-1">
                Downgrading to {targetConfig.name} ({maxSeats} seats)
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700 shrink-0"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-3">
            {/* Info Box */}
            <View className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-4">
              <View className="flex-row items-center space-x-2 mb-1">
                <Ionicons name="information-circle" size={18} color="#F59E0B" />
                <Text className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  Seat Allocation Required
                </Text>
              </View>
              <Text className="text-xs text-zinc-300 leading-relaxed">
                You currently have <Text className="font-bold text-white">{activeClients.length}</Text> active clients, but {targetConfig.name} allows up to <Text className="font-bold text-white">{maxSeats}</Text> seats. Select which {maxSeats} clients to keep active.
              </Text>
              <Text className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                🛡️ <Text className="font-bold text-zinc-300">Zero Data Loss:</Text> Archived clients keep all workouts, progress, and meal plans intact. You can restore them anytime you upgrade or free a seat.
              </Text>
            </View>

            {/* Selection Counter */}
            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider">
                Active Client Roster
              </Text>
              <View className="bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
                <Text className="text-xs font-black text-cyan-300">
                  {selectedIds.length} / {maxSeats} Selected
                </Text>
              </View>
            </View>

            {/* Client Selectable List */}
            {activeClients.map((client) => {
              const isSelected = selectedIds.includes(client.id);

              return (
                <TouchableOpacity
                  key={client.id}
                  activeOpacity={0.8}
                  onPress={() => toggleClient(client.id)}
                  className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/60'
                      : 'bg-zinc-950/70 border-zinc-850 opacity-60'
                  }`}
                >
                  <View className="flex-row items-center space-x-3 flex-1 min-w-0 mr-2">
                    <View className="w-10 h-10 rounded-xl bg-zinc-850 border border-zinc-750 items-center justify-center shrink-0">
                      <Text className="text-lg">{client.avatarEmoji}</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-white" numberOfLines={1}>
                        {client.name}
                      </Text>
                      <Text className="text-[11px] text-zinc-400" numberOfLines={1}>
                        {client.type === 'linked' ? '⚡ Synced Account' : '📝 In-Person Shadow'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center space-x-2 shrink-0">
                    <View
                      className={`px-2.5 py-1 rounded-md border ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/40'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-black uppercase ${
                          isSelected ? 'text-emerald-400' : 'text-zinc-400'
                        }`}
                      >
                        {isSelected ? 'Keep Active' : 'Will Archive'}
                      </Text>
                    </View>

                    <View
                      className={`w-6 h-6 rounded-full border items-center justify-center ${
                        isSelected
                          ? 'bg-cyan-400 border-cyan-400'
                          : 'border-zinc-600 bg-transparent'
                      }`}
                    >
                      {isSelected && <Ionicons name="checkmark" size={14} color="#09090B" />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Unselected Summary Warning if applicable */}
            {unselectedClients.length > 0 && (
              <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 my-2">
                <Text className="text-[11px] text-zinc-400">
                  ⚠️ <Text className="text-zinc-200 font-bold">{unselectedClients.length} clients</Text> will be moved to your <Text className="text-cyan-300 font-bold">Archived Roster</Text>: {unselectedClients.map((c) => c.name).join(', ')}.
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View className="mt-4 mb-3 space-y-2">
              <TouchableOpacity
                disabled={selectedIds.length === 0 || selectedIds.length > maxSeats}
                onPress={handleConfirm}
                className={`w-full py-3.5 rounded-xl items-center justify-center shadow-lg ${
                  selectedIds.length > 0 && selectedIds.length <= maxSeats
                    ? 'bg-amber-400 shadow-amber-500/20'
                    : 'bg-zinc-700 opacity-50'
                }`}
              >
                <Text className="text-black font-extrabold text-sm">
                  Apply {targetConfig.name} ({selectedIds.length} Active, {unselectedClients.length} Archived)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                className="w-full py-3 rounded-xl items-center justify-center"
              >
                <Text className="text-zinc-400 font-bold text-xs">Keep Current Plan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
