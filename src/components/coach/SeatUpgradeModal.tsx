import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  TrainerSubscriptionTier,
  TIER_CONFIGS,
  TrainerSubscription,
  calculateCustomTierPrice,
} from '../../types/trainer';
import { requestSubscriptionPurchase } from '../../services/inAppPurchaseService';

// Extended selection: includes the athlete plan (R59/mo) for comparison & switching
export type PlanSelection = TrainerSubscriptionTier | 'athlete';

interface SeatUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  currentSubscription: TrainerSubscription;
  activeSeatsUsed: number;
  isCurrentlyAthlete?: boolean; // true when user is currently on an Athlete plan
  onUpgradeSuccess: (tier: TrainerSubscriptionTier, customSeats?: number) => void;
  onRequireDowngradeReconcile: (targetTier: TrainerSubscriptionTier) => void;
  onSwitchToAthlete?: () => void; // called when coach switches to athlete plan
}

export const SeatUpgradeModal: React.FC<SeatUpgradeModalProps> = ({
  visible,
  onClose,
  currentSubscription,
  activeSeatsUsed,
  isCurrentlyAthlete = false,
  onUpgradeSuccess,
  onRequireDowngradeReconcile,
  onSwitchToAthlete,
}) => {
  const [selectedTier, setSelectedTier] = useState<PlanSelection>(
    isCurrentlyAthlete ? 'athlete' : currentSubscription.tier
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [customSeats, setCustomSeats] = useState('50');

  // Sync initial selection whenever modal opens or role changes
  useEffect(() => {
    if (visible) {
      setSelectedTier(isCurrentlyAthlete ? 'athlete' : currentSubscription.tier);
    }
  }, [visible, isCurrentlyAthlete, currentSubscription.tier]);

  const coachTiersList: TrainerSubscriptionTier[] = ['starter', 'standard', 'pro', 'studio'];

  const parsedCustomSeats = Math.max(31, parseInt(customSeats, 10) || 50);
  const customPrice = calculateCustomTierPrice(parsedCustomSeats);

  const getEffectiveSeatLimit = (tier: TrainerSubscriptionTier) => {
    if (tier === 'studio') return parsedCustomSeats;
    return TIER_CONFIGS[tier].seatLimit;
  };

  const getEffectivePrice = (tier: TrainerSubscriptionTier) => {
    if (tier === 'studio') return customPrice;
    return TIER_CONFIGS[tier].priceZar;
  };

  const handleSelectTier = (tier: PlanSelection) => {
    Haptics.selectionAsync();
    setSelectedTier(tier);
  };

  const handleAction = async () => {
    // 1. User selected the Athlete plan
    if (selectedTier === 'athlete') {
      if (isCurrentlyAthlete) {
        onClose();
        return;
      }

      // Coach switching to Athlete plan
      Alert.alert(
        'Switch to Athlete Plan?',
        'You are switching from Coach to the Individual Athlete plan (R59/mo). Your client roster and coach management tools will be hidden. Your client data will be safely stored if you re-upgrade later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch to Athlete (R59/mo)',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSwitchToAthlete?.();
              onClose();
            },
          },
        ]
      );
      return;
    }

    // 2. User selected a Coach plan that is already their current plan
    if (selectedTier === currentSubscription.tier && !isCurrentlyAthlete) {
      onClose();
      return;
    }

    const effectiveSeatLimit = getEffectiveSeatLimit(selectedTier);
    const isDowngrade = !isCurrentlyAthlete && effectiveSeatLimit < currentSubscription.seatLimit;

    // Downgrade check for active seats
    if (isDowngrade && activeSeatsUsed > effectiveSeatLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClose();
      onRequireDowngradeReconcile(selectedTier);
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await requestSubscriptionPurchase(selectedTier);
    setIsProcessing(false);

    if (result.success && result.tier) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpgradeSuccess(result.tier, selectedTier === 'studio' ? parsedCustomSeats : undefined);
      Alert.alert(
        'Subscription Updated! 🚀',
        selectedTier === 'studio'
          ? `Your plan is now Custom with ${parsedCustomSeats} client seats at R${customPrice}/mo.`
          : `Your plan is now ${TIER_CONFIGS[selectedTier].name} with up to ${getEffectiveSeatLimit(selectedTier)} client seats at R${getEffectivePrice(selectedTier)}/mo.`
      );
      onClose();
    } else if (!result.isCancelled) {
      Alert.alert('Store Transaction Failed', result.error || 'Could not process purchase.');
    }
  };

  const getActionLabel = () => {
    if (selectedTier === 'athlete') {
      return isCurrentlyAthlete ? 'Keep Current Plan' : 'Switch to Athlete Plan (R59/mo)';
    }

    const tierName = TIER_CONFIGS[selectedTier].name;
    const price = selectedTier === 'studio' ? customPrice : TIER_CONFIGS[selectedTier].priceZar;

    if (isCurrentlyAthlete) {
      return `Upgrade to Coach ${tierName} (R${price}/mo)`;
    }

    if (selectedTier === currentSubscription.tier) {
      return 'Keep Current Plan';
    }

    if (selectedTier === 'studio') {
      return `Switch to Custom — R${customPrice}/mo (${parsedCustomSeats} seats)`;
    }

    return `Switch to ${tierName} — R${price}/mo`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[92%] shadow-2xl">

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2 flex-1 min-w-0 mr-2">
              <View className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 items-center justify-center shrink-0">
                <Ionicons name="sparkles" size={17} color="#F59E0B" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  Membership & Coach Plans
                </Text>
                <Text className="text-[11px] text-zinc-400 font-semibold" numberOfLines={1}>
                  Compare tiers • Individual & coach seats
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700 shrink-0"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-3">

            {/* Coach Client Capacity (only shown when user is coach) */}
            {!isCurrentlyAthlete && (
              <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 mb-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    Active Client Capacity
                  </Text>
                  <Text className="text-lg font-black text-white mt-0.5">
                    {activeSeatsUsed} / {currentSubscription.seatLimit}{' '}
                    <Text className="text-xs text-zinc-400 font-medium">Seats Occupied</Text>
                  </Text>
                </View>
                <View
                  className={`px-3 py-1 rounded-full border ${
                    activeSeatsUsed >= currentSubscription.seatLimit
                      ? 'bg-rose-500/20 border-rose-500/50'
                      : 'bg-emerald-500/20 border-emerald-500/50'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-black uppercase ${
                      activeSeatsUsed >= currentSubscription.seatLimit
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeSeatsUsed >= currentSubscription.seatLimit ? 'Capacity Full' : 'Seats Open'}
                  </Text>
                </View>
              </View>
            )}

            <Text className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-2.5 px-1">
              Select Plan (ZAR)
            </Text>

            {/* ── 1. ATHLETE PLAN AT TOP FOR COMPARISON (R59/mo) ── */}
            {(() => {
              const isSelected = selectedTier === 'athlete';
              const isCurrent = isCurrentlyAthlete;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleSelectTier('athlete')}
                  className={`p-4 rounded-2xl border mb-3 relative overflow-hidden ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center space-x-2">
                      <View
                        className={`w-4 h-4 rounded-full border items-center justify-center ${
                          isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </View>
                      <Text className="text-base font-black text-white">Athlete</Text>
                      {isCurrent && (
                        <View className="bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md">
                          <Text className="text-[9px] font-bold text-cyan-300 uppercase">
                            Current
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text className="text-base font-black text-cyan-400">
                      R59
                      <Text className="text-xs text-zinc-400 font-medium">/mo</Text>
                    </Text>
                  </View>

                  <Text className="text-xs text-zinc-400 font-medium mb-2.5 ml-6">
                    Normal lifters • Solo workout tracking & analytics
                  </Text>

                  <View className="ml-6 space-y-1">
                    {[
                      'Unlimited personal workout & set logging',
                      'Custom split & routine builder',
                      '1RM progression & progressive overload analytics',
                      'Macro targets & daily nutrition tracker',
                    ].map((feat, idx) => (
                      <View key={`ath-${idx}`} className="flex-row items-center space-x-1.5">
                        <Ionicons name="checkmark" size={12} color="#06B6D4" />
                        <Text className="text-[11px] text-zinc-300">{feat}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Section Divider */}
            <View className="flex-row items-center space-x-2 my-2 px-1">
              <View className="flex-1 h-px bg-zinc-800" />
              <Text className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">
                Personal Trainer Plans (Client Seats)
              </Text>
              <View className="flex-1 h-px bg-zinc-800" />
            </View>

            {/* ── 2. COACH TIERS ── */}
            {coachTiersList.map((tierKey) => {
              const config = TIER_CONFIGS[tierKey];
              const isCurrent = !isCurrentlyAthlete && currentSubscription.tier === tierKey;
              const isSelected = selectedTier === tierKey;
              const isCustom = tierKey === 'studio';
              const displayPrice = isCustom ? customPrice : config.priceZar;
              const displaySeats = isCustom ? parsedCustomSeats : config.seatLimit;

              return (
                <TouchableOpacity
                  key={tierKey}
                  activeOpacity={0.85}
                  onPress={() => handleSelectTier(tierKey)}
                  className={`p-4 rounded-2xl border mb-3 relative overflow-hidden ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-950 border-zinc-800'
                  }`}
                >
                  {config.popular && (
                    <View className="absolute top-0 right-0 bg-amber-400 px-3 py-0.5 rounded-bl-xl">
                      <Text className="text-[9px] font-black text-black uppercase tracking-wider">
                        MOST POPULAR
                      </Text>
                    </View>
                  )}

                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center space-x-2">
                      <View
                        className={`w-4 h-4 rounded-full border items-center justify-center ${
                          isSelected ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
                        }`}
                      >
                        {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </View>
                      <Text className="text-base font-black text-white">{config.name}</Text>
                      {isCurrent && (
                        <View className="bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md">
                          <Text className="text-[9px] font-bold text-cyan-300 uppercase">
                            Current
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text className="text-base font-black text-amber-400">
                      R{displayPrice}
                      <Text className="text-xs text-zinc-400 font-medium">/mo</Text>
                    </Text>
                  </View>

                  <Text className="text-xs text-zinc-400 font-medium mb-2.5 ml-6">
                    {displaySeats} client seats • {config.subtitle}
                  </Text>

                  {/* Custom seat input (when Custom tier selected) */}
                  {isCustom && isSelected && (
                    <View className="ml-6 mb-3 bg-zinc-900 border border-zinc-700 rounded-xl p-3">
                      <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5">
                        How many seats do you need? (min 31)
                      </Text>
                      <View className="flex-row items-center space-x-3">
                        <TextInput
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white font-bold text-sm"
                          keyboardType="number-pad"
                          value={customSeats}
                          onChangeText={(val) => {
                            const num = parseInt(val, 10);
                            setCustomSeats(val);
                            if (num >= 31) Haptics.selectionAsync();
                          }}
                          placeholder="e.g. 50"
                          placeholderTextColor="#52525B"
                          maxLength={4}
                        />
                        <View className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 items-center">
                          <Text className="text-[10px] text-zinc-400">Total/mo</Text>
                          <Text className="text-base font-black text-amber-400">
                            R{calculateCustomTierPrice(parsedCustomSeats)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-[10px] text-zinc-500 mt-1.5">
                        R699 base + R30 × {Math.max(0, parsedCustomSeats - 30)} extra seats
                      </Text>
                    </View>
                  )}

                  <View className="ml-6 space-y-1">
                    {config.features.map((feat, idx) => (
                      <View key={`feat-${idx}`} className="flex-row items-center space-x-1.5">
                        <Ionicons name="checkmark" size={12} color="#10B981" />
                        <Text className="text-[11px] text-zinc-300">{feat}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Note */}
            <View className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-850 mt-1 mb-3">
              <Text className="text-[10px] text-zinc-400 leading-relaxed text-center">
                🔒 Billed via {Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play'}. Recurring monthly subscription. Cancel anytime in store account settings.
              </Text>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              disabled={isProcessing}
              onPress={handleAction}
              className={`w-full py-3.5 rounded-xl items-center justify-center shadow-lg mb-4 ${
                selectedTier === 'athlete'
                  ? isCurrentlyAthlete
                    ? 'bg-zinc-800 border border-zinc-700'
                    : 'bg-cyan-500 shadow-cyan-500/20'
                  : 'bg-amber-400 shadow-amber-500/20'
              }`}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <Text
                  className={`font-extrabold text-sm ${
                    selectedTier === 'athlete' && isCurrentlyAthlete
                      ? 'text-zinc-400'
                      : 'text-black'
                  }`}
                >
                  {getActionLabel()}
                </Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
