import { MacroTargets } from './index';

export type UserRole = 'coach' | 'athlete';

export interface CoachProfile {
  name: string;
  businessName: string;
  instagramHandle: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  email?: string;
  notes?: string;
  macroTargets: MacroTargets;
  assignedRoutineIds: string[];
  assignedRoutineNames: string[];
  prescribedArchetypes: PrescribedMealArchetype[];
  createdAt: number;
  lastSessionDate?: string;
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
