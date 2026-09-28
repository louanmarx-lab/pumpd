import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import {
  calculateProteinTargets,
  ProteinTier,
  ProteinTierId,
} from '../../utils/proteinRecommendation';

interface ProteinRecommendationCardProps {
  /** Optional custom styling class */
  className?: string;
  /** Optional callback when a tier is selected */
  onTierSelected?: (tier: ProteinTier) => void;
  /** Whether the card can be collapsed like an accordion */
  collapsible?: boolean;
  /** Initial expansion state if collapsible */
  defaultExpanded?: boolean;
}

export const ProteinRecommendationCard: React.FC<ProteinRecommendationCardProps> = ({
  className,
  onTierSelected,
  collapsible = false,
  defaultExpanded = true,
}) => {
  const { activeUser, bodyMetrics, updateMacroTargets } = useUserWorkspace();
  const [isExpanded, setIsExpanded] = useState(collapsible ? defaultExpanded : true);

  // 1. Reactive calculation: Extract user's latest logged body weight
  const userMetrics = useMemo(() => {
    return bodyMetrics
      .filter(
        (m) =>
          m.userId === activeUser.id &&
          typeof m.weightKg === 'number' &&
          m.weightKg > 0
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyMetrics, activeUser.id]);

  const latestWeightKg =
    userMetrics.length > 0 ? userMetrics[userMetrics.length - 1].weightKg : 75;

  // 2. Compute the 3 evidence-based tiers reactively whenever weightKg updates
  const recommendation = useMemo(() => {
    return calculateProteinTargets(latestWeightKg);
  }, [latestWeightKg]);

  const currentTargets = activeUser.macroTargets || {
    calories: 2500,
    protein: 180,
    carbs: 250,
    fats: 70,
    dailyProteinGoalGrams: 180,
  };

  const activeProteinTarget =
    currentTargets.dailyProteinGoalGrams ?? currentTargets.protein;

  // Local state to track user's active choice if selected during session
  const [selectedTierId, setSelectedTierId] = useState<ProteinTierId | null>(null);

  // Determine which tier is currently active:
  // - If locally selected, respect that
  // - If activeProteinTarget exactly matches a tier, match it
  // - Otherwise default initial selection to 'optimal' (Optimal High Ceiling 2.0 g/kg) as required
  const currentActiveTierId: ProteinTierId = useMemo(() => {
    if (selectedTierId) {
      return selectedTierId;
    }
    const matchingTier = recommendation.tiers.find(
      (t) => t.grams === activeProteinTarget
    );
    if (matchingTier) {
      return matchingTier.id;
    }
    // Default initial selection to Optimal High Ceiling (2.0 g/kg)
    return 'optimal';
  }, [selectedTierId, activeProteinTarget, recommendation.tiers]);

  const handleSelectTier = (tier: ProteinTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTierId(tier.id);

    // Set the user's active daily protein target (dailyProteinGoalGrams) in store
    updateMacroTargets({
      ...currentTargets,
      protein: tier.grams,
      dailyProteinGoalGrams: tier.grams,
    });

    onTierSelected?.(tier);
  };

  const optimalGrams = recommendation.tiers.find((t) => t.id === 'optimal')?.grams ?? 150;

  return (
    <View
      className={`bg-dark-card border border-dark-border rounded-2xl mb-4 shadow-md ${
        isExpanded ? 'p-4' : 'p-3.5'
      } ${className || ''}`}
    >
      {/* Header with Title, Weight, & Optional Collapse Toggle */}
      <TouchableOpacity
        disabled={!collapsible}
        activeOpacity={0.7}
        onPress={() => {
          if (collapsible) {
            Haptics.selectionAsync();
            setIsExpanded(!isExpanded);
          }
        }}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center space-x-2.5 flex-1 mr-2 min-w-0">
          <View className="w-8 h-8 rounded-xl bg-emerald-500/20 items-center justify-center border border-emerald-500/40 shrink-0">
            <Ionicons name="barbell-outline" size={15} color="#10B981" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-white tracking-tight" numberOfLines={1}>
              {isExpanded ? 'Recommended Protein Targets' : 'Recommended Protein'}
            </Text>
            <Text className="text-[11px] text-zinc-400 font-medium" numberOfLines={1}>
              {isExpanded
                ? 'Schoenfeld & Phillips Hypertrophy Range'
                : `Based on ${latestWeightKg} kg • Tap to view guide`}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center space-x-1.5 shrink-0">
          {!isExpanded ? (
            <View className="bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <Text className="text-[10px] font-bold text-emerald-400">
                {optimalGrams}g optimal
              </Text>
            </View>
          ) : (
            <View className="bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700 flex-row items-center space-x-1">
              <Ionicons name="scale-outline" size={12} color="#10B981" />
              <Text className="text-xs font-bold text-zinc-200">
                {latestWeightKg} kg
              </Text>
            </View>
          )}

          {collapsible && (
            <View className="w-7 h-7 rounded-full bg-zinc-800 items-center justify-center border border-zinc-700">
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#A1A1AA"
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <>
          <Text className="text-xs text-zinc-400 mt-3 mb-3 leading-relaxed">
            Muscle protein synthesis (MPS) plateaus between{' '}
            <Text className="text-zinc-200 font-semibold">1.6–2.2 g/kg</Text>.
            Derived dynamically from your latest logged body weight:
          </Text>

      {/* Selectable Tier Cards */}
      <View className="space-y-2.5">
        {recommendation.tiers.map((tier) => {
          const isActive = currentActiveTierId === tier.id;

          return (
            <TouchableOpacity
              key={tier.id}
              activeOpacity={0.85}
              onPress={() => handleSelectTier(tier)}
              className={`p-3.5 rounded-xl border transition-all ${
                isActive
                  ? 'bg-emerald-950/30 border-emerald-500 border-2'
                  : 'bg-zinc-900/70 border-zinc-800'
              }`}
            >
              <View className="flex-row items-start justify-between">
                {/* Left Side: Tier Name, Recommended Badge, and Subtitle */}
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                    <Text
                      className={`text-sm font-bold ${
                        isActive ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {tier.name}
                    </Text>

                    {tier.isRecommended && (
                      <View className="bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        <Text className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider">
                          Optimal
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-[11px] text-zinc-400 leading-snug">
                    {tier.subtitle}
                  </Text>
                </View>

                {/* Right Side: Multiplier Badge & Computed Grams */}
                <View className="items-end">
                  <View
                    className={`px-2 py-0.5 rounded-full border mb-1 ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500/50'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        isActive ? 'text-emerald-300' : 'text-zinc-300'
                      }`}
                    >
                      {tier.multiplierLabel}
                    </Text>
                  </View>

                  <View className="flex-row items-baseline space-x-0.5">
                    <Text
                      className={`text-2xl font-black ${
                        isActive ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {tier.grams}
                    </Text>
                    <Text
                      className={`text-xs font-bold ${
                        isActive ? 'text-emerald-500' : 'text-zinc-500'
                      }`}
                    >
                      g
                    </Text>
                  </View>
                </View>
              </View>

              {/* Active Indicator Strip */}
              {isActive && (
                <View className="flex-row items-center justify-between mt-2.5 pt-2 border-t border-emerald-500/30">
                  <View className="flex-row items-center space-x-1.5">
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text className="text-[11px] font-bold text-emerald-400">
                      Active Daily Target ({tier.grams}g/day)
                    </Text>
                  </View>
                  <Text className="text-[10px] text-emerald-500/80 font-medium">
                    Applied to tracker
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Target sync footer note */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-zinc-800/80">
        <Text className="text-[11px] text-zinc-500">
          Target synced with {activeUser.displayName}’s macro plan
        </Text>
        <Text className="text-[11px] font-bold text-emerald-400">
          {activeProteinTarget}g Protein / day
        </Text>
      </View>
        </>
      )}
    </View>
  );
};
export default ProteinRecommendationCard;
