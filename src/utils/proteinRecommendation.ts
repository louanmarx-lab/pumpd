/**
 * Evidence-Based Daily Protein Target Recommendation Engine
 * Based on sports nutrition meta-analyses (Schoenfeld & Phillips, Morton et al.)
 * Muscle protein synthesis (MPS) plateaus within the 1.6–2.2 g/kg range:
 * - Minimum for Max Growth: 1.6 g/kg - Baseline threshold where hypertrophy benefits plateau.
 * - Optimal High Ceiling: 2.0 g/kg - Recommended target covering virtually all individual variance.
 * - Upper Limit of Return: 2.2 g/kg - Ceiling of diminishing returns; surplus is oxidized for energy.
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
      name: 'Minimum for Max Growth',
      multiplier: PROTEIN_MULTIPLIERS.MIN,
      multiplierLabel: '1.6 g/kg',
      grams: minForMaxGrowth,
      subtitle: 'Baseline threshold where hypertrophy benefits plateau.',
      isRecommended: false,
    },
    {
      id: 'optimal',
      name: 'Optimal High Ceiling',
      multiplier: PROTEIN_MULTIPLIERS.OPTIMAL,
      multiplierLabel: '2.0 g/kg',
      grams: optimalCeiling,
      subtitle: 'Recommended target covering virtually all individual variance.',
      isRecommended: true,
    },
    {
      id: 'upper',
      name: 'Upper Limit of Return',
      multiplier: PROTEIN_MULTIPLIERS.UPPER,
      multiplierLabel: '2.2 g/kg',
      grams: upperLimit,
      subtitle: 'Ceiling of diminishing returns; surplus is oxidized for energy.',
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
