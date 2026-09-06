import type { BodyMetric, NutritionLog } from '../types/index';

export interface TDEECalibratingResult {
  status: 'calibrating';
  tdee: null;
  daysLogged: number;
  requiredDays: number;
  weighInDaysCount: number;
  spanDays: number;
}

export interface TDEEReadyResult {
  status: 'ready';
  tdee: number;
  slopeKgPerWeek: number;
  avgCalories: number;
  daysLogged: number;
  weighInDaysCount: number;
  spanDays: number;
}

export type TDEEResult = TDEECalibratingResult | TDEEReadyResult;

/**
 * Helper to convert Date to YYYY-MM-DD
 */
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates 4-Week Empirical Maintenance (TDEE) using Ordinary Least-Squares (OLS)
 * linear regression over a rolling 28-day window.
 *
 * Requirements:
 * - Strictly isolated by activeUserId
 * - Window: today - 27 days through today (28 total days, dayIndex 0..27)
 * - Calorie requirement: >= 14 days with logged calories (> 0)
 * - Weigh-in requirement: >= 2 distinct weigh-in dates with dayIndex difference >= 14
 * - Multiple weigh-ins on the same date are averaged to avoid duplicate X-axis points
 * - Guarded against zero-variance / identical X values
 * - Clamped between 1,200 and 5,000 kcal
 */
export function calculateEmpiricalTDEE(
  activeUserId: string,
  nutritionLogs: NutritionLog[],
  bodyMetrics: BodyMetric[],
  referenceDate: Date = new Date()
): TDEEResult {
  const REQUIRED_CALORIE_DAYS = 14;
  const REQUIRED_SPAN_DAYS = 14;
  const WINDOW_DAYS = 28;

  // 1. Build the 28-day date list [day 0 (27 days ago) ... day 27 (today)]
  const dateToDayIndex = new Map<string, number>();
  const dayIndexToDate = new Map<number, string>();

  // Normalize reference date to midnight
  const refMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  for (let i = 0; i < WINDOW_DAYS; i++) {
    const daysBack = WINDOW_DAYS - 1 - i; // when i=0 -> 27 days back; when i=27 -> 0 days back
    const targetDate = new Date(refMidnight.getTime() - daysBack * 86400000);
    const dateStr = toISODate(targetDate);
    dateToDayIndex.set(dateStr, i);
    dayIndexToDate.set(i, dateStr);
  }

  // 2. Extract & Sum daily calories for activeUserId within the window
  const dailyCaloriesMap = new Map<number, number>();
  const userNutritionLogs = nutritionLogs.filter((l) => l.userId === activeUserId);

  for (const log of userNutritionLogs) {
    const dayIndex = dateToDayIndex.get(log.date);
    if (dayIndex !== undefined) {
      const meals = Array.isArray(log.meals) ? log.meals : [];
      const mealCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
      const directCalories = typeof (log as any).calories === 'number' ? (log as any).calories : 0;
      const dayTotal = mealCalories > 0 ? mealCalories : directCalories;
      if (dayTotal > 0) {
        dailyCaloriesMap.set(dayIndex, (dailyCaloriesMap.get(dayIndex) || 0) + dayTotal);
      }
    }
  }

  const validCalorieDaysCount = dailyCaloriesMap.size;

  // 3. Extract & Average morning body weight logs for activeUserId within the window
  const dailyWeightMap = new Map<number, { sum: number; count: number }>();
  const userMetrics = bodyMetrics.filter((m) => m.userId === activeUserId);

  for (const metric of userMetrics) {
    if (metric.weightKg && metric.weightKg > 0) {
      const dayIndex = dateToDayIndex.get(metric.date);
      if (dayIndex !== undefined) {
        const current = dailyWeightMap.get(dayIndex) || { sum: 0, count: 0 };
        dailyWeightMap.set(dayIndex, {
          sum: current.sum + metric.weightKg,
          count: current.count + 1,
        });
      }
    }
  }

  // Convert averaged weights into (x, y) coordinates
  const weighInPoints: { x: number; y: number }[] = [];
  dailyWeightMap.forEach((val, dayIndex) => {
    const avgWeight = val.sum / val.count;
    weighInPoints.push({ x: dayIndex, y: avgWeight });
  });

  // Sort by dayIndex ascending
  weighInPoints.sort((a, b) => a.x - b.x);

  const distinctWeighInDatesCount = weighInPoints.length;
  const spanDays =
    distinctWeighInDatesCount >= 2
      ? weighInPoints[distinctWeighInDatesCount - 1].x - weighInPoints[0].x
      : 0;

  // 4. Minimum Data Validation Check
  if (
    validCalorieDaysCount < REQUIRED_CALORIE_DAYS ||
    distinctWeighInDatesCount < 2 ||
    spanDays < REQUIRED_SPAN_DAYS
  ) {
    return {
      status: 'calibrating',
      tdee: null,
      daysLogged: validCalorieDaysCount,
      requiredDays: REQUIRED_CALORIE_DAYS,
      weighInDaysCount: distinctWeighInDatesCount,
      spanDays,
    };
  }

  // 5. Weight Trend Calculation via Ordinary Least-Squares (OLS) Linear Regression
  const N = weighInPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumXY = 0;

  for (const pt of weighInPoints) {
    sumX += pt.x;
    sumY += pt.y;
    sumX2 += pt.x * pt.x;
    sumXY += pt.x * pt.y;
  }

  const denominator = N * sumX2 - sumX * sumX;

  // Guard against zero-variance / identical X values
  if (denominator === 0) {
    return {
      status: 'calibrating',
      tdee: null,
      daysLogged: validCalorieDaysCount,
      requiredDays: REQUIRED_CALORIE_DAYS,
      weighInDaysCount: distinctWeighInDatesCount,
      spanDays,
    };
  }

  const slope = (N * sumXY - sumX * sumY) / denominator; // kg per day

  // 6. Maintenance Calculation
  let totalCalories = 0;
  dailyCaloriesMap.forEach((cal) => {
    totalCalories += cal;
  });
  const avgCalories = totalCalories / validCalorieDaysCount;

  // 1 kg body mass delta ≈ 7,700 kcal energy delta
  const rawTDEE = avgCalories - slope * 7700;

  // Clamp rawTDEE between 1,200 and 5,000 kcal
  const clampedTDEE = Math.max(1200, Math.min(5000, rawTDEE));

  return {
    status: 'ready',
    tdee: Math.round(clampedTDEE),
    slopeKgPerWeek: slope * 7,
    avgCalories: Math.round(avgCalories),
    daysLogged: validCalorieDaysCount,
    weighInDaysCount: distinctWeighInDatesCount,
    spanDays,
  };
}
