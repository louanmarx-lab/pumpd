import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { calculateEmpiricalTDEE } from '../../../src/utils/tdee';
import { MealArchetypesQuickAdd } from '../../../src/components/MealArchetypesQuickAdd';
import { ProteinRecommendationCard } from '../../../src/components/ProteinRecommendationCard';
import { Meal } from '../../../src/types';
import {
  formatLocalDate,
  getLocalDate,
  addDaysToLocalDate,
  parseLocalDate,
  isValidDateString,
  getRelativeDateLabel,
  isValidNutritionValue,
} from '../../../src/utils/localDate';

const CALENDAR_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CALENDAR_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    managedClient,
    nutritionLogs,
    bodyMetrics,
    saveNutritionMeal,
    deleteNutritionMeal,
    clearNutritionDay,
    updateMacroTargets,
    saveWaterIntake,
  } = useUserWorkspace();

  // When coach is managing a client, filter data by client IDs (not coach's own ID)
  const effectiveUserId = managedClient
    ? (managedClient.linkedUserId || managedClient.id)
    : activeUser.id;
  // All IDs that might own data for the effective user (client_XXX + linkedUserId)
  const effectiveUserIds = managedClient
    ? [managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[]
    : [activeUser.id];

  const todayStr = getLocalDate(0);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const currentDateStr = selectedDate;

  // Usable Calendar Picker Modal State
  const [datePickerTarget, setDatePickerTarget] = useState<'day' | 'meal' | null>(null);
  const [dateError, setDateError] = useState(false);
  const [calYear, setCalYear] = useState<number>(() => {
    const p = parseLocalDate(todayStr);
    return (p || new Date()).getFullYear();
  });
  const [calMonth, setCalMonth] = useState<number>(() => {
    const p = parseLocalDate(todayStr);
    return p ? p.getMonth() : 0;
  });
  const [jumpDateInput, setJumpDateInput] = useState(todayStr);

  const handlePrevDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate((prev) => addDaysToLocalDate(prev, -1));
  };

  const handleNextDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate((prev) => addDaysToLocalDate(prev, 1));
  };

  const getDateLabel = (dateStr: string) => {
    return getRelativeDateLabel(dateStr);
  };

  const handleCalPrevMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleCalNextMonth = () => {
    Haptics.selectionAsync();
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  // Calendar days grid for displayed month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // Monday as first day of week: (0 Sunday -> 6, 1 Mon -> 0, etc.)
    const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
    const days: ({ dayNumber: number; dateStr: string } | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr });
    }
    return days;
  }, [calYear, calMonth]);

  // Set of dates with logged meals for dot indicators
  const loggedNutritionDates = useMemo(() => {
    const set = new Set<string>();
    nutritionLogs.forEach((log) => {
      if (effectiveUserIds.includes(log.userId) && (log.meals?.length || 0) > 0) {
        set.add(log.date);
      }
    });
    return set;
  }, [nutritionLogs, effectiveUserIds.join(',')]);

  // 4-Week Empirical Maintenance (TDEE) Calculation (scoped to effective user)
  const tdeeResult = useMemo(() => {
    return calculateEmpiricalTDEE(effectiveUserId, nutritionLogs, bodyMetrics);
  }, [effectiveUserId, nutritionLogs, bodyMetrics]);

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
  const [mealError, setMealError] = useState<string | null>(null);
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [mealLabel, setMealLabel] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [mealDate, setMealDate] = useState(todayStr);
  const openDatePicker = (target: 'day' | 'meal') => {
    const value = target === 'meal' ? mealDate : selectedDate;
    const date = parseLocalDate(value) || new Date();
    setCalYear(date.getFullYear());
    setCalMonth(date.getMonth());
    setJumpDateInput(value);
    setDateError(false);
    setDatePickerTarget(target);
  };
  const selectCalendarDate = (value: string) => {
    if (datePickerTarget === 'meal') setMealDate(value);
    else setSelectedDate(value);
    setDatePickerTarget(null);
  };
  const calendarSelection = datePickerTarget === 'meal' ? mealDate : selectedDate;
  const [mealRecipe, setMealRecipe] = useState('');

  // Target Editing State
  const [showEditTargetsModal, setShowEditTargetsModal] = useState(false);
  const [targetCaloriesInput, setTargetCaloriesInput] = useState('');
  const [targetProteinInput, setTargetProteinInput] = useState('');
  const [targetCarbsInput, setTargetCarbsInput] = useState('');
  const [targetFatsInput, setTargetFatsInput] = useState('');
  const [targetWaterInput, setTargetWaterInput] = useState('');

  // Dedicated Hydration Goal Modal & Custom/Exact Water Log States
  const [showEditHydrationGoalModal, setShowEditHydrationGoalModal] = useState(false);
  const [goalWaterInput, setGoalWaterInput] = useState('');
  const [customWaterInput, setCustomWaterInput] = useState('');

  // Find logs for effective user & selected date (merges across shadow ID and linked athlete ID)
  const activeDayLogs = nutritionLogs.filter(
    (l) => effectiveUserIds.includes(l.userId) && l.date === currentDateStr
  );
  const activeLog = activeDayLogs[0] || null;
  const mealMap = new Map<string, Meal>();
  activeDayLogs.forEach((log) => {
    (log.meals || []).forEach((m) => mealMap.set(m.id, m));
  });
  const meals = Array.from(mealMap.values());

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

  // Use client's macro targets when managing a client, otherwise use own targets
  const targets = (managedClient?.macroTargets || (managedClient ? null : activeUser.macroTargets)) || {
    calories: 2500,
    protein: 180,
    carbs: 250,
    fats: 70,
    waterTargetMl: 3000,
  };

  const waterTargetMl = targets.waterTargetMl || 3000;

  const openEditTargets = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTargetCaloriesInput(targets.calories.toString());
    setTargetProteinInput(targets.protein.toString());
    setTargetCarbsInput(targets.carbs.toString());
    setTargetFatsInput(targets.fats.toString());
    setTargetWaterInput(waterTargetMl.toString());
    setShowEditTargetsModal(true);
  };

  // Weight unit
  const weightUnit = activeUser.weightUnit || 'kg';
  const isImperial = weightUnit === 'lbs';

  // Daily Hydration state & actions
  const currentWaterMl = activeDayLogs.reduce((max, l) => Math.max(max, l.waterMl || 0), 0);
  const waterPercent = Math.min(100, Math.round((currentWaterMl / waterTargetMl) * 100));

  const handleAddWater = (deltaMl: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newTotal = Math.max(0, currentWaterMl + deltaMl);
    saveWaterIntake(currentDateStr, newTotal);
  };

  const handleLogExactWater = (amount?: number) => {
    const raw = amount ?? parseFloat(customWaterInput.trim());
    if (!isValidNutritionValue(raw) || raw <= 0) {
      Alert.alert('Enter Amount', 'Please enter a valid positive number in ml to add.');
      return;
    }
    handleAddWater(raw);
    setCustomWaterInput('');
  };

  const handleSaveHydrationGoal = (presetMl?: number) => {
    const chosen = presetMl ?? parseFloat(goalWaterInput.trim());
    if (!isValidNutritionValue(chosen) || chosen < 500) {
      Alert.alert('Invalid Goal', 'Please enter a daily hydration goal of at least 500 ml.');
      return;
    }
    updateMacroTargets({
      ...targets,
      waterTargetMl: chosen,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditHydrationGoalModal(false);
  };

  const handleResetWater = () => {
    if (currentWaterMl === 0) return;
    Alert.alert(
      'Reset Hydration',
      `Reset water intake for ${getDateLabel(selectedDate)} to 0 ml?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            saveWaterIntake(currentDateStr, 0);
          },
        },
      ]
    );
  };

  // User's latest logged body weight for reactive metric updates (uses client IDs if managing)
  const userMetrics = useMemo(() => {
    return bodyMetrics
      .filter(
        (m) =>
          effectiveUserIds.includes(m.userId) &&
          typeof m.weightKg === 'number' &&
          m.weightKg > 0
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyMetrics, effectiveUserIds.join(',')]);

  const latestWeightKg =
    userMetrics.length > 0 ? userMetrics[userMetrics.length - 1].weightKg : 75;

  const handleSaveTargets = () => {
    const c = targetCaloriesInput.trim() ? parseFloat(targetCaloriesInput.trim()) : 2000;
    const p = targetProteinInput.trim() ? parseFloat(targetProteinInput.trim()) : 150;
    const cb = targetCarbsInput.trim() ? parseFloat(targetCarbsInput.trim()) : 200;
    const f = targetFatsInput.trim() ? parseFloat(targetFatsInput.trim()) : 60;
    const w = targetWaterInput.trim() ? parseFloat(targetWaterInput.trim()) : (waterTargetMl || 3000);

    if (
      !isValidNutritionValue(c) ||
      !isValidNutritionValue(p) ||
      !isValidNutritionValue(cb) ||
      !isValidNutritionValue(f) ||
      !isValidNutritionValue(w) ||
      c <= 0 ||
      w <= 0
    ) {
      Alert.alert('Invalid Targets', 'Please enter valid non-negative, finite numbers for all targets.');
      return;
    }

    updateMacroTargets({
      calories: Math.round(c),
      protein: Math.round(p),
      carbs: Math.round(cb),
      fats: Math.round(f),
      dailyProteinGoalGrams: Math.round(p),
      waterTargetMl: Math.max(500, Math.round(w)),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditTargetsModal(false);
  };

  const handleSaveMeal = () => {
    setMealError(null);
    const calRaw = calories.trim();
    const pRaw = protein.trim();
    const cRaw = carbs.trim();
    const fRaw = fats.trim();

    const calNum = calRaw ? Number(calRaw.replace(',', '.')) : 0;
    const pNum = pRaw ? Number(pRaw.replace(',', '.')) : 0;
    const cNum = cRaw ? Number(cRaw.replace(',', '.')) : 0;
    const fNum = fRaw ? Number(fRaw.replace(',', '.')) : 0;

    // Reject negative or non-finite nutrition values
    if (
      !isValidNutritionValue(calNum) ||
      !isValidNutritionValue(pNum) ||
      !isValidNutritionValue(cNum) ||
      !isValidNutritionValue(fNum)
    ) {
      setMealError('Enter a number of zero or more for each nutrition value.');
      return;
    }

    if (calNum <= 0 && pNum <= 0 && cNum <= 0 && fNum <= 0) {
      setMealError('Enter calories or at least one macro greater than zero.');
      return;
    }

    const mealTargetDate = mealDate;

    // Reject impossible dates like 2024-02-30 or month 13
    if (!isValidDateString(mealTargetDate)) {
      setMealError('Choose a valid calendar date.');
      return;
    }

    saveNutritionMeal(mealTargetDate, {
      label: mealLabel.trim() || 'Quick Macro Log',
      calories: calNum > 0 ? calNum : Math.round(pNum * 4 + cNum * 4 + fNum * 9),
      protein: pNum,
      carbs: cNum,
      fats: fNum,
      recipe: mealRecipe.trim() || undefined,
      timestamp: Date.now(),
    });

    setSelectedDate(mealTargetDate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMealLabel('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setMealRecipe('');
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

  const handleClearAllDayMeals = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Clear All Meals?',
      `Are you sure you want to remove all logged meals for ${getDateLabel(selectedDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearNutritionDay(currentDateStr);
          },
        },
      ]
    );
  };

  const handleQuickLogArchetype = (archetypeMeal: {
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    recipe?: string;
  }) => {
    saveNutritionMeal(currentDateStr, {
      label: archetypeMeal.label,
      calories: archetypeMeal.calories,
      protein: archetypeMeal.protein,
      carbs: archetypeMeal.carbs,
      fats: archetypeMeal.fats,
      recipe: archetypeMeal.recipe,
      timestamp: Date.now(),
    });
  };

  // Helper for progress percentages
  const getPercent = (curr: number, target: number) =>
    Math.min(100, Math.round((curr / Math.max(1, target)) * 100));

  return (
    <View className="flex-1 bg-dark-bg">
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
      {/* Date Switcher Header */}
      <View className="flex-row items-center justify-between bg-dark-card border border-dark-border p-3 rounded-2xl mb-4">
        <TouchableOpacity
          onPress={handlePrevDay}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          className="p-2 bg-zinc-800 rounded-xl"
        >
          <Ionicons name="chevron-back" size={20} color="#F4F4F5" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openDatePicker('day')}
          accessibilityRole="button"
          accessibilityLabel={`Selected date ${selectedDate}. Tap to open calendar picker`}
          className="items-center px-4 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800"
        >
          <View className="flex-row items-center space-x-1.5">
            <Ionicons name="calendar-outline" size={14} color="#06B6D4" />
            <Text className="text-base font-bold text-white">
              {getDateLabel(selectedDate)}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#71717A" />
          </View>
          <Text className="text-xs text-zinc-400 font-medium">{selectedDate}</Text>
        </TouchableOpacity>

        <View className="flex-row items-center space-x-1.5">
          {selectedDate !== todayStr && (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedDate(todayStr);
              }}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              className="px-2.5 py-1.5 bg-cyan-500/20 border border-cyan-500/40 rounded-xl"
            >
              <Text className="text-xs font-black text-cyan-400">Today</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNextDay}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            className="p-2 bg-zinc-800 rounded-xl"
          >
            <Ionicons name="chevron-forward" size={20} color="#F4F4F5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Calories Progress Card */}
      <View className="bg-dark-card border border-dark-border p-5 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xs text-zinc-400 font-medium">Active User</Text>
            <View className="flex-row items-center space-x-2">
              <Text className="text-lg font-bold text-white">{activeUser.displayName}</Text>
              {latestWeightKg > 0 && (
                <View className="bg-zinc-800/90 px-2 py-0.5 rounded-md border border-zinc-700">
                  <Text className="text-xs font-bold text-zinc-300">
                    {latestWeightKg} {weightUnit}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openEditTargets}
            accessibilityRole="button"
            accessibilityLabel={`Daily targets: ${totals.calories} of ${targets.calories} kcal. Tap to edit`}
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
                className={`text-xs font-extrabold uppercase ${
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
                <Text className="text-xs font-semibold text-zinc-300">
                  Calibrating ({tdeeResult.daysLogged}/{tdeeResult.requiredDays} days of data)
                </Text>
                <Text className="text-xs text-accent-cyan font-bold font-mono">
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
              <Text className="text-xs text-zinc-400 leading-tight">
                Requires 14+ days of logged calories & 2 weigh-ins separated by 14+ days for scientific regression.
              </Text>
            </View>
          ) : (
            <View>
              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-1 mr-2 min-w-0">
                  <Text className="text-base sm:text-lg font-black text-accent-cyan" numberOfLines={1} adjustsFontSizeToFit>
                    Maintenance: {tdeeResult.tdee} kcal
                  </Text>
                  <View className="flex-row items-center space-x-2 mt-1 flex-wrap">
                    <View
                      className={`px-2 py-0.5 rounded shrink-0 ${
                        tdeeResult.slopeKgPerWeek > 0.05
                          ? 'bg-amber-500/20 border border-amber-500/40'
                          : tdeeResult.slopeKgPerWeek < -0.05
                          ? 'bg-emerald-500/20 border border-emerald-500/40'
                          : 'bg-cyan-500/20 border border-cyan-500/40'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          tdeeResult.slopeKgPerWeek > 0.05
                            ? 'text-amber-400'
                            : tdeeResult.slopeKgPerWeek < -0.05
                            ? 'text-emerald-400'
                            : 'text-cyan-400'
                        }`}
                        numberOfLines={1}
                      >
                        Trending: {tdeeResult.slopeKgPerWeek >= 0 ? '+' : ''}
                        {tdeeResult.slopeKgPerWeek.toFixed(2)} {weightUnit}/week
                      </Text>
                    </View>
                    <Text className="text-xs text-zinc-400 font-medium shrink-0" numberOfLines={1}>
                      avg {tdeeResult.avgCalories} kcal
                    </Text>
                  </View>
                </View>

                {/* Set as Target Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleSetTDEEAsTarget(tdeeResult.tdee)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set calorie target to empirical maintenance of ${tdeeResult.tdee} kcal`}
                  className="bg-accent-cyan px-3 py-2 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20 shrink-0"
                >
                  <Ionicons name="checkmark-circle-outline" size={14} color="#09090B" />
                  <Text className="text-black font-extrabold text-xs">Set Target</Text>
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
                      }}
                    />
                  );
                })}

                {/* Center Content Core - Tap to change targets */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={openEditTargets}
                  accessibilityRole="button"
                  accessibilityLabel={`Energy gauge: ${totals.calories} of ${targets.calories} kcal. Tap to edit targets`}
                  style={{ width: 156, height: 156, borderRadius: 78 }}
                  className="bg-zinc-950 border border-zinc-800/80 items-center justify-center px-4 shadow-xl"
                >
                  <View className="flex-row items-center space-x-1 mb-0.5">
                    <Ionicons name="flame" size={13} color="#06B6D4" />
                    <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
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
                      className={`text-xs font-bold ${
                        !isOver ? 'text-cyan-400' : 'text-amber-400'
                      }`}
                    >
                      {!isOver
                        ? `${targets.calories - totals.calories} kcal left`
                        : `${totals.calories - targets.calories} kcal over`}
                    </Text>
                  </View>

                  <Text className="text-xs font-semibold text-zinc-400 mt-1">
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
          accessibilityRole="button"
          accessibilityLabel="Macro breakdown. Tap to edit daily macro targets"
          className="flex-row space-x-2"
        >
          {/* Protein */}
          <View className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-zinc-400 font-bold" numberOfLines={1}>PROTEIN</Text>
              <Ionicons name="pencil-outline" size={10} color="#10B981" />
            </View>
            <Text className="text-base font-bold text-accent-emerald" numberOfLines={1} adjustsFontSizeToFit>
              {totals.protein}g
            </Text>
            <Text className="text-xs text-zinc-400 mb-2" numberOfLines={1}>Target: {targets.protein}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-accent-emerald rounded-full"
                style={{ width: `${getPercent(totals.protein, targets.protein)}%` }}
              />
            </View>
          </View>

          {/* Carbs */}
          <View className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-zinc-400 font-bold" numberOfLines={1}>CARBS</Text>
              <Ionicons name="pencil-outline" size={10} color="#06B6D4" />
            </View>
            <Text className="text-base font-bold text-accent-cyan" numberOfLines={1} adjustsFontSizeToFit>
              {totals.carbs}g
            </Text>
            <Text className="text-xs text-zinc-400 mb-2" numberOfLines={1}>Target: {targets.carbs}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-accent-cyan rounded-full"
                style={{ width: `${getPercent(totals.carbs, targets.carbs)}%` }}
              />
            </View>
          </View>

          {/* Fats */}
          <View className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-zinc-400 font-bold" numberOfLines={1}>FATS</Text>
              <Ionicons name="pencil-outline" size={10} color="#F59E0B" />
            </View>
            <Text className="text-base font-bold text-amber-400" numberOfLines={1} adjustsFontSizeToFit>
              {totals.fats}g
            </Text>
            <Text className="text-xs text-zinc-400 mb-2" numberOfLines={1}>Target: {targets.fats}g</Text>
            <View className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <View
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${getPercent(totals.fats, targets.fats)}%` }}
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Prominent Log Meal Button by Today Totals */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setMealError(null);
            setMealDate(selectedDate);
            setShowAddMealModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Log meal and macros"
          className="bg-accent-cyan py-3.5 px-4 rounded-xl mt-4 flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25"
        >
          <Ionicons name="add-circle" size={20} color="#09090B" />
          <Text className="text-black font-black text-sm tracking-wide">
            + Log Meal / Macros
          </Text>
        </TouchableOpacity>

        {/* Change Targets Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openEditTargets}
          accessibilityRole="button"
          accessibilityLabel="Edit daily macro and calorie targets"
          className="flex-row items-center justify-center space-x-2 py-2.5 mt-2.5 bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/50 rounded-xl"
        >
          <Ionicons name="options-outline" size={16} color="#06B6D4" />
          <Text className="text-xs font-bold text-accent-cyan">Edit Daily Macro & Calorie Targets</Text>
        </TouchableOpacity>
      </View>

      {/* Daily Water / Hydration Tracker Card */}
      <View className="bg-dark-card border border-dark-border p-5 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center space-x-2.5 flex-1 pr-2">
            <View className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 items-center justify-center">
              <Ionicons name="water" size={20} color="#38BDF8" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">Daily Hydration</Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setGoalWaterInput(waterTargetMl.toString());
                  setShowEditHydrationGoalModal(true);
                }}
                className="flex-row items-center space-x-1 mt-0.5"
                activeOpacity={0.7}
              >
                <Text className="text-xs text-sky-400 font-semibold underline">
                  Goal: {(waterTargetMl / 1000).toFixed(1)} L {isImperial ? `(${Math.round(waterTargetMl / 29.5735)} oz)` : `(${waterTargetMl.toLocaleString()} ml)`}
                </Text>
                <Ionicons name="pencil" size={10} color="#38BDF8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setGoalWaterInput(waterTargetMl.toString());
              setShowEditHydrationGoalModal(true);
            }}
            className="items-end"
          >
            <View className="flex-row items-baseline space-x-1">
              <Text className="text-xl font-black text-sky-400">
                {(currentWaterMl / 1000).toFixed(2)}
              </Text>
              <Text className="text-xs font-bold text-zinc-400">
                / {(waterTargetMl / 1000).toFixed(1)} L
              </Text>
            </View>
            <Text className="text-xs font-semibold text-zinc-400">
              {currentWaterMl} ml {isImperial ? `(${Math.round(currentWaterMl / 29.5735)} oz)` : ''} • {waterPercent}%
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hydration Progress Bar */}
        <View className="w-full h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden mb-3.5">
          <View
            className="h-full bg-sky-400 rounded-full"
            style={{ width: `${Math.min(100, waterPercent)}%` }}
          />
        </View>

        {/* Quick Add Buttons & Reset */}
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleAddWater(250)}
            className="flex-1 bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/50 py-2 rounded-xl items-center justify-center"
          >
            <Text className="text-xs font-bold text-sky-300">+250 ml</Text>
            <Text className="text-xs text-zinc-400 font-medium">{isImperial ? '8 oz' : 'Glass'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleAddWater(500)}
            className="flex-1 bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/50 py-2 rounded-xl items-center justify-center"
          >
            <Text className="text-xs font-bold text-sky-300">+500 ml</Text>
            <Text className="text-xs text-zinc-400 font-medium">{isImperial ? '17 oz' : 'Bottle'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleAddWater(750)}
            className="flex-1 bg-zinc-900/90 border border-zinc-800 hover:border-sky-500/50 py-2 rounded-xl items-center justify-center"
          >
            <Text className="text-xs font-bold text-sky-300">+750 ml</Text>
            <Text className="text-xs text-zinc-400 font-medium">{isImperial ? '25 oz' : 'Shaker'}</Text>
          </TouchableOpacity>

          {currentWaterMl > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleResetWater}
              className="px-3 py-2 bg-zinc-900/90 border border-zinc-800 hover:border-red-500/50 rounded-xl items-center justify-center"
            >
              <Ionicons name="refresh-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Exact ML Option Directly Under 250ml, 500ml, 750ml Options */}
        <View className="mt-3 pt-3 border-t border-zinc-800/80">
          <View className="flex-row items-center space-x-2">
            <View className="flex-1 flex-row items-center bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5">
              <Ionicons name="water-outline" size={15} color="#38BDF8" />
              <TextInput
                keyboardType="numeric"
                value={customWaterInput}
                onChangeText={setCustomWaterInput}
                placeholder="Exact ml (e.g. 330)"
                placeholderTextColor="#71717A"
                className="flex-1 text-white font-bold text-xs ml-2 py-1"
                onSubmitEditing={() => handleLogExactWater()}
              />
              <Text className="text-xs text-zinc-400 font-semibold">ml</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleLogExactWater()}
              className="bg-sky-500/20 border border-sky-400/50 px-3.5 py-2.5 rounded-xl flex-row items-center space-x-1"
            >
              <Ionicons name="add" size={14} color="#38BDF8" />
              <Text className="text-xs font-bold text-sky-300">Add ml</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Exact Size Chips */}
          <View className="flex-row items-center space-x-2 mt-2">
            <TouchableOpacity
              onPress={() => handleLogExactWater(150)}
              className="bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-lg"
            >
              <Text className="text-xs text-zinc-400 font-medium">+150 ml (Cup)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLogExactWater(330)}
              className="bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-lg"
            >
              <Text className="text-xs text-zinc-400 font-medium">+330 ml (Can)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleLogExactWater(1000)}
              className="bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-lg"
            >
              <Text className="text-xs text-zinc-400 font-medium">+1,000 ml (1 L)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Meal Archetypes Quick-Log Carousel */}
      <MealArchetypesQuickAdd onLogMeal={handleQuickLogArchetype} />

      {/* Meals Breakdown List */}
      <View className="mb-10">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-white">
            {selectedDate === todayStr ? "Today's Meals" : `Meals for ${selectedDate}`}
          </Text>
          <View className="flex-row items-center space-x-2">
            <Text className="text-xs font-semibold text-zinc-400">
              {meals.length} Logged
            </Text>
            {meals.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAllDayMeals}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded flex-row items-center space-x-1"
              >
                <Ionicons name="trash-outline" size={11} color="#F43F5E" />
                <Text className="text-xs font-bold text-rose-400">Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {meals.length === 0 ? (
          <View className="bg-dark-card border border-dark-border p-6 rounded-2xl items-center">
            <Ionicons name="restaurant-outline" size={32} color="#71717A" />
            <Text className="text-sm text-zinc-400 mt-2 font-medium">
              No meals logged for {selectedDate === todayStr ? 'today' : selectedDate}.
            </Text>
          </View>
        ) : (
          meals.map((meal) => (
            <View
              key={meal.id}
              className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-3"
            >
              <View className="flex-row items-center justify-between">
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
                  <TouchableOpacity
                    onPress={() => handleDelete(meal.id, meal.label)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete meal ${meal.label}`}
                    className="h-12 w-12 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {meal.recipe ? (
                <View className="mt-2.5 pt-2.5 border-t border-zinc-800/80 flex-row items-start space-x-2 bg-zinc-900/40 p-2.5 rounded-xl">
                  <Ionicons name="receipt-outline" size={13} color="#06B6D4" style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-xs uppercase font-bold text-cyan-400 tracking-wider mb-0.5">
                      Recipe & Ingredients
                    </Text>
                    <Text className="text-xs text-zinc-300 leading-relaxed font-normal">
                      {meal.recipe}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>



      {/* Edit Daily Macro Targets Modal */}
      {showEditTargetsModal && (
        <Modal visible={showEditTargetsModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/80 justify-end"
        >
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[88%]">
            <View className="flex-row items-center justify-between mb-2 border-b border-zinc-800 pb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="options" size={20} color="#06B6D4" />
                <Text className="text-lg font-bold text-white">Edit Daily Targets</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditTargetsModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
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

              {/* Daily Hydration Target */}
              <View className="mb-6">
                <Text className="text-xs text-sky-400 font-semibold mb-1.5">Daily Hydration Target (ml)</Text>
                <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-1 mb-2">
                  <Ionicons name="water-outline" size={16} color="#38BDF8" />
                  <TextInput
                    keyboardType="numeric"
                    value={targetWaterInput}
                    onChangeText={setTargetWaterInput}
                    placeholder="3000"
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white font-bold text-base ml-2 py-2"
                  />
                  <Text className="text-xs text-zinc-400 font-bold">ml</Text>
                </View>

                {/* Preset Chips */}
                <View className="flex-row flex-wrap gap-2">
                  {[2000, 2500, 3000, 3500, 4000].map((preset) => {
                    const isSelected = parseInt(targetWaterInput, 10) === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setTargetWaterInput(preset.toString())}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400'
                            : 'bg-zinc-900 border-zinc-800'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isSelected ? 'text-sky-400' : 'text-zinc-400'
                          }`}
                        >
                          {(preset / 1000).toFixed(1)} L
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveTargets}
                className="bg-accent-cyan p-4 rounded-xl items-center shadow-md shadow-cyan-500/20 mb-4"
              >
                <Text className="text-black font-extrabold text-base">Save Targets</Text>
              </TouchableOpacity>

              {/* Evidence-Based Recommended Protein Targets Card (Collapsible tip at bottom) */}
              <View className="pt-2 border-t border-zinc-800/80">
                <ProteinRecommendationCard
                  collapsible
                  defaultExpanded={false}
                  className="bg-zinc-900/60 border-zinc-800"
                  onTierSelected={(tier: any) => {
                    setTargetProteinInput(tier.grams.toString());
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      )}

      {/* Set Daily Hydration Goal Modal */}
      {showEditHydrationGoalModal && (
        <Modal visible={showEditHydrationGoalModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/80 justify-end"
        >
          <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="water" size={20} color="#38BDF8" />
                <Text className="text-lg font-bold text-white">Daily Hydration Goal</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditHydrationGoalModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-4">
              Set your target daily water intake for <Text className="text-white font-bold">{activeUser.displayName}</Text>:
            </Text>

            {/* Custom Input */}
            <View className="mb-4">
              <Text className="text-xs text-sky-400 font-semibold mb-1.5">Target Intake (ml)</Text>
              <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-1">
                <Ionicons name="water-outline" size={18} color="#38BDF8" />
                <TextInput
                  keyboardType="numeric"
                  value={goalWaterInput}
                  onChangeText={setGoalWaterInput}
                  placeholder="3000"
                  placeholderTextColor="#71717A"
                  className="flex-1 text-white font-bold text-lg ml-2 py-2"
                />
                <Text className="text-xs text-zinc-400 font-bold">ml</Text>
              </View>
            </View>

            {/* Preset Goal Chips */}
            <Text className="text-xs text-zinc-400 font-medium mb-2">Quick Presets:</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {[2000, 2500, 3000, 3500, 4000].map((preset) => {
                const isSelected = parseInt(goalWaterInput, 10) === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => setGoalWaterInput(preset.toString())}
                    className={`px-3 py-2 rounded-xl border ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-sky-400' : 'text-zinc-300'
                      }`}
                    >
                      {(preset / 1000).toFixed(1)} L ({preset.toLocaleString()} ml)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSaveHydrationGoal()}
              className="bg-sky-400 py-3.5 rounded-xl items-center shadow-md shadow-sky-500/20 mb-3"
            >
              <Text className="text-black font-extrabold text-base">Save Hydration Goal</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      )}

      <Modal
        visible={showAddMealModal || datePickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => datePickerTarget ? setDatePickerTarget(null) : setShowAddMealModal(false)}
      >
        {datePickerTarget ? (
          <View className="flex-1 bg-black/80 justify-center px-4">
            <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl shadow-2xl max-h-[90%]">
              <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="calendar" size={20} color="#06B6D4" />
                  <Text className="text-base font-black text-white">Select date</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDatePickerTarget(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close calendar picker"
                >
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Quick Presets */}
                <View className="flex-row flex-wrap gap-1.5 mb-3">
                  {[
                    { label: 'Today', date: getLocalDate(0) },
                    { label: 'Yesterday', date: getLocalDate(-1) },
                    { label: '2 Days Ago', date: getLocalDate(-2) },
                    { label: '1 Week Ago', date: getLocalDate(-7) },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => {
                        Haptics.selectionAsync();
                        selectCalendarDate(preset.date);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${preset.label}, date ${preset.date}`}
                      className={`py-1.5 px-3 rounded-xl border ${
                        calendarSelection === preset.date
                          ? 'bg-cyan-500/20 border-cyan-500'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          calendarSelection === preset.date ? 'text-cyan-400' : 'text-zinc-300'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Month Navigation Switcher */}
                <View className="flex-row items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 mb-3">
                  <TouchableOpacity
                    onPress={handleCalPrevMonth}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    className="p-1.5 bg-zinc-800 rounded-lg"
                  >
                    <Ionicons name="chevron-back" size={16} color="#F4F4F5" />
                  </TouchableOpacity>

                  <Text className="text-sm font-black text-white">
                    {CALENDAR_MONTH_NAMES[calMonth]} {calYear}
                  </Text>

                  <TouchableOpacity
                    onPress={handleCalNextMonth}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    className="p-1.5 bg-zinc-800 rounded-lg"
                  >
                    <Ionicons name="chevron-forward" size={16} color="#F4F4F5" />
                  </TouchableOpacity>
                </View>

                {/* Day of Week Headers */}
                <View className="flex-row mb-1.5">
                  {CALENDAR_DAY_LABELS.map((day) => (
                    <View key={day} className="w-[14.28%] items-center">
                      <Text className="text-xs font-bold text-zinc-400 uppercase">
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Month Grid */}
                <View className="flex-row flex-wrap mb-2">
                  {calendarDays.map((item, index) => {
                    if (!item) {
                      return <View key={`empty-${index}`} className="w-[14.28%] h-10" />;
                    }

                    const isSelected = item.dateStr === calendarSelection;
                    const isToday = item.dateStr === todayStr;
                    const hasMeals = loggedNutritionDates.has(item.dateStr);

                    return (
                      <TouchableOpacity
                        key={item.dateStr}
                        onPress={() => {
                          Haptics.selectionAsync();
                          selectCalendarDate(item.dateStr);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Select date ${item.dateStr}${hasMeals ? ', meals logged' : ''}`}
                        className="w-[14.28%] h-10 items-center justify-center p-0.5"
                      >
                        <View
                          className={`w-8 h-8 rounded-xl items-center justify-center ${
                            isSelected
                              ? 'bg-cyan-500 border border-cyan-300'
                              : isToday
                              ? 'bg-zinc-800 border border-cyan-500/50'
                              : 'bg-transparent'
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              isSelected
                                ? 'text-black font-extrabold'
                                : isToday
                                ? 'text-cyan-400'
                                : 'text-zinc-300'
                            }`}
                          >
                            {item.dayNumber}
                          </Text>

                          {/* Meal Indicator Dot */}
                          {hasMeals && (
                            <View
                              className={`w-1 h-1 rounded-full mt-0.5 ${
                                isSelected ? 'bg-black' : 'bg-cyan-400'
                              }`}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Legend */}
                <View className="flex-row items-center justify-center py-2 border-t border-zinc-800 mb-3">
                  <View className="flex-row items-center space-x-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                    <Text className="text-xs text-zinc-400 font-medium">Meals Logged</Text>
                  </View>
                </View>

                {/* Custom Date Input Fallback */}
                <Text className="text-xs text-zinc-300 font-bold mb-1">
                  Or Enter Date (YYYY-MM-DD):
                </Text>
                <TextInput
                  value={jumpDateInput}
                  onChangeText={(text) => { setJumpDateInput(text); setDateError(false); }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#71717A"
                  accessibilityLabel="Custom jump date input"
                  className="bg-zinc-900 border border-zinc-800 text-white p-2.5 rounded-xl font-mono text-xs mb-3"
                />

                {dateError && <Text accessibilityRole="alert" className="text-rose-300 text-sm mb-3">Enter a valid calendar date.</Text>}
                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    onPress={() => setDatePickerTarget(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel date selection"
                    className="flex-1 bg-zinc-800 py-2.5 rounded-xl items-center border border-zinc-700"
                  >
                    <Text className="text-zinc-300 font-semibold text-xs">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const cleaned = jumpDateInput.trim();
                      if (!isValidDateString(cleaned)) {
                        setDateError(true);
                        return;
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      selectCalendarDate(cleaned);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Jump to custom date"
                    className="flex-1 bg-accent-cyan py-2.5 rounded-xl items-center shadow-md shadow-cyan-500/20"
                  >
                    <Text className="text-black font-extrabold text-xs">Jump to Date</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/80 justify-end">
          <ScrollView className="bg-dark-card border-t border-zinc-800 rounded-t-3xl max-h-[90%]" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <Text className="text-lg font-bold text-white">Quick Macro Entry</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close meal entry" onPress={() => setShowAddMealModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Meal date ${mealDate}. Open calendar`}
              onPress={() => openDatePicker('meal')}
              className="flex-row justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-4"
            >
              <Text className="text-sm font-semibold text-zinc-300">Meal date</Text>
              <Text className="text-sm font-bold text-cyan-300">{getDateLabel(mealDate)} <Ionicons name="calendar-outline" size={16} /></Text>
            </TouchableOpacity>

            <Text className="text-xs text-zinc-400 mb-1">Meal Name (Optional)</Text>
            <TextInput
              accessibilityLabel="Meal name"
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
                  accessibilityLabel="Calories"
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
                  accessibilityLabel="Protein in grams"
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
                  accessibilityLabel="Carbs in grams"
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
                  accessibilityLabel="Fats in grams"
                  value={fats}
                  onChangeText={setFats}
                  placeholder="15"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
            </View>

            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-xs text-zinc-400">Recipe / Ingredients (Optional)</Text>
                <Text className="text-xs text-zinc-400 italic">How it was made</Text>
              </View>
              <TextInput
                accessibilityLabel="Recipe or ingredients"
                  value={mealRecipe}
                onChangeText={setMealRecipe}
                placeholder="e.g. 200g chicken breast, 150g jasmine rice, 1 tsp olive oil"
                placeholderTextColor="#71717A"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-medium text-xs min-h-[60px]"
              />
            </View>

            {mealError && (
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-rose-300 text-sm mb-3">
                {mealError}
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSaveMeal}
              className="bg-accent-cyan p-4 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Log Meal</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
        )}
      </Modal>
    </ScrollView>
  </View>
);
}
