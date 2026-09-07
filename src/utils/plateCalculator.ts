import type {
  PlateWeight,
  PlateDefinition,
  PlateCount,
  PlateCalculationResult,
} from '../types/gymjam';

export const OLYMPIC_PLATES: PlateDefinition[] = [
  {
    weight: 25,
    color: '#EF4444', // Olympic Red
    borderColor: '#DC2626',
    textColor: '#FFFFFF',
    heightRatio: 1.0,
    widthRatio: 26,
    label: '25kg',
  },
  {
    weight: 20,
    color: '#2563EB', // Olympic Blue
    borderColor: '#1D4ED8',
    textColor: '#FFFFFF',
    heightRatio: 0.96,
    widthRatio: 24,
    label: '20kg',
  },
  {
    weight: 15,
    color: '#EAB308', // Olympic Yellow
    borderColor: '#CA8A04',
    textColor: '#09090B',
    heightRatio: 0.88,
    widthRatio: 21,
    label: '15kg',
  },
  {
    weight: 10,
    color: '#16A34A', // Olympic Green
    borderColor: '#15803D',
    textColor: '#FFFFFF',
    heightRatio: 0.78,
    widthRatio: 18,
    label: '10kg',
  },
  {
    weight: 5,
    color: '#F4F4F5', // Olympic White
    borderColor: '#A1A1AA',
    textColor: '#09090B',
    heightRatio: 0.65,
    widthRatio: 15,
    label: '5kg',
  },
  {
    weight: 2.5,
    color: '#27272A', // Black / Dark Charcoal
    borderColor: '#52525B',
    textColor: '#FAFAFA',
    heightRatio: 0.54,
    widthRatio: 13,
    label: '2.5kg',
  },
  {
    weight: 1.25,
    color: '#71717A', // Chrome / Silver / Zinc
    borderColor: '#A1A1AA',
    textColor: '#FFFFFF',
    heightRatio: 0.44,
    widthRatio: 11,
    label: '1.25kg',
  },
];

/**
 * Calculates optimal plate combinations per side for a given target weight and bar weight.
 */
export function calculateBarbellPlates(
  targetWeight: number,
  barWeight: 15 | 20 = 20
): PlateCalculationResult {
  const safeTarget = Math.max(barWeight, targetWeight || barWeight);
  const weightToDistribute = safeTarget - barWeight;
  let remainingPerSide = weightToDistribute / 2;

  const platesPerSide: PlateCount[] = [];

  for (const plateDef of OLYMPIC_PLATES) {
    // Check how many of this plate can fit on one side
    const count = Math.floor(remainingPerSide / plateDef.weight);
    if (count > 0) {
      platesPerSide.push({
        plate: plateDef,
        count,
      });
      remainingPerSide = Math.round((remainingPerSide - count * plateDef.weight) * 1000) / 1000;
    }
  }

  const remainderKg = Math.round(remainingPerSide * 2 * 100) / 100;
  const plateWeightBothSides = (weightToDistribute / 2 - remainingPerSide) * 2;
  const totalCalculatedWeight = Math.round((barWeight + plateWeightBothSides) * 100) / 100;

  return {
    targetWeight: safeTarget,
    barWeight,
    weightPerSide: Math.round((weightToDistribute / 2) * 100) / 100,
    platesPerSide,
    remainderKg,
    totalCalculatedWeight,
  };
}
