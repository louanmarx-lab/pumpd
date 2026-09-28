import { MacroTargets } from './index';

export type UserRole = 'coach' | 'athlete';
export type AccountType = 'coach' | 'client' | 'athlete';

export interface CoachProfile {
  name: string;
  businessName: string;
  instagramHandle: string;
}

export interface LinkedCoach {
  name: string;
  businessName?: string;
  instagramHandle?: string;
  linkedAt: number;
  coachId?: string;
  status?: 'active' | 'graduated';
}

export type AthleteMembershipStatus =
  | 'sponsored_by_coach' // 100% free VIP, paid by trainer's seat
  | 'graduated'          // Just unlinked from trainer, ready for solo conversion
  | 'solo_trial'         // Active 7-day free solo trial
  | 'solo_active'        // Subscribed solo athlete ($4.99 / R79/mo)
  | 'free';              // Standard free tier

export interface AthleteMembership {
  status: AthleteMembershipStatus;
  coachName?: string;
  coachBusiness?: string;
  graduatedAt?: number;
  trialEndsAt?: number;
}

export interface ClientClaimToken {
  code: string; // 6-digit alphanumeric code e.g. "PUMP-8K2"
  expiresAt: number;
  qrPayload: string;
}

export type ClientProfileType = 'shadow' | 'linked';
export type ClientProfileStatus = 'active' | 'archived' | 'graduated';

export interface ClientProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  email?: string;
  notes?: string;
  type?: ClientProfileType; // 'shadow' = in-person/unlinked, 'linked' = registered app user
  status?: ClientProfileStatus; // 'active' = uses a seat, 'archived' = inactive (free seat)
  linkedUserId?: string; // Firebase Auth UID if claimed
  linkedAt?: number;
  claimToken?: ClientClaimToken;
  macroTargets: MacroTargets;
  assignedSplitId?: string;
  assignedSplitName?: string;
  assignedRoutineIds: string[];
  assignedRoutineNames: string[];
  prescribedArchetypes: PrescribedMealArchetype[];
  createdAt: number;
  lastSessionDate?: string;
}

export type TrainerSubscriptionTier = 'starter' | 'standard' | 'pro' | 'studio';

export interface TrainerSubscription {
  tier: TrainerSubscriptionTier;
  seatLimit: number;
  priceZar: number;
  currency: 'ZAR';
  billingPeriod: 'monthly';
  status: 'active' | 'past_due' | 'canceled';
  expiresAt?: number;
}

export interface TierConfig {
  id: TrainerSubscriptionTier;
  name: string;
  subtitle: string;
  seatLimit: number;
  priceZar: number;
  productIdIos: string;
  productIdAndroid: string;
  features: string[];
  popular?: boolean;
}

export const TIER_CONFIGS: Record<TrainerSubscriptionTier, TierConfig> = {
  starter: {
    id: 'starter',
    name: 'Entry',
    subtitle: 'Starting out',
    seatLimit: 5,
    priceZar: 199,
    productIdIos: 'com.ripped.pt.starter.monthly',
    productIdAndroid: 'ripped_pt_starter_monthly',
    features: [
      'Up to 5 active clients',
      'Full in-person & shadow logging',
      'Custom program & split builder',
      'Diet & macro targets per client',
    ],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    subtitle: 'Best for growing coaches',
    seatLimit: 15,
    priceZar: 399,
    productIdIos: 'com.ripped.pt.standard.monthly',
    productIdAndroid: 'ripped_pt_standard_monthly',
    popular: true,
    features: [
      'Up to 15 active clients',
      'Real-time cloud client sync',
      'Account claiming via QR & PIN',
      'Branded workout performance receipts',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    subtitle: 'High-volume coaching',
    seatLimit: 30,
    priceZar: 699,
    productIdIos: 'com.ripped.pt.pro.monthly',
    productIdAndroid: 'ripped_pt_pro_monthly',
    features: [
      'Up to 30 active clients',
      'Priority real-time turn driver',
      'Client analytics & 1RM trend tracking',
      'Custom referral branding hooks',
    ],
  },
  studio: {
    id: 'studio',
    name: 'Custom',
    subtitle: 'Need more than 30 seats?',
    seatLimit: 50, // overridden dynamically by upgradeTrainerSubscription
    priceZar: 1299, // overridden dynamically: 699 + (seats - 30) * 30
    productIdIos: 'com.ripped.pt.studio.monthly',
    productIdAndroid: 'ripped_pt_studio_monthly',
    features: [
      'Choose exactly how many seats you need',
      'R699 base + R30 per client above 30',
      'e.g. 50 seats = R1 299/mo',
      'Full suite access & priority support',
    ],
  },
};

/** Custom seat pricing: R699 base + R30 per seat above 30 */
export function calculateCustomTierPrice(seats: number): number {
  return 699 + Math.max(0, seats - 30) * 30;
}

export interface PrescribedMealArchetype {
  id: string;
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  prescribedBy?: string; // Coach name or business
  instructions?: string;
  recipe?: string;
}

// -------------------------------------------------------------
// Coach-Led Gym Jam Protocol (P2P Remote Controller)
// -------------------------------------------------------------

export interface CoachLogSetMessage {
  type: 'COACH_LOG_SET';
  coachId: string;
  coachName: string;
  athleteId: string;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  rpe?: number;
  timestamp: number;
}

export interface SwapExerciseMessage {
  type: 'SWAP_EXERCISE';
  coachId: string;
  exerciseIndex: number;
  oldExerciseId: string;
  newExerciseId: string;
  newExerciseName: string;
  timestamp: number;
}

export interface SyncPresetsMessage {
  type: 'SYNC_PRESETS';
  coachName: string;
  businessName?: string;
  instagramHandle?: string;
  macroTargets?: MacroTargets;
  archetypes: PrescribedMealArchetype[];
  timestamp: number;
}
