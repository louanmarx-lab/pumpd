/**
 * Evidence-Based Daily Protein Target Recommendation Engine
 * Based on sports nutrition meta-analyses (Schoenfeld & Phillips, Morton et al.)
 * Muscle protein synthesis (MPS) plateaus within the 1.6–2.2 g/kg range:
 * - Lower reference: 1.6 g/kg - A general research reference for resistance training.
 * - Middle reference: 2.0 g/kg - A reference estimate, not an individual prescription.
 * - Upper reference: 2.2 g/kg - Higher intake is not necessarily more beneficial.
 */

export type ProteinTierId = 'min' | 'optimal' | 'upper';

export interface ProteinTier {
  id: ProteinTierId;
  name: string;
  multiplier: number;
  multiplierLabel: string;
  grams: number;
  subtitle: string;
  isRecommended: boolean;
}

export interface ProteinCalculationResult {
  weightKg: number;
  hasLoggedWeight: boolean;
  minForMaxGrowth: number;
  optimalCeiling: number;
  upperLimit: number;
  tiers: ProteinTier[];
}

export const PROTEIN_MULTIPLIERS = {
  MIN: 1.6,
  OPTIMAL: 2.0,
  UPPER: 2.2,
} as const;

export function calculateProteinTargets(weightKg: number | null | undefined): ProteinCalculationResult {
  const hasLoggedWeight = typeof weightKg === 'number' && weightKg > 0 && !isNaN(weightKg);
  const safeWeight = hasLoggedWeight ? weightKg : 75; // Default reference weight: 75kg

  const minForMaxGrowth = Math.round(safeWeight * PROTEIN_MULTIPLIERS.MIN);
  const optimalCeiling = Math.round(safeWeight * PROTEIN_MULTIPLIERS.OPTIMAL);
  const upperLimit = Math.round(safeWeight * PROTEIN_MULTIPLIERS.UPPER);

  const tiers: ProteinTier[] = [
    {
      id: 'min',
      name: 'Lower reference',
      multiplier: PROTEIN_MULTIPLIERS.MIN,
      multiplierLabel: '1.6 g/kg',
      grams: minForMaxGrowth,
      subtitle: 'A general research reference for resistance training.',
      isRecommended: false,
    },
    {
      id: 'optimal',
      name: 'Middle reference',
      multiplier: PROTEIN_MULTIPLIERS.OPTIMAL,
      multiplierLabel: '2.0 g/kg',
      grams: optimalCeiling,
      subtitle: 'A reference estimate, not an individual prescription.',
      isRecommended: true,
    },
    {
      id: 'upper',
      name: 'Upper reference',
      multiplier: PROTEIN_MULTIPLIERS.UPPER,
      multiplierLabel: '2.2 g/kg',
      grams: upperLimit,
      subtitle: 'Higher intake is not necessarily more beneficial.',
      isRecommended: false,
    },
  ];

  return {
    weightKg: safeWeight,
    hasLoggedWeight,
    minForMaxGrowth,
    optimalCeiling,
    upperLimit,
    tiers,
  };
}
