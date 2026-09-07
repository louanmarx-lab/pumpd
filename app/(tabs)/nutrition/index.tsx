import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { calculateEmpiricalTDEE } from '../../../src/utils/tdee';
import { MealArchetypesQuickAdd } from '../../../src/components/MealArchetypesQuickAdd';

const getFormattedDate = (offsetDays: number = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split('T')[0];
};

const TOTAL_SEGMENTS = 40;
const GAUGE_SIZE = 208;
const GAUGE_RADIUS = 92;
const GAUGE_CENTER = GAUGE_SIZE / 2;

const SEGMENTS = Array.from({ length: TOTAL_SEGMENTS }, (_, i) => {
  const angleDeg = i * (360 / TOTAL_SEGMENTS) - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    i,
    rotation: `${angleDeg + 90}deg`,
    x: GAUGE_CENTER + GAUGE_RADIUS * Math.cos(angleRad) - 2.5,
    y: GAUGE_CENTER + GAUGE_RADIUS * Math.sin(angleRad) - 6,
  };
});

export default function NutritionScreen() {
  const {
    activeUser,
    nutritionLogs,
    bodyMetrics,
    saveNutritionMeal,
    deleteNutritionMeal,
    updateMacroTargets,
  } = useUserWorkspace();

  const [dateOffset, setDateOffset] = useState<number>(0);
  const currentDateStr = getFormattedDate(dateOffset);

  // 4-Week Empirical Maintenance (TDEE) Calculation (scoped to activeUser)
  const tdeeResult = useMemo(() => {
    return calculateEmpiricalTDEE(activeUser.id, nutritionLogs, bodyMetrics);
  }, [activeUser.id, nutritionLogs, bodyMetrics]);

  const handleSetTDEEAsTarget = (newTdee: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMacroTargets({
      ...targets,
      calories: newTdee,
    });
    Alert.alert(
      'Target Updated! 🎯',
      `Daily calorie target for ${activeUser.displayName} updated to your empirical maintenance of ${newTdee} kcal.`
    );
  };

  // Fast Input Modal State
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [mealLabel, setMealLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');

  // Target Editing State
  const [showEditTargetsModal, setShowEditTargetsModal] = useState(false);
  const [targetCaloriesInput, setTargetCaloriesInput] = useState('');
  const [targetProteinInput, setTargetProteinInput] = useState('');
  const [targetCarbsInput, setTargetCarbsInput] = useState('');
  const [targetFatsInput, setTargetFatsInput] = useState('');

  // Find log for active user & selected date
  const activeLog = nutritionLogs.find(
    (l) => l.userId === activeUser.id && l.date === currentDateStr
  );
  const meals = activeLog ? activeLog.meals : [];

  // Aggregated macros
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const targets = activeUser.macroTargets || {
    calories: 2500,
    protein: 180,
    carbs: 250,
    fats: 70,
  };

  const openEditTargets = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTargetCaloriesInput(targets.calories.toString());
    setTargetProteinInput(targets.protein.toString());
    setTargetCarbsInput(targets.carbs.toString());
    setTargetFatsInput(targets.fats.toString());
    setShowEditTargetsModal(true);
  };

  const handleSaveTargets = () => {
    const c = parseInt(targetCaloriesInput, 10) || 2000;
    const p = parseInt(targetProteinInput, 10) || 150;
    const cb = parseInt(targetCarbsInput, 10) || 200;
    const f = parseInt(targetFatsInput, 10) || 60;

    if (c <= 0 && p <= 0 && cb <= 0 && f <= 0) {
      Alert.alert('Invalid Targets', 'Please enter valid target values.');
      return;
    }

    updateMacroTargets({ calories: c, protein: p, carbs: cb, fats: f });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditTargetsModal(false);
  };

  const handleSaveMeal = () => {
    const calNum = parseFloat(calories) || 0;
    const pNum = parseFloat(protein) || 0;
    const cNum = parseFloat(carbs) || 0;
    const fNum = parseFloat(fats) || 0;

    if (calNum <= 0 && pNum <= 0 && cNum <= 0 && fNum <= 0) {
      Alert.alert('Invalid Entry', 'Please enter at least calories or macros.');
      return;
    }

    saveNutritionMeal(currentDateStr, {
      label: mealLabel.trim() || 'Quick Macro Log',
      calories: calNum > 0 ? calNum : Math.round(pNum * 4 + cNum * 4 + fNum * 9),
      protein: pNum,
      carbs: cNum,
      fats: fNum,
      timestamp: Date.now(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMealLabel('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setShowAddMealModal(false);
  };

  const handleDelete = (mealId: string, label: string) => {
    Alert.alert('Delete Logged Meal', `Are you sure you want to remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteNutritionMeal(currentDateStr, mealId);
        },
      },
    ]);
  };

  const handleQuickLogArchetype = (archetypeMeal: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    saveNutritionMeal(currentDateStr, {
      label: archetypeMeal.label,
      calories: archetypeMeal.calories,
      protein: archetypeMeal.protein,
      carbs: archetypeMeal.carbs,
      fats: archetypeMeal.fats,
      timestamp: Date.now(),
    });
  };

  // Helper for progress percentages
  const getPercent = (curr: number, target: number) =>
    Math.min(100, Math.round((curr / Math.max(1, target)) * 100));

  return (
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Date Switcher Header */}
      <View className="flex-row items-center justify-between bg-dark-card border border-dark-border p-3 rounded-2xl mb-4">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDateOffset((prev) => prev - 1);
          }}
          className="p-2 bg-zinc-800 rounded-xl"
        >
          <Ionicons name="chevron-back" size={20} color="#F4F4F5" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-base font-bold text-white">
            {dateOffset === 0
              ? 'Today'
              : dateOffset === -1
              ? 'Yesterday'
              : dateOffset === 1
              ? 'Tomorrow'
              : currentDateStr}
          </Text>
          <Text className="text-[11px] text-zinc-400 font-medium">{currentDateStr}</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDateOffset((prev) => prev + 1);
          }}
          className="p-2 bg-zinc-800 rounded-xl"
        >
          <Ionicons name="chevron-forward" size={20} color="#F4F4F5" />
        </TouchableOpacity>
      </View>

      {/* Main Calories Progress Card */}
      <View className="bg-dark-card border border-dark-border p-5 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs text-zinc-400 font-medium">Active User</Text>
            <Text className="text-lg font-bold text-white">{activeUser.displayName}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openEditTargets}
            className="flex-row items-center space-x-1.5 bg-accent-cyan/20 border border-accent-cyan px-3 py-1.5 rounded-full"
          >
            <Ionicons name="pencil" size={11} color="#06B6D4" />
            <Text className="text-xs font-bold text-accent-cyan">
              {totals.calories} / {targets.calories} kcal
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calculated Empirical Maintenance (TDEE) Card */}
        <View className="bg-zinc-950/90 border border-zinc-800/90 p-3.5 rounded-2xl mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center space-x-2">
              <View className="w-6 h-6 rounded-lg bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
                <Ionicons name="flame" size={13} color="#06B6D4" />
              </View>
              <Text className="text-xs font-bold text-white uppercase tracking-wider">
                Calculated Maintenance
              </Text>
            </View>
            <View
              className={`px-2 py-0.5 rounded-full border ${
                tdeeResult.status === 'ready'
                  ? 'bg-emerald-500/20 border-emerald-500/40'
                  : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              <Text
                className={`text-[9px] font-extrabold uppercase ${
                  tdeeResult.status === 'ready' ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              >
                {tdeeResult.status === 'ready' ? '4-Wk Regression' : 'Calibrating'}
              </Text>
            </View>
          </View>

          {tdeeResult.status === 'calibrating' ? (
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-[11px] font-semibold text-zinc-300">
                  Calibrating ({tdeeResult.daysLogged}/{tdeeResult.requiredDays} days of data)
                </Text>
                <Text className="text-[10px] text-accent-cyan font-bold font-mono">
                  {Math.min(100, Math.round((tdeeResult.daysLogged / tdeeResult.requiredDays) * 100))}%
                </Text>
              </View>
              {/* Progress bar */}
              <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                <View
                  className="h-full bg-accent-cyan rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((tdeeResult.daysLogged / tdeeResult.requiredDays) * 100)
                    )}%`,
                  }}
                />
              </View>
              <Text className="text-[10px] text-zinc-400 leading-tight">
                Requires 14+ days of logged calories & 2 weigh-ins separated by 14+ days for scientific regression.
              </Text>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-1 mr-2">
                  <Text className="text-lg font-black text-accent-cyan">
                    Maintenance: {tdeeResult.tdee} kcal
                  </Text>
                  <View className="flex-row items-center space-x-2 mt-1">
                    <View
                      className={`px-2 py-0.5 rounded ${
                        tdeeResult.slopeKgPerWeek > 0.05
                          ? 'bg-amber-500/20 border border-amber-500/40'
                          : tdeeResult.slopeKgPerWeek < -0.05
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-cyan-500/20 border border-cyan-500/40'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          tdeeResult.slopeKgPerWeek > 0.05
                            ? 'text-amber-400'
                            : tdeeResult.slopeKgPerWeek < -0.05
                            ? 'text-emerald-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        Trending: {tdeeResult.slopeKgPerWeek >= 0 ? '+' : ''}
                        {tdeeResult.slopeKgPerWeek.toFixed(2)} kg/week
                      </Text>
                    </View>
                    <Text className="text-[10px] text-zinc-400 font-medium">
                      avg {tdeeResult.avgCalories} kcal
                    </Text>
                  </View>
                </View>

                {/* Set as Target Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSetTDEEAsTarget(tdeeResult.tdee)}
                  className="bg-accent-cyan px-3.5 py-2.5 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="checkmark-circle-outline" size={15} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs">Set as Target</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Circular Daily Energy Gauge */}
        <View className="items-center justify-center my-2 mb-6">
          {(() => {
            const calRatio = targets.calories > 0 ? totals.calories / targets.calories : 0;
            const activeCount = Math.min(TOTAL_SEGMENTS, Math.round(calRatio * TOTAL_SEGMENTS));
            const isOver = totals.calories > targets.calories;
            const activeColor = isOver ? '#F59E0B' : '#06B6D4';
            const activeGlowColor = isOver ? '#FDE68A' : '#22D3EE';

            return (
              <View
                style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}
                className="relative items-center justify-center"
              >
                {/* Background Track Ring */}
                <View
                  style={{
                    position: 'absolute',
                    width: 184,
                    height: 184,
                    borderRadius: 92,
                    borderWidth: 2,
                    borderColor: '#27272A',
                  }}
                />

                {/* Radial Segmented Progress Ring */}
                {SEGMENTS.map((seg) => {
                  const isActive = seg.i < activeCount;
                  const isHead = seg.i === activeCount - 1 && activeCount > 0;
                  return (
                    <View
                      key={seg.i}
                      style={{
                        position: 'absolute',
                        left: seg.x,
                        top: seg.y,
                        width: 5,
                        height: 12,
                        borderRadius: 2.5,
                        backgroundColor: isActive
                          ? isHead
                            ? activeGlowColor
                            : activeColor
                          : '#27272A',
                        transform: [{ rotate: seg.rotation }],
                        opacity: isActive ? 1 : 0.35,
                        shadowColor: isHead ? activeColor : undefined,
                        shadowOpacity: isHead ? 0.9 : 0,
                        shadowRadius: isHead ? 6 : 0,
                      }}
                    />
                  );
                })}

                {/* Center Content Core - Tap to change targets */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={openEditTargets}
                  style={{ width: 156, height: 156, borderRadius: 78 }}
                  className="bg-zinc-950 border border-zinc-800/80 items-center justify-center px-4 shadow-xl"
                >
                  <View className="flex-row items-center space-x-1 mb-1">
                    <Ionicons name="flame" size={16} color={activeColor} />
                    <Text
                      style={{ color: activeColor }}
                      className="text-[11px] font-bold uppercase tracking-wider"
                    >
                      Daily Energy
                    </Text>
                  </View>
                  <Text className="text-3xl font-extrabold text-white tracking-tight">
                    {totals.calories}
                  </Text>
                  <View className="flex-row items-center space-x-1 mb-2">
                    <Text className="text-xs text-zinc-400 font-medium">
                      / {targets.calories} kcal
                    </Text>
                    <Ionicons name="pencil" size={10} color="#06B6D4" />
                  </View>

                  {/* Remaining / Surpassed Pill */}
                  <View
                    className={`px-2.5 py-0.5 rounded-full border ${
                      !isOver
                        ? 'bg-cyan-950/60 border-cyan-500/40'
                        : 'bg-amber-950/60 border-amber-500/40'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        !isOver ? 'text-cyan-400' : 'text-amber-400'
                      }`}
                    >
                      {!isOver
                        ? `${targets.calories - totals.calories} kcal left`
                        : `${totals.calories - targets.calories} kcal over`}
                    </Text>
                  </View>

                  <Text className="text-[10px] font-semibold text-zinc-500 mt-1">
                    {Math.round(calRatio * 100)}% • Tap to edit
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>

        {/* 3 Macro Progress Bars - Tap to change targets */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={openEditTargets}
          className="flex-row space-x-3"
        >
          {/* Protein */}
          <View className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[11px] text-zinc-400 font-bold">PROTEIN</Text>
              <Ionicons name="pencil-outline" size={11} color="#10B981" />
            </View>
            <Text className="text-base font-bold text-accent-emerald">
              {totals.protein}g
            </Text>
            <Text className="text-[10px] text-zinc-500 mb-2">Target: {targets.protein}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-accent-emerald rounded-full"
                style={{ width: `${getPercent(totals.protein, targets.protein)}%` }}
              />
            </View>
          </View>

          {/* Carbs */}
          <View className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[11px] text-zinc-400 font-bold">CARBS</Text>
              <Ionicons name="pencil-outline" size={11} color="#06B6D4" />
            </View>
            <Text className="text-base font-bold text-accent-cyan">
              {totals.carbs}g
            </Text>
            <Text className="text-[10px] text-zinc-500 mb-2">Target: {targets.carbs}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-accent-cyan rounded-full"
                style={{ width: `${getPercent(totals.carbs, targets.carbs)}%` }}
              />
            </View>
          </View>

          {/* Fats */}
          <View className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[11px] text-zinc-400 font-bold">FATS</Text>
              <Ionicons name="pencil-outline" size={11} color="#F59E0B" />
            </View>
            <Text className="text-base font-bold text-amber-400">
              {totals.fats}g
            </Text>
            <Text className="text-[10px] text-zinc-500 mb-2">Target: {targets.fats}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${getPercent(totals.fats, targets.fats)}%` }}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Change Targets Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openEditTargets}
          className="flex-row items-center justify-center space-x-2 py-2.5 mt-3 bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/50 rounded-xl"
        >
          <Ionicons name="options-outline" size={16} color="#06B6D4" />
          <Text className="text-xs font-bold text-accent-cyan">Edit Daily Macro & Calorie Targets</Text>
        </TouchableOpacity>
      </View>

      {/* Meal Archetypes Quick-Log Carousel */}
      <MealArchetypesQuickAdd onLogMeal={handleQuickLogArchetype} />

      {/* Fast Input Launch Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowAddMealModal(true)}
        className="bg-accent-cyan p-4 rounded-2xl mb-6 flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
      >
        <Ionicons name="add-circle" size={22} color="#09090B" />
        <Text className="text-black font-extrabold text-base">+ Log Meal / Macros</Text>
      </TouchableOpacity>

      {/* Meals Breakdown List */}
      <View className="mb-10">
        <Text className="text-lg font-bold text-white mb-3">{"Today's Meals"}</Text>

        {meals.length === 0 ? (
          <View className="bg-dark-card border border-dark-border p-6 rounded-2xl items-center">
            <Ionicons name="restaurant-outline" size={32} color="#71717A" />
            <Text className="text-sm text-zinc-400 mt-2 font-medium">
              No meals logged for {dateOffset === 0 ? 'today' : currentDateStr}.
            </Text>
          </View>
        ) : (
          meals.map((meal) => (
            <View
              key={meal.id}
              className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-3 flex-row items-center justify-between"
            >
              <View className="flex-1 pr-3">
                <Text className="text-base font-bold text-white mb-1">{meal.label}</Text>
                <Text className="text-xs text-zinc-400">
                  <Text className="text-accent-emerald font-semibold">{meal.protein}g P</Text> •{' '}
                  <Text className="text-accent-cyan font-semibold">{meal.carbs}g C</Text> •{' '}
                  <Text className="text-amber-400 font-semibold">{meal.fats}g F</Text>
                </Text>
              </View>

              <View className="flex-row items-center space-x-3">
                <Text className="text-base font-bold text-accent-orange">{meal.calories} kcal</Text>
                <TouchableOpacity onPress={() => handleDelete(meal.id, meal.label)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Fast Input Modal */}
      <Modal visible={showAddMealModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <Text className="text-lg font-bold text-white">Quick Macro Entry</Text>
              <TouchableOpacity onPress={() => setShowAddMealModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-1">Meal Name (Optional)</Text>
            <TextInput
              value={mealLabel}
              onChangeText={setMealLabel}
              placeholder="e.g. Post-workout Shake"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-medium"
            />

            <View className="flex-row space-x-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs text-zinc-400 mb-1">Calories (kcal)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="500"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-accent-emerald mb-1">Protein (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="40"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
            </View>

            <View className="flex-row space-x-3 mb-6">
              <View className="flex-1">
                <Text className="text-xs text-accent-cyan mb-1">Carbs (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="50"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-amber-400 mb-1">Fats (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={fats}
                  onChangeText={setFats}
                  placeholder="15"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveMeal}
              className="bg-accent-cyan p-4 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Log Meal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Daily Macro Targets Modal */}
      <Modal visible={showEditTargetsModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-2 border-b border-zinc-800 pb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="options" size={20} color="#06B6D4" />
                <Text className="text-lg font-bold text-white">Edit Daily Targets</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditTargetsModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-4">
              Set custom daily nutrition goals for <Text className="text-white font-bold">{activeUser.displayName}</Text>.
            </Text>

            <View className="mb-4">
              <Text className="text-xs text-accent-cyan font-semibold mb-1">Energy Target (kcal)</Text>
              <TextInput
                keyboardType="numeric"
                value={targetCaloriesInput}
                onChangeText={setTargetCaloriesInput}
                placeholder="2500"
                placeholderTextColor="#71717A"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold text-base"
              />
            </View>

            <View className="flex-row space-x-3 mb-6">
              <View className="flex-1">
                <Text className="text-xs text-accent-emerald font-semibold mb-1">Protein (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetProteinInput}
                  onChangeText={setTargetProteinInput}
                  placeholder="180"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-accent-cyan font-semibold mb-1">Carbs (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetCarbsInput}
                  onChangeText={setTargetCarbsInput}
                  placeholder="250"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs text-amber-400 font-semibold mb-1">Fats (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={targetFatsInput}
                  onChangeText={setTargetFatsInput}
                  placeholder="70"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSaveTargets}
              className="bg-accent-cyan p-4 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Save Targets</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
