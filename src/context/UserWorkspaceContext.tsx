import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  Workspace,
  Exercise,
  Split,
  Routine,
  WorkoutLog,
  NutritionLog,
  BodyMetric,
  MacroTargets,
  Meal,
  DayOfWeek,
  DaySchedule,
  WeightUnit,
} from '../types';
import { DEFAULT_EXERCISES } from '../utils/fitness';
import { buildAllPresetSplits, buildSplitFromPreset, PRESET_SPLITS } from '../utils/presetSplits';
import {
  UserRole,
  AccountType,
  CoachProfile,
  ClientProfile,
  PrescribedMealArchetype,
  LinkedCoach,
  TrainerSubscription,
  TrainerSubscriptionTier,
  TIER_CONFIGS,
  ClientClaimToken,
  AthleteMembership,
  calculateCustomTierPrice,
} from '../types/trainer';
import {
  generateClaimToken,
  publishClientClaimCloud,
  lookupClientClaimCloud,
  executeClientClaimCloud,
  normalizeClaimCode,
  ClientClaimCloudRecord,
} from '../services/clientClaimService';
import {
  loadStoredAppData,
  persistAppData,
  clearStoredAppData,
  loadUserData,
  persistUserData,
  getActiveSession,
  STORAGE_KEYS,
} from '../utils/storage';
import { User as FirebaseUser } from 'firebase/auth';
import {
  saveUserProfileCloud,
  saveWorkoutLogCloud,
  deleteWorkoutLogCloud,
  subscribeToWorkoutLogs,
  saveNutritionLogCloud,
  deleteNutritionMealCloud,
  subscribeToNutritionLogs,
  saveBodyMetricCloud,
  deleteBodyMetricCloud,
  subscribeToBodyMetrics,
  saveSplitsCloud,
  saveCoachProfileCloud,
  saveClientsCloud,
  savePrescribedArchetypesCloud,
  subscribeToUserProfile,
  subscribeToCoachData,
  unlinkCoachCloud,
  unlinkClientInCoachRosterCloud,
} from '../services/firestoreService';
import { auth } from '../config/firebase';
import { subscribeToAuth, signInAsGuest, signOutUser } from '../services/authService';
import { updateCoachClientLastSessionCloud } from '../services/gymJamService';

interface UserWorkspaceContextType {
  isHydrated: boolean;
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  activeUser: UserProfile;
  activeWorkspace: Workspace;
  exercises: Exercise[];
  splits: Split[];
  workoutLogs: WorkoutLog[];
  nutritionLogs: NutritionLog[];
  bodyMetrics: BodyMetric[];
  
  weeklySchedule: DaySchedule[];
  updateDaySchedule: (
    day: DayOfWeek,
    routineId: string,
    routineName: string,
    exerciseIds?: string[]
  ) => void;
  shiftSplitSchedule: (fromDay: DayOfWeek) => void;
  
  // 3 Primary Account Types ('coach' | 'client' | 'athlete')
  accountType: AccountType;
  setAccountType: (type: AccountType) => void;

  // Trainer & Client Dual Mode
  userRole: UserRole;
  coachProfile: CoachProfile;
  clients: ClientProfile[];
  prescribedArchetypes: PrescribedMealArchetype[];
  trainerSubscription: TrainerSubscription;
  activeSeatsUsed: number;
  setUserRole: (role: UserRole) => void;
  updateCoachProfile: (profile: Partial<CoachProfile>) => void;
  addClient: (client: Omit<ClientProfile, 'id' | 'createdAt'>) => ClientProfile;
  updateClient: (client: ClientProfile) => void;
  deleteClient: (clientId: string) => void;
  unlinkClient: (clientId: string) => void;
  archiveClient: (clientId: string) => void;
  unarchiveClient: (clientId: string) => { success: boolean; needUpgrade?: boolean };
  generateClientClaimToken: (clientId: string, force?: boolean) => ClientClaimToken | null;
  claimClientWithCode: (code: string) => Promise<{ success: boolean; coachName?: string; error?: string }>;
  upgradeTrainerSubscription: (tier: TrainerSubscriptionTier, customSeats?: number) => void;
  reconcileDowngradeSeats: (newTier: TrainerSubscriptionTier, activeClientIds: string[]) => void;
  getClientWorkoutLogs: (clientId: string) => WorkoutLog[];
  logClientWorkout: (clientId: string, log: Omit<WorkoutLog, 'id'>) => WorkoutLog;
  assignClientRoutine: (clientId: string, routineId: string, routineName: string) => void;
  assignClientMacros: (clientId: string, targets: MacroTargets) => void;
  assignClientArchetypes: (clientId: string, archetypes: PrescribedMealArchetype[]) => void;
  coachMeals: PrescribedMealArchetype[];
  addCoachMeal: (meal: Omit<PrescribedMealArchetype, 'id'>) => PrescribedMealArchetype;
  deleteCoachMeal: (mealId: string) => void;
  assignSplitToClient: (clientId: string, split: Split) => void;
  assignSplitToSelf: (split: Split) => void;
  assignMealToSelf: (meal: PrescribedMealArchetype) => void;
  setPrescribedArchetypes: React.Dispatch<React.SetStateAction<PrescribedMealArchetype[]>>;

  // Active Managed Client Mode (Athlete Impersonation Workspace)
  managedClient: ClientProfile | null;
  startManagingClient: (client: ClientProfile) => void;
  stopManagingClient: () => void;

  // Personal Athlete Profile Mode for Coaches
  isCoachAccount: boolean;
  isViewingPersonalProfile: boolean;
  enterPersonalAthleteMode: () => void;
  exitPersonalAthleteMode: () => void;

  // Athlete-to-Coach Link & Graduation
  linkedCoach: LinkedCoach | null;
  linkCoach: (coach: { name: string; businessName?: string; instagramHandle?: string; coachId?: string }) => void;
  unlinkCoach: () => void;
  athleteMembership: AthleteMembership;
  setAthleteMembership: React.Dispatch<React.SetStateAction<AthleteMembership>>;
  graduateClient: (clientId: string) => void;
  completeGraduation: (chosenPlan: 'trial' | 'free') => void;

  // Actions
  switchActiveUser: (userId: string) => void;
  addExercise: (exercise: Omit<Exercise, 'id'>) => Exercise;
  updateExercise: (exercise: Exercise) => void;
  deleteExercise: (exerciseId: string) => void;
  toggleStarExercise: (exerciseId: string) => void;
  addSplit: (split: Omit<Split, 'id'>) => Split;
  updateSplit: (split: Split) => void;
  deleteSplit: (splitId: string) => void;
  setActiveSplit: (splitId: string) => void;
  toggleStarSplit: (splitId: string) => void;
  restoreDefaultSplits: () => void;
  clearAllCoachSplits: () => void;
  removeExerciseFromRoutine: (splitId: string, routineId: string, exerciseId: string) => void;
  saveWorkoutLog: (log: Omit<WorkoutLog, 'id'>) => WorkoutLog;
  deleteWorkoutLog: (logId: string) => void;
  saveNutritionMeal: (date: string, meal: Omit<Meal, 'id'>) => void;
  deleteNutritionMeal: (date: string, mealId: string) => void;
  clearNutritionDay: (date: string) => void;
  updateMacroTargets: (targets: MacroTargets) => void;
  updateUserName: (userId: string, newDisplayName: string) => void;
  updateWeightUnit: (unit: WeightUnit) => void;
  saveWaterIntake: (date: string, amountMl: number) => void;
  addBodyMetric: (
    weightKg: number,
    bodyFatPercentage?: number,
    skeletalMuscleMassKg?: number,
    date?: string
  ) => void;
  deleteBodyMetric: (metricId: string) => void;
  linkPartnerUser: (partnerName: string, partnerEmail: string) => void;
  clearAllData: () => Promise<void>;
  resetAllDataToDefaults: () => Promise<void>;
  initializeBrandNewUser: (displayName: string, role?: UserRole, accountType?: AccountType) => Promise<void>;

  // Firebase Auth & Cloud Sync
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline';
  lastCloudSyncTimestamp: number | null;
  syncAllToCloud: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: (role?: UserRole, accountType?: AccountType) => Promise<void>;
}

// Initial Demo Accounts & Workspace
const initialCurrentUser: UserProfile = {
  id: 'user_alex',
  displayName: 'Alex Johnson',
  email: 'alex@ripped.app',
  activeWorkspaceId: 'ws_ripped_1',
  macroTargets: { calories: 2600, protein: 185, carbs: 275, fats: 80 },
  weightUnit: 'kg',
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
};

const initialPartnerUser: UserProfile | null = null;

const initialWorkspace: Workspace = {
  id: 'ws_ripped_1',
  name: 'Personal Account',
  ownerId: 'user_alex',
  memberIds: ['user_alex'],
};

// Initial Splits: Clean - coaches and users create their own splits from scratch
const initialSplits: Split[] = [];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const initialAlexSchedule: DaySchedule[] = [
  { day: 'Monday', routineId: 'r_push', routineName: 'Push Day (Chest, Shoulders, Triceps)', exerciseIds: ['ex_1', 'ex_2', 'ex_13', 'ex_14', 'ex_18'] },
  { day: 'Tuesday', routineId: 'r_pull', routineName: 'Pull Day (Back & Biceps)', exerciseIds: ['ex_4', 'ex_5', 'ex_6', 'ex_16', 'ex_17'] },
  { day: 'Wednesday', routineId: 'r_pull', routineName: 'Pull & Core Focus', exerciseIds: ['ex_5', 'ex_6', 'ex_21', 'ex_22'] },
  { day: 'Thursday', routineId: 'r_legs', routineName: 'Leg Day (Quads, Hamstrings, Calves)', exerciseIds: ['ex_8', 'ex_9', 'ex_11', 'ex_12', 'ex_20'] },
  { day: 'Friday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Saturday', routineId: 'r_push', routineName: 'Push Hypertrophy', exerciseIds: ['ex_1', 'ex_3', 'ex_14', 'ex_18'] },
  { day: 'Sunday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
];

const initialJordanSchedule: DaySchedule[] = [
  { day: 'Monday', routineId: 'r_upper', routineName: 'Upper Body A', exerciseIds: ['ex_1', 'ex_5', 'ex_13', 'ex_16', 'ex_18'] },
  { day: 'Tuesday', routineId: 'r_lower', routineName: 'Lower Body A', exerciseIds: ['ex_8', 'ex_11', 'ex_9', 'ex_20', 'ex_21'] },
  { day: 'Wednesday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Thursday', routineId: 'r_upper', routineName: 'Upper Body B', exerciseIds: ['ex_2', 'ex_6', 'ex_14', 'ex_17', 'ex_19'] },
  { day: 'Friday', routineId: 'r_lower', routineName: 'Lower Body B', exerciseIds: ['ex_8', 'ex_12', 'ex_10', 'ex_20', 'ex_22'] },
  { day: 'Saturday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Sunday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
];

// Today and recent date helpers (YYYY-MM-DD)
const formatDate = (dateObj: Date) => dateObj.toISOString().split('T')[0];
const todayStr = formatDate(new Date());
const yesterdayStr = formatDate(new Date(Date.now() - 86400000));
const threeDaysAgoStr = formatDate(new Date(Date.now() - 3 * 86400000));
const fiveDaysAgoStr = formatDate(new Date(Date.now() - 5 * 86400000));

// Initial Workout Logs for benchmarks
const initialWorkoutLogs: WorkoutLog[] = [
  {
    id: 'log_alex_1',
    userId: 'user_alex',
    workspaceId: 'ws_ripped_1',
    splitId: 'split_1',
    routineName: 'Push Day (Chest, Shoulders, Triceps)',
    date: yesterdayStr,
    timestamp: Date.now() - 86400000,
    durationSeconds: 3120, // 52 mins
    exercises: [
      {
        exerciseId: 'ex_1',
        exerciseName: 'Barbell Flat Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 60, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 85, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 90, reps: 6, isCompleted: true },
          { setNumber: 4, type: 'Failure', weightKg: 90, reps: 5, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_13',
        exerciseName: 'Dumbbell Overhead Shoulder Press',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 26, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 28, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Drop', weightKg: 22, reps: 12, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: 'log_alex_2',
    userId: 'user_alex',
    workspaceId: 'ws_ripped_1',
    splitId: 'split_1',
    routineName: 'Leg Day (Quads, Hamstrings, Calves)',
    date: threeDaysAgoStr,
    timestamp: Date.now() - 3 * 86400000,
    durationSeconds: 2700, // 45 mins
    exercises: [
      {
        exerciseId: 'ex_8',
        exerciseName: 'Barbell Back Squat',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 80, reps: 8, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 110, reps: 6, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 120, reps: 5, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_11',
        exerciseName: 'Romanian Deadlift (RDL)',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 90, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 100, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: 'log_jordan_1',
    userId: 'user_jordan',
    workspaceId: 'ws_ripped_1',
    splitId: 'split_2',
    routineName: 'Upper Body A',
    date: yesterdayStr,
    timestamp: Date.now() - 86400000,
    durationSeconds: 2400, // 40 mins
    exercises: [
      {
        exerciseId: 'ex_1',
        exerciseName: 'Barbell Flat Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 40, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 65, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 70, reps: 6, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_5',
        exerciseName: 'Lat Pulldown',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 55, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 60, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: 'log_sophia_1',
    userId: 'client_sophia',
    workspaceId: 'ws_ripped_1',
    splitId: 'split_1',
    routineName: 'Upper Body Power',
    date: threeDaysAgoStr,
    timestamp: Date.now() - 3 * 86400000,
    durationSeconds: 2700, // 45 mins
    loggedBy: 'coach',
    coachId: 'user_alex',
    coachName: 'Alex Johnson',
    exercises: [
      {
        exerciseId: 'ex_1',
        exerciseName: 'Barbell Flat Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 35, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 50, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 55, reps: 6, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_5',
        exerciseName: 'Lat Pulldown',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 45, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 50, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
];

// Initial Nutrition Logs
const initialNutritionLogs: NutritionLog[] = [
  {
    id: 'nut_alex_today',
    userId: 'user_alex',
    date: todayStr,
    meals: [
      { id: 'm1', label: 'Oatmeal & Protein Shake', calories: 650, protein: 48, carbs: 75, fats: 14, timestamp: Date.now() - 14000000 },
      { id: 'm2', label: 'Chicken & Rice Bowl', calories: 750, protein: 55, carbs: 85, fats: 18, timestamp: Date.now() - 7000000 },
      { id: 'm3', label: 'Greek Yogurt & Almonds', calories: 350, protein: 30, carbs: 25, fats: 12, timestamp: Date.now() - 2000000 },
    ],
  },
  {
    id: 'nut_jordan_today',
    userId: 'user_jordan',
    date: todayStr,
    meals: [
      { id: 'jm1', label: 'Egg White Avocado Toast', calories: 520, protein: 32, carbs: 55, fats: 18, timestamp: Date.now() - 12000000 },
      { id: 'jm2', label: 'Turkey & Sweet Potato', calories: 680, protein: 48, carbs: 70, fats: 20, timestamp: Date.now() - 6000000 },
    ],
  },
];

// Initial Body Metrics
const initialBodyMetrics: BodyMetric[] = [
  { id: 'bm_a1', userId: 'user_alex', date: formatDate(new Date(Date.now() - 14 * 86400000)), weightKg: 82.5, bodyFatPercentage: 15.4, skeletalMuscleMassKg: 39.2 },
  { id: 'bm_a2', userId: 'user_alex', date: formatDate(new Date(Date.now() - 10 * 86400000)), weightKg: 82.2, bodyFatPercentage: 15.1, skeletalMuscleMassKg: 39.4 },
  { id: 'bm_a3', userId: 'user_alex', date: formatDate(new Date(Date.now() - 5 * 86400000)), weightKg: 82.0, bodyFatPercentage: 14.8, skeletalMuscleMassKg: 39.7 },
  { id: 'bm_a4', userId: 'user_alex', date: todayStr, weightKg: 81.8, bodyFatPercentage: 14.6, skeletalMuscleMassKg: 40.0 },
  { id: 'bm_j1', userId: 'user_jordan', date: formatDate(new Date(Date.now() - 14 * 86400000)), weightKg: 68.0, bodyFatPercentage: 22.2, skeletalMuscleMassKg: 28.0 },
  { id: 'bm_j2', userId: 'user_jordan', date: formatDate(new Date(Date.now() - 7 * 86400000)), weightKg: 67.8, bodyFatPercentage: 21.8, skeletalMuscleMassKg: 28.3 },
  { id: 'bm_j3', userId: 'user_jordan', date: todayStr, weightKg: 67.5, bodyFatPercentage: 21.5, skeletalMuscleMassKg: 28.5 },
];

// Initial Coach Profile & Demo Client Roster
const initialCoachProfile: CoachProfile = {
  name: 'Coach',
  businessName: '',
  instagramHandle: '',
};

const initialPrescribedArchetypes: PrescribedMealArchetype[] = [
  {
    id: 'arch_presc_1',
    name: 'Post-Workout Shake',
    emoji: '🥤',
    calories: 320,
    protein: 45,
    carbs: 30,
    fats: 2,
    prescribedBy: 'Apex Performance Coaching',
    instructions: 'Drink within 45 mins of workout completion with 400ml water.',
  },
  {
    id: 'arch_presc_2',
    name: 'Chicken & Rice Staple',
    emoji: '🍗',
    calories: 580,
    protein: 52,
    carbs: 65,
    fats: 10,
    prescribedBy: 'Apex Performance Coaching',
    instructions: '200g grilled breast, 250g cooked basmati, steamed greens.',
  },
  {
    id: 'arch_presc_3',
    name: 'Breakfast Eggs & Toast',
    emoji: '🍳',
    calories: 390,
    protein: 28,
    carbs: 32,
    fats: 16,
    prescribedBy: 'Apex Performance Coaching',
    instructions: '3 whole eggs scrambled, 2 slices sourdough toast, spinach.',
  },
];

const initialClients: ClientProfile[] = [
  {
    id: 'client_marcus',
    name: 'Marcus Vance',
    avatarEmoji: '⚡',
    email: 'marcus@gmail.com',
    type: 'linked',
    status: 'active',
    linkedUserId: 'user_jordan',
    linkedAt: Date.now() - 14 * 86400000,
    notes: 'Focus on progressive overload on bench and squat. Knee rehab warmups.',
    macroTargets: { calories: 2800, protein: 190, carbs: 320, fats: 80 },
    assignedRoutineIds: ['r_push', 'r_pull', 'r_legs'],
    assignedRoutineNames: ['Push Day (Chest, Shoulders)', 'Pull Day (Back & Biceps)', 'Leg Day (Quads, Calves)'],
    prescribedArchetypes: [initialPrescribedArchetypes[0], initialPrescribedArchetypes[1]],
    createdAt: Date.now() - 14 * 86400000,
    lastSessionDate: yesterdayStr,
  },
  {
    id: 'client_sophia',
    name: 'Sophia Chen',
    avatarEmoji: '🔥',
    email: 'sophia.chen@fit.com',
    type: 'shadow',
    status: 'active',
    notes: 'Glute hypertrophy and pull-up progression. In-person client.',
    macroTargets: { calories: 2100, protein: 145, carbs: 220, fats: 65 },
    assignedRoutineIds: ['r_upper', 'r_lower'],
    assignedRoutineNames: ['Upper Body Power', 'Lower Body Hypertrophy'],
    prescribedArchetypes: [initialPrescribedArchetypes[2]],
    createdAt: Date.now() - 20 * 86400000,
    lastSessionDate: threeDaysAgoStr,
  },
];

const initialTrainerSubscription: TrainerSubscription = {
  tier: 'starter',
  seatLimit: 5,
  priceZar: 199,
  currency: 'ZAR',
  billingPeriod: 'monthly',
  status: 'active',
  expiresAt: Date.now() + 30 * 86400000,
};

const UserWorkspaceContext = createContext<UserWorkspaceContextType | undefined>(undefined);

export const UserWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialCurrentUser);
  const [partnerUser, setPartnerUser] = useState<UserProfile | null>(initialPartnerUser);
  const [activeUser, setActiveUser] = useState<UserProfile>(initialCurrentUser);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(initialWorkspace);

  // 3 Primary Account Types ('coach' | 'client' | 'athlete')
  const [accountType, setAccountTypeState] = useState<AccountType>('athlete');
  const [userRole, setUserRoleState] = useState<UserRole>('athlete');
  const [coachProfile, setCoachProfile] = useState<CoachProfile>(initialCoachProfile);
  const [clients, setClients] = useState<ClientProfile[]>(initialClients);
  const [prescribedArchetypes, setPrescribedArchetypes] = useState<PrescribedMealArchetype[]>(initialPrescribedArchetypes);
  const [coachMeals, setCoachMeals] = useState<PrescribedMealArchetype[]>(initialPrescribedArchetypes);
  const [linkedCoach, setLinkedCoach] = useState<LinkedCoach | null>(null);
  const [trainerSubscription, setTrainerSubscription] = useState<TrainerSubscription>({
    tier: 'starter',
    seatLimit: 0,
    priceZar: 0,
    currency: 'ZAR',
    billingPeriod: 'monthly',
    status: 'canceled',
  });
  const [managedClient, setManagedClient] = useState<ClientProfile | null>(null);
  const [isViewingPersonalProfile, setIsViewingPersonalProfile] = useState<boolean>(false);
  const [athleteMembership, setAthleteMembership] = useState<AthleteMembership>({
    status: 'solo_active',
  });

  const isCoachAccount = Boolean(
    accountType === 'coach' && trainerSubscription?.status === 'active' && trainerSubscription?.tier
  );

  const setUserRole = (role: UserRole) => {
    if (role === 'coach' && accountType !== 'coach') {
      Alert.alert(
        'Coach Tier Required 🔒',
        'You are signed into an individual account. Trainer Mode requires an active Personal Trainer Plan (from R199/mo). Individual accounts cannot switch views to Trainer Mode.'
      );
      return;
    }
    setUserRoleState(role);
  };

  const setAccountType = (type: AccountType) => {
    setAccountTypeState(type);
    if (type === 'coach') {
      setTrainerSubscription(initialTrainerSubscription);
      setUserRoleState('coach');
      setLinkedCoach(null);
      setIsViewingPersonalProfile(false);
      setAthleteMembership({ status: 'free' });
    } else if (type === 'client') {
      setTrainerSubscription({
        tier: 'starter',
        seatLimit: 0,
        priceZar: 0,
        currency: 'ZAR',
        billingPeriod: 'monthly',
        status: 'canceled',
      });
      setUserRoleState('athlete');
      setAthleteMembership({ status: 'sponsored_by_coach' });
    } else {
      setTrainerSubscription({
        tier: 'starter',
        seatLimit: 0,
        priceZar: 0,
        currency: 'ZAR',
        billingPeriod: 'monthly',
        status: 'canceled',
      });
      setUserRoleState('athlete');
      setAthleteMembership({ status: 'solo_active' });
      setLinkedCoach(null);
    }
  };

  const [exercises, setExercises] = useState<Exercise[]>(DEFAULT_EXERCISES);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(initialWorkoutLogs);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>(initialNutritionLogs);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>(initialBodyMetrics);

  // Cloud Sync & Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [lastCloudSyncTimestamp, setLastCloudSyncTimestamp] = useState<number | null>(Date.now());

  const [userSchedules, setUserSchedules] = useState<Record<string, DaySchedule[]>>({
    user_alex: initialAlexSchedule,
    user_jordan: initialJordanSchedule,
  });

  // 1. Hydrate state from local storage on launch
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Ensure every installation/phone has a globally unique user ID
        const DEVICE_UID_KEY = '@ripped_unique_device_uid';
        let deviceUid = await AsyncStorage.getItem(DEVICE_UID_KEY);
        if (!deviceUid) {
          deviceUid = await AsyncStorage.getItem('@pumpd_unique_device_uid');
        }
        if (!deviceUid) {
          deviceUid = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
          await AsyncStorage.setItem(DEVICE_UID_KEY, deviceUid);
        }

        const stored = await loadStoredAppData();
        if (stored && isMounted) {
          let user = stored.currentUser || initialCurrentUser;
          if (user.id === 'user_alex') {
            user = { ...user, id: deviceUid };
          }
          setCurrentUser(user);
          if (stored.partnerUser !== undefined) setPartnerUser(stored.partnerUser);
          if (stored.activeWorkspace) {
            const ws = stored.activeWorkspace;
            setActiveWorkspace({
              ...ws,
              ownerId: ws.ownerId === 'user_alex' ? deviceUid : ws.ownerId,
              memberIds: ws.memberIds.map((m) => (m === 'user_alex' ? deviceUid : m)),
            });
          }
          if (stored.exercises && stored.exercises.length > 0) {
            const existingNames = new Set(stored.exercises.map((e) => e.name.toLowerCase().trim()));
            const missingDefaults = DEFAULT_EXERCISES.filter(
              (d) => !existingNames.has(d.name.toLowerCase().trim())
            );
            setExercises([...stored.exercises, ...missingDefaults]);
          } else {
            setExercises(DEFAULT_EXERCISES);
          }
          if (stored.splits && stored.splits.length > 0) {
            let mappedSplits = stored.splits.map((s) => (s.userId === 'user_alex' ? { ...s, userId: deviceUid } : s));

            // Purge all 360 demo / preset splits - coaches and lifters build custom splits
            const isPresetSplit = (s: Split) =>
              s.id.startsWith('preset_') ||
              s.id.startsWith('split_preset_') ||
              PRESET_SPLITS.some(
                (p) => p.name.trim().toLowerCase() === s.name.trim().toLowerCase() || p.id === s.id
              );

            let cleanedSplits = mappedSplits.filter((s) => !isPresetSplit(s));

            // Deduplicate remaining custom splits by id
            const seenSplitIds = new Set<string>();
            cleanedSplits = cleanedSplits.filter((s) => {
              if (!s.id || seenSplitIds.has(s.id)) return false;
              seenSplitIds.add(s.id);
              return true;
            });

            // Enforce hard cap of maximum 50 splits
            if (cleanedSplits.length > 50) {
              cleanedSplits = cleanedSplits.slice(0, 50);
            }

            setSplits(cleanedSplits);
            await AsyncStorage.setItem(STORAGE_KEYS.SPLITS, JSON.stringify(cleanedSplits));
            saveSplitsCloud(deviceUid, cleanedSplits).catch(() => {});
          } else {
            setSplits([]);
          }
          await AsyncStorage.setItem(`@ripped_presets_seeded_v3_${deviceUid}`, 'true');
          if (stored.workoutLogs) {
            setWorkoutLogs(stored.workoutLogs.map((l) => (l.userId === 'user_alex' ? { ...l, userId: deviceUid } : l)));
          }
          if (stored.nutritionLogs) {
            setNutritionLogs(stored.nutritionLogs.map((n) => (n.userId === 'user_alex' ? { ...n, userId: deviceUid } : n)));
          }
          if (stored.bodyMetrics) {
            setBodyMetrics(stored.bodyMetrics.map((b) => (b.userId === 'user_alex' ? { ...b, userId: deviceUid } : b)));
          }
          if (stored.userSchedules) setUserSchedules(stored.userSchedules);
          const resolvedAccountType: AccountType = stored.accountType
            ? stored.accountType
            : stored.userRole === 'coach'
            ? 'coach'
            : stored.linkedCoach || stored.athleteMembership?.status === 'sponsored_by_coach'
            ? 'client'
            : 'athlete';
          setAccountTypeState(resolvedAccountType);
          if (stored.userRole) setUserRoleState(stored.userRole);
          if (stored.coachProfile) setCoachProfile(stored.coachProfile);
          if (stored.clients !== undefined && stored.clients !== null) setClients(stored.clients);
          if (stored.prescribedArchetypes !== undefined && stored.prescribedArchetypes !== null) {
            setPrescribedArchetypes(stored.prescribedArchetypes);
            if (Array.isArray(stored.prescribedArchetypes) && stored.prescribedArchetypes.length > 0) {
              setCoachMeals(stored.prescribedArchetypes);
            }
          }
          if (stored.linkedCoach !== undefined) {
            setLinkedCoach(resolvedAccountType === 'coach' ? null : stored.linkedCoach);
          }
          if (resolvedAccountType === 'coach') {
            setTrainerSubscription(stored.trainerSubscription || initialTrainerSubscription);
          } else {
            setTrainerSubscription({
              tier: 'starter',
              seatLimit: 0,
              priceZar: 0,
              currency: 'ZAR',
              billingPeriod: 'monthly',
              status: 'canceled',
            });
          }
          if (stored.athleteMembership) {
            setAthleteMembership(stored.athleteMembership);
          } else if (stored.linkedCoach) {
            setAthleteMembership({
              status: 'sponsored_by_coach',
              coachName: stored.linkedCoach.name,
              coachBusiness: stored.linkedCoach.businessName,
            });
          }

          if (stored.activeUserId) {
            if (stored.partnerUser && stored.activeUserId === stored.partnerUser.id) {
              setActiveUser(stored.partnerUser);
            } else {
              setActiveUser(user);
            }
          } else {
            setActiveUser(user);
          }
        } else if (!stored && isMounted) {
          // Fresh install: start with a completely clean slate
          const freshUser: UserProfile = {
            id: deviceUid,
            displayName: 'Lifter',
            email: '',
            activeWorkspaceId: `ws_${deviceUid}`,
            macroTargets: { calories: 2200, protein: 160, carbs: 220, fats: 70 },
            weightUnit: 'kg',
            createdAt: Date.now(),
          };
          setCurrentUser(freshUser);
          setActiveUser(freshUser);
          setActiveWorkspace({
            id: `ws_${deviceUid}`,
            name: 'Personal Account',
            ownerId: deviceUid,
            memberIds: [deviceUid],
          });
          setSplits([]);
          setWorkoutLogs([]);
          setNutritionLogs([]);
          setBodyMetrics([]);
          setClients([]);
          setPrescribedArchetypes([]);
          setLinkedCoach(null);
          setUserSchedules({});
          setCoachProfile({
            name: 'Coach',
            businessName: '',
            instagramHandle: '',
          });
        }
      } catch (err) {
        console.error('[UserWorkspaceContext] Error hydrating local storage:', err);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Persist state to local storage whenever changed (after initial hydration - debounced 400ms)
  useEffect(() => {
    if (!isHydrated) return;

    const timer = setTimeout(() => {
      persistAppData({
        currentUser,
        partnerUser,
        activeUserId: activeUser.id,
        activeWorkspace,
        exercises,
        splits,
        workoutLogs,
        nutritionLogs,
        bodyMetrics,
        userSchedules,
        userRole,
        accountType,
        coachProfile,
        clients,
        prescribedArchetypes,
        linkedCoach,
        trainerSubscription,
        athleteMembership,
      });

      if (activeUser?.id) {
        persistUserData(activeUser.id, {
          workoutLogs,
          nutritionLogs,
          bodyMetrics,
          userRole,
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    isHydrated,
    currentUser,
    partnerUser,
    activeUser.id,
    activeWorkspace,
    exercises,
    splits,
    workoutLogs,
    nutritionLogs,
    bodyMetrics,
    userSchedules,
    userRole,
    accountType,
    coachProfile,
    clients,
    prescribedArchetypes,
    linkedCoach,
    trainerSubscription,
    athleteMembership,
  ]);

  // 3. Firebase & Local Auth Initialization & State Tracking
  useEffect(() => {
    let hasResolved = false;
    const unsub = subscribeToAuth(async (user) => {
      hasResolved = true;
      setFirebaseUser(user);
      if (user && !user.isAnonymous) {
        const userProfile: UserProfile = {
          id: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'Lifter',
          email: user.email || '',
          activeWorkspaceId: `ws_${user.uid}`,
          macroTargets: { calories: 2500, protein: 175, carbs: 260, fats: 75 },
          createdAt: Date.now(),
        };
        setCurrentUser(userProfile);
        setActiveUser(userProfile);
        setCloudSyncStatus('synced');

        // Load isolated user data and active session in parallel
        const [userData, session] = await Promise.all([
          loadUserData(user.uid),
          getActiveSession(),
        ]);

        const resolvedRole: UserRole = session?.userRole || userData?.userRole || 'athlete';
        const resolvedAccountType: AccountType = session?.accountType || (resolvedRole === 'coach' ? 'coach' : 'athlete');

        setAccountType(resolvedAccountType);
        setUserRoleState(resolvedRole);

        if (userData) {
          if (userData.workoutLogs) setWorkoutLogs(userData.workoutLogs);
          if (userData.nutritionLogs) setNutritionLogs(userData.nutritionLogs);
          if (userData.bodyMetrics) setBodyMetrics(userData.bodyMetrics);
        } else {
          // Brand new profile: zero logged data, zero active splits, clean profile
          setWorkoutLogs([]);
          setNutritionLogs([]);
          setBodyMetrics([]);
          setSplits([]);
          setUserSchedules({});
          setLinkedCoach(null);
          setClients([]);
          setPrescribedArchetypes([]);
          setCoachProfile({
            name: userProfile.displayName,
            businessName: '',
            instagramHandle: '',
          });
        }
      } else if (user && user.isAnonymous) {
        const session = await getActiveSession();
        const guestName = session?.displayName || currentUser.displayName || 'Guest Lifter';
        const guestProfile: UserProfile = {
          id: user.uid,
          displayName: guestName,
          email: 'guest@ripped.app',
          activeWorkspaceId: `ws_${user.uid}`,
          macroTargets: currentUser.macroTargets || { calories: 2500, protein: 175, carbs: 260, fats: 75 },
          weightUnit: currentUser.weightUnit || 'kg',
          createdAt: Date.now(),
        };
        setCurrentUser(guestProfile);
        setActiveUser(guestProfile);
        setCloudSyncStatus('synced');
        const resolvedRole: UserRole = session?.userRole || 'athlete';
        const resolvedAccountType: AccountType = session?.accountType || (resolvedRole === 'coach' ? 'coach' : 'athlete');
        setAccountType(resolvedAccountType);
        setUserRoleState(resolvedRole);
      } else {
        setCloudSyncStatus('offline');
      }
      setIsAuthReady(true);
    });

    // Safeguard: Ensure screen is never stuck indefinitely on splash/loading if auth delays
    const fallbackTimer = setTimeout(() => {
      if (!hasResolved) {
        setIsAuthReady(true);
      }
    }, 1200);

    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const signOut = async () => {
    try {
      if (activeUser?.id) {
        await persistUserData(activeUser.id, {
          workoutLogs,
          nutritionLogs,
          bodyMetrics,
          userRole,
        });
      }
      await signOutUser();
      setFirebaseUser(null);
      setCurrentUser(initialCurrentUser);
      setActiveUser(initialCurrentUser);
      setWorkoutLogs([]);
      setNutritionLogs([]);
      setBodyMetrics([]);
    } catch (err) {
      console.warn('[Auth] Error signing out:', err);
    }
  };

  const continueAsGuest = async (
    role: UserRole = 'athlete',
    targetAccountType: AccountType = 'athlete'
  ) => {
    try {
      setAccountType(targetAccountType);
      await signInAsGuest(role, targetAccountType);
    } catch (err) {
      console.warn('[Auth] Error signing in as guest:', err);
    }
  };

  // 4. Cloud Firestore Real-Time Sync with Local Persistent Cache
  useEffect(() => {
    if (!activeUser?.id || !isHydrated) return;

    const unsubs: (() => void)[] = [];

    // Collect all user IDs that need to be synchronized
    const syncUserIds: string[] = [currentUser.id];
    if (activeUser?.id && !syncUserIds.includes(activeUser.id)) {
      syncUserIds.push(activeUser.id);
    }
    // For coaches: subscribe to all athletes currently in the roster so solo workouts,
    // nutrition logs, and weigh-ins from clients mirror to the coach's phone live.
    if (userRole === 'coach' || isCoachAccount) {
      clients.forEach((c) => {
        if (c.id && !syncUserIds.includes(c.id)) {
          syncUserIds.push(c.id);
        }
        if (c.linkedUserId && !syncUserIds.includes(c.linkedUserId)) {
          syncUserIds.push(c.linkedUserId);
        }
      });
    }
    if (managedClient) {
      if (managedClient.id && !syncUserIds.includes(managedClient.id)) {
        syncUserIds.push(managedClient.id);
      }
      if (managedClient.linkedUserId && !syncUserIds.includes(managedClient.linkedUserId)) {
        syncUserIds.push(managedClient.linkedUserId);
      }
    }

    // Subscribe to workouts, nutrition, and metrics for all target IDs
    syncUserIds.forEach((uid) => {
      const unsubW = subscribeToWorkoutLogs(uid, (cloudLogs) => {
        if (cloudLogs.length > 0) {
          setWorkoutLogs((prev) => {
            const map = new Map<string, WorkoutLog>();
            prev.forEach((l) => map.set(l.id, l));
            cloudLogs.forEach((l) => {
              // Ensure log has its owner userId
              map.set(l.id, { ...l, userId: l.userId || uid });
            });
            return Array.from(map.values()).sort(
              (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
            );
          });
          setLastCloudSyncTimestamp(Date.now());
          setCloudSyncStatus('synced');
        }
      });
      unsubs.push(unsubW);

      const unsubN = subscribeToNutritionLogs(uid, (cloudLogs) => {
        if (cloudLogs.length > 0) {
          setNutritionLogs((prev) => {
            const map = new Map<string, NutritionLog>();
            // Key by `${userId}_${date}` to strictly avoid cross-user overwrites
            prev.forEach((l) => {
              const k = `${l.userId || 'unknown'}_${l.date}`;
              map.set(k, l);
            });
            cloudLogs.forEach((l) => {
              const logUserId = l.userId || uid;
              const k = `${logUserId}_${l.date}`;
              const existing = map.get(k);
              if (!existing) {
                map.set(k, { ...l, userId: logUserId });
              } else {
                // Merge meals avoiding duplicates
                const mealMap = new Map<string, Meal>();
                (existing.meals || []).forEach((m) => mealMap.set(m.id, m));
                (l.meals || []).forEach((m) => mealMap.set(m.id, m));
                map.set(k, {
                  ...existing,
                  ...l,
                  userId: logUserId,
                  meals: Array.from(mealMap.values()),
                  waterMl: Math.max(existing.waterMl || 0, l.waterMl || 0),
                });
              }
            });
            return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
          });
          setLastCloudSyncTimestamp(Date.now());
          setCloudSyncStatus('synced');
        }
      });
      unsubs.push(unsubN);

      const unsubM = subscribeToBodyMetrics(uid, (cloudMetrics) => {
        if (cloudMetrics.length > 0) {
          setBodyMetrics((prev) => {
            const map = new Map<string, BodyMetric>();
            prev.forEach((m) => map.set(m.id, m));
            cloudMetrics.forEach((m) => {
              map.set(m.id, { ...m, userId: m.userId || uid });
            });
            return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
          });
          setLastCloudSyncTimestamp(Date.now());
          setCloudSyncStatus('synced');
        }
      });
      unsubs.push(unsubM);
    });

    // Real-time synchronization of macro targets, coach prescriptions, splits, and membership
    const unsubProfile = subscribeToUserProfile(activeUser.id, (cloudUser) => {
      if (cloudUser) {
        if (cloudUser.macroTargets) {
          setActiveUser((prev) => ({
            ...prev,
            macroTargets: cloudUser.macroTargets,
          }));
          if (activeUser.id === currentUser.id) {
            setCurrentUser((prev) => ({
              ...prev,
              macroTargets: cloudUser.macroTargets,
            }));
          }
        }
        if (Array.isArray(cloudUser.prescribedArchetypes)) {
          setPrescribedArchetypes(cloudUser.prescribedArchetypes);
        }
        if (Array.isArray(cloudUser.weeklySchedule) && cloudUser.weeklySchedule.length > 0) {
          setUserSchedules((prev) => ({
            ...prev,
            [activeUser.id]: cloudUser.weeklySchedule,
          }));
        }
        if (Array.isArray(cloudUser.splits) && cloudUser.splits.length > 0) {
          setSplits((prev) => {
            const others = prev.filter((s) => s.userId !== activeUser.id);
            // Ensure at most ONE split is active to prevent bouncing
            let activeFound = false;
            const sanitizedCloudSplits = cloudUser.splits.map((s: Split) => {
              if (s.isActive) {
                if (!activeFound) {
                  activeFound = true;
                  return s;
                }
                return { ...s, isActive: false };
              }
              return s;
            });
            return [...sanitizedCloudSplits, ...others];
          });
        }
        if (cloudUser.linkedCoach !== undefined) {
          setLinkedCoach(cloudUser.linkedCoach);
        }
        if (cloudUser.athleteMembership !== undefined) {
          setAthleteMembership(cloudUser.athleteMembership);
        }
      }
    });
    unsubs.push(unsubProfile);

    // If athlete is linked to a coach, subscribe to the coach's roster document in real time!
    if (linkedCoach?.coachId) {
      const unsubCoachForAthlete = subscribeToCoachData(linkedCoach.coachId, (coachData) => {
        if (coachData && Array.isArray(coachData.clients)) {
          const myClientEntry = coachData.clients.find(
            (c) =>
              (c.linkedUserId && c.linkedUserId === activeUser.id) ||
              (c.email && activeUser.email && c.email.toLowerCase() === activeUser.email.toLowerCase())
          );
          if (myClientEntry) {
            if (Array.isArray(myClientEntry.prescribedArchetypes)) {
              setPrescribedArchetypes(myClientEntry.prescribedArchetypes);
            }
            if (myClientEntry.macroTargets) {
              setActiveUser((prev) => ({ ...prev, macroTargets: myClientEntry.macroTargets }));
              setCurrentUser((prev) => ({ ...prev, macroTargets: myClientEntry.macroTargets }));
            }
            if (myClientEntry.assignedSplitName) {
              setSplits((prev) =>
                prev.map((s) =>
                  s.userId === activeUser.id && s.isActive
                    ? { ...s, name: myClientEntry.assignedSplitName! }
                    : s
                )
              );
            }
          }
        }
      });
      unsubs.push(unsubCoachForAthlete);
    }

    // For coaches: Real-time synchronization of client roster from Firestore
    if (userRole === 'coach' || isCoachAccount) {
      const unsubCoach = subscribeToCoachData(currentUser.id, (cloudData) => {
        if (cloudData && Array.isArray(cloudData.clients)) {
          setClients((prev) => {
            const clientMap = new Map<string, ClientProfile>();
            prev.forEach((c) => clientMap.set(c.id, c));
            cloudData.clients!.forEach((cloudClient) => {
              const existing = clientMap.get(cloudClient.id);
              if (!existing) {
                clientMap.set(cloudClient.id, cloudClient);
              } else {
                clientMap.set(cloudClient.id, {
                  ...existing,
                  ...cloudClient,
                  linkedUserId: cloudClient.linkedUserId || existing.linkedUserId,
                  type: cloudClient.type || existing.type,
                  status: cloudClient.status || existing.status,
                });
              }
            });
            return Array.from(clientMap.values());
          });

          // If currently managing a client, keep managedClient & activeUser in sync with incoming coach updates!
          if (managedClient) {
            const updated = cloudData.clients.find((c) => c.id === managedClient.id);
            if (updated) {
              setManagedClient(updated);
              if (updated.linkedUserId && activeUser.id !== updated.linkedUserId) {
                setActiveUser((prev) => ({ ...prev, id: updated.linkedUserId! }));
              }
              if (Array.isArray(updated.prescribedArchetypes)) {
                setPrescribedArchetypes(updated.prescribedArchetypes);
              }
              if (updated.macroTargets) {
                setActiveUser((prev) => ({ ...prev, macroTargets: updated.macroTargets }));
              }
            }
          }
        }
      });
      unsubs.push(unsubCoach);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [
    activeUser.id,
    activeUser.email,
    isHydrated,
    userRole,
    isCoachAccount,
    currentUser.id,
    managedClient?.id,
    managedClient?.linkedUserId,
    linkedCoach?.coachId,
    clients.map((c) => `${c.id}_${c.linkedUserId || ''}`).join(','),
  ]);

  // 5. Ensure all active shadow clients have valid tokens published to Cloud Firestore
  useEffect(() => {
    if (!isHydrated) return;
    if (userRole !== 'coach' && !isCoachAccount) return;
    if (!currentUser?.id) return;

    const coachDisplayName = coachProfile.name || currentUser.displayName || 'Coach';
    let hasUpdates = false;
    const updatedClients = clients.map((client) => {
      if (client.type !== 'linked' && client.status === 'active') {
        const token =
          client.claimToken && client.claimToken.expiresAt > Date.now()
            ? client.claimToken
            : generateClaimToken(client, coachDisplayName);

        if (!client.claimToken || client.claimToken.expiresAt <= Date.now()) {
          hasUpdates = true;
        }

        // Publish to cloud so any device can claim it immediately
        publishClientClaimCloud(
          token,
          client,
          currentUser.id,
          coachDisplayName,
          coachProfile,
          workoutLogs,
          nutritionLogs,
          bodyMetrics,
          splits
        ).catch(() => {});

        return { ...client, claimToken: token };
      }
      return client;
    });

    if (hasUpdates) {
      setClients(updatedClients);
      saveClientsCloud(currentUser.id, updatedClients).catch(() => {});
    }
  }, [isHydrated, userRole, isCoachAccount, currentUser?.id, clients.length]);

  const syncAllToCloud = async () => {
    setCloudSyncStatus('syncing');
    try {
      await saveUserProfileCloud(activeUser.id, {
        displayName: activeUser.displayName,
        email: activeUser.email,
        macroTargets: activeUser.macroTargets,
      });
      await saveCoachProfileCloud(activeUser.id, coachProfile);
      await saveClientsCloud(activeUser.id, clients);
      await saveSplitsCloud(activeUser.id, splits);
      await savePrescribedArchetypesCloud(activeUser.id, prescribedArchetypes);
      for (const log of workoutLogs.filter((l) => l.userId === activeUser.id)) {
        await saveWorkoutLogCloud(activeUser.id, log);
      }
      for (const nLog of nutritionLogs.filter((l) => l.userId === activeUser.id)) {
        await saveNutritionLogCloud(activeUser.id, nLog);
      }
      for (const metric of bodyMetrics.filter((m) => m.userId === activeUser.id)) {
        await saveBodyMetricCloud(activeUser.id, metric);
      }
      setLastCloudSyncTimestamp(Date.now());
      setCloudSyncStatus('synced');
    } catch (e) {
      console.warn('Manual cloud sync failed:', e);
      setCloudSyncStatus('offline');
    }
  };

  const activeWeeklySchedule = userSchedules[activeUser.id] || initialAlexSchedule;

  const updateDaySchedule = (
    day: DayOfWeek,
    routineId: string,
    routineName: string,
    exerciseIds: string[] = []
  ) => {
    setUserSchedules((prev) => {
      const current = prev[activeUser.id] || initialAlexSchedule;
      const updated = current.map((item) =>
        item.day === day
          ? { ...item, routineId, routineName, exerciseIds }
          : item
      );
      return { ...prev, [activeUser.id]: updated };
    });
  };

  const shiftSplitSchedule = (fromDay: DayOfWeek) => {
    setUserSchedules((prev) => {
      const current = prev[activeUser.id] || initialAlexSchedule;
      const fromIdx = DAYS_OF_WEEK.indexOf(fromDay);
      if (fromIdx === -1) return prev;

      const updated = [...current];
      const routinesToShift = updated.slice(fromIdx).map((item) => ({
        routineId: item.routineId,
        routineName: item.routineName,
        exerciseIds: item.exerciseIds,
      }));

      // Set fromDay to rest
      updated[fromIdx] = {
        ...updated[fromIdx],
        routineId: 'rest',
        routineName: 'Rest Day',
        exerciseIds: [],
      };

      // Shift subsequent routines forward by 1 day
      for (let i = fromIdx + 1; i < DAYS_OF_WEEK.length; i++) {
        const shiftedItem = routinesToShift[i - (fromIdx + 1)];
        updated[i] = {
          ...updated[i],
          routineId: shiftedItem.routineId,
          routineName: shiftedItem.routineName,
          exerciseIds: shiftedItem.exerciseIds,
        };
      }

      return { ...prev, [activeUser.id]: updated };
    });
  };

  const switchActiveUser = (userId: string) => {
    if (userId === currentUser.id) {
      setActiveUser(currentUser);
    } else if (partnerUser && userId === partnerUser.id) {
      setActiveUser(partnerUser);
    }
  };

  const startManagingClient = (client: ClientProfile) => {
    const freshClient = clients.find((c) => c.id === client.id) || client;
    const clientUserId = freshClient.linkedUserId || freshClient.id;
    const clientUserProfile: UserProfile = {
      id: clientUserId,
      displayName: freshClient.name,
      email: freshClient.email || `${freshClient.name.toLowerCase().replace(/\s+/g, '.')}@athlete.ripped.app`,
      activeWorkspaceId: activeWorkspace.id,
      macroTargets: freshClient.macroTargets || { calories: 2500, protein: 180, carbs: 250, fats: 70 },
      weightUnit: 'kg',
      createdAt: freshClient.createdAt || Date.now(),
    };

    setManagedClient(freshClient);
    setIsViewingPersonalProfile(false);
    setActiveUser(clientUserProfile);
    setPrescribedArchetypes(freshClient.prescribedArchetypes || []);

    // Ensure client has an active split in splits
    setSplits((prev) => {
      const existingClientSplits = prev.filter((s) => s.userId === clientUserId);
      if (existingClientSplits.length > 0) {
        return prev.map((s) => {
          if (s.userId === clientUserId) {
            const isTarget = s.isActive || s.id === existingClientSplits[0].id;
            if (isTarget) {
              return {
                ...s,
                isActive: true,
                name: freshClient.assignedSplitName || s.name,
              };
            }
          }
          return s;
        });
      }

      // No splits exist for this client yet: build one from assignedRoutineIds or defaults
      const assignedRoutines: Routine[] = [];
      if (freshClient.assignedRoutineIds && freshClient.assignedRoutineIds.length > 0) {
        freshClient.assignedRoutineIds.forEach((rId, idx) => {
          let foundRoutine: Routine | null = null;
          for (const s of prev) {
            const found = s.routines.find((r) => r.id === rId);
            if (found) {
              foundRoutine = { ...found, id: `r_${clientUserId}_${idx + 1}` };
              break;
            }
          }
          if (foundRoutine) {
            assignedRoutines.push(foundRoutine);
          } else {
            assignedRoutines.push({
              id: `r_${clientUserId}_${idx + 1}`,
              name: freshClient.assignedRoutineNames[idx] || `Workout Day ${idx + 1}`,
              exerciseIds: ['ex_1', 'ex_2', 'ex_13'],
            });
          }
        });
      }

      if (assignedRoutines.length === 0) {
        assignedRoutines.push(
          {
            id: `r_${clientUserId}_push`,
            name: 'Push Day (Chest, Shoulders, Triceps)',
            exerciseIds: ['ex_1', 'ex_2', 'ex_13', 'ex_14', 'ex_18'],
          },
          {
            id: `r_${clientUserId}_pull`,
            name: 'Pull Day (Back & Biceps)',
            exerciseIds: ['ex_4', 'ex_5', 'ex_6', 'ex_16', 'ex_17'],
          },
          {
            id: `r_${clientUserId}_legs`,
            name: 'Leg Day (Quads, Hamstrings, Calves)',
            exerciseIds: ['ex_8', 'ex_9', 'ex_11', 'ex_12', 'ex_20'],
          }
        );
      }

      const newClientSplit: Split = {
        id: `split_${clientUserId}_active`,
        userId: clientUserId,
        name: freshClient.assignedSplitName || (freshClient.assignedRoutineNames.length > 0 ? 'Push / Pull / Legs (PPL)' : 'Custom Program'),
        isActive: true,
        routines: assignedRoutines,
      };

      return [newClientSplit, ...prev];
    });

    // Ensure client has a weekly schedule
    setUserSchedules((prev) => {
      if (prev[clientUserId]) return prev;
      return {
        ...prev,
        [clientUserId]: [
          { day: 'Monday', routineId: `r_${clientUserId}_push`, routineName: 'Push Day', exerciseIds: ['ex_1', 'ex_2', 'ex_13'] },
          { day: 'Tuesday', routineId: `r_${clientUserId}_pull`, routineName: 'Pull Day', exerciseIds: ['ex_4', 'ex_5', 'ex_6'] },
          { day: 'Wednesday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
          { day: 'Thursday', routineId: `r_${clientUserId}_legs`, routineName: 'Leg Day', exerciseIds: ['ex_8', 'ex_9', 'ex_11'] },
          { day: 'Friday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
          { day: 'Saturday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
          { day: 'Sunday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
        ],
      };
    });
  };

  const stopManagingClient = () => {
    setManagedClient(null);
    setIsViewingPersonalProfile(false);
    setActiveUser(currentUser);
    setPrescribedArchetypes(currentUser.prescribedArchetypes || coachMeals || []);
  };

  const enterPersonalAthleteMode = () => {
    setManagedClient(null);
    setActiveUser(currentUser);
    setIsViewingPersonalProfile(true);
    setUserRoleState('athlete');
    setPrescribedArchetypes(currentUser.prescribedArchetypes || coachMeals || []);
  };

  const exitPersonalAthleteMode = () => {
    setIsViewingPersonalProfile(false);
    if (accountType === 'coach') {
      setUserRoleState('coach');
    }
  };

  const addExercise = (newEx: Omit<Exercise, 'id'>): Exercise => {
    const exercise: Exercise = {
      ...newEx,
      id: `ex_custom_${Date.now()}`,
    };
    setExercises((prev) => [exercise, ...prev]);
    return exercise;
  };

  const updateExercise = (updatedEx: Exercise) => {
    setExercises((prev) => prev.map((e) => (e.id === updatedEx.id ? updatedEx : e)));
  };

  const deleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const toggleStarExercise = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, isStarred: !e.isStarred } : e))
    );
  };

  const addSplit = (newSplit: Omit<Split, 'id'>): Split => {
    const targetUserId = newSplit.userId || (managedClient ? (managedClient.linkedUserId || managedClient.id) : activeUser.id);

    // Hard cap at 50 splits per coach / user
    const existingSplitsForTarget = splits.filter((s) => s.userId === targetUserId);
    if (existingSplitsForTarget.length >= 50) {
      Alert.alert(
        'Split Limit Reached (50/50)',
        'You have reached the maximum allowed limit of 50 workout splits. Please delete an unused split before creating a new one.',
        [{ text: 'OK' }]
      );
      return {
        ...newSplit,
        id: `limit_reached_${Date.now()}`,
        userId: targetUserId,
      };
    }

    const split: Split = {
      ...newSplit,
      userId: targetUserId,
      id: `split_${Date.now()}`,
    };

    // Synchronously compute the full next splits array
    const nextSplits = [
      split,
      ...splits.map((s) =>
        split.isActive && (s.userId === targetUserId || s.userId === split.userId)
          ? { ...s, isActive: false }
          : s
      ),
    ];

    setSplits(nextSplits);

    if (managedClient && (targetUserId === managedClient.id || targetUserId === managedClient.linkedUserId)) {
      const routineIds = split.routines.map((r) => r.id);
      const routineNames = split.routines.map((r) => r.name);
      const updatedClients = clients.map((c) =>
        c.id === managedClient.id
          ? { ...c, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: split.name }
          : c
      );
      setClients(updatedClients);
      saveClientsCloud(currentUser.id, updatedClients).catch(() => {});
      setManagedClient((prev) =>
        prev
          ? { ...prev, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: split.name }
          : null
      );

      const targetIds = [managedClient.id];
      if (managedClient.linkedUserId && managedClient.linkedUserId !== managedClient.id) {
        targetIds.push(managedClient.linkedUserId);
      }
      const clientSplitIds = new Set(targetIds);
      const allClientSplits = nextSplits.filter((s) => clientSplitIds.has(s.userId));
      targetIds.forEach((uid) => {
        saveSplitsCloud(uid, allClientSplits.length > 0 ? allClientSplits : [split]).catch(() => {});
      });
    } else {
      const allForUser = nextSplits.filter((s) => s.userId === targetUserId);
      saveSplitsCloud(targetUserId, allForUser.length > 0 ? allForUser : [split]).catch(() => {});
    }

    return split;
  };

  const updateSplit = (updatedSplit: Split) => {
    const targetUserId = updatedSplit.userId || (managedClient ? (managedClient.linkedUserId || managedClient.id) : activeUser.id);
    const isActivating = Boolean(updatedSplit.isActive);

    const nextSplits = splits.map((s) => {
      if (s.id === updatedSplit.id) {
        return { ...updatedSplit, userId: targetUserId };
      }
      if (isActivating && (s.userId === targetUserId || s.userId === updatedSplit.userId)) {
        return { ...s, isActive: false };
      }
      return s;
    });

    setSplits(nextSplits);

    if (managedClient && (targetUserId === managedClient.id || targetUserId === managedClient.linkedUserId)) {
      if (isActivating) {
        const routineIds = updatedSplit.routines.map((r) => r.id);
        const routineNames = updatedSplit.routines.map((r) => r.name);
        const updatedClients = clients.map((c) =>
          c.id === managedClient.id
            ? { ...c, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: updatedSplit.name }
            : c
        );
        setClients(updatedClients);
        saveClientsCloud(currentUser.id, updatedClients).catch(() => {});
        setManagedClient((prev) =>
          prev
            ? { ...prev, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: updatedSplit.name }
            : null
        );
      }

      const targetIds = [managedClient.id];
      if (managedClient.linkedUserId && managedClient.linkedUserId !== managedClient.id) {
        targetIds.push(managedClient.linkedUserId);
      }
      const clientSplitIds = new Set(targetIds);
      const allClientSplits = nextSplits.filter((s) => clientSplitIds.has(s.userId));
      targetIds.forEach((uid) => {
        saveSplitsCloud(uid, allClientSplits.length > 0 ? allClientSplits : [{ ...updatedSplit, userId: uid }]).catch(() => {});
      });
    } else {
      const allUserSplits = nextSplits.filter((s) => s.userId === targetUserId);
      saveSplitsCloud(targetUserId, allUserSplits.length > 0 ? allUserSplits : [updatedSplit]).catch(() => {});
    }
  };

  const setActiveSplit = (splitId: string) => {
    const targetUserId = managedClient
      ? (managedClient.linkedUserId || managedClient.id)
      : activeUser.id;

    const nextSplits = splits.map((s) => {
      const isForThisUser =
        s.userId === targetUserId ||
        (managedClient && (s.userId === managedClient.id || s.userId === managedClient.linkedUserId)) ||
        (!s.userId && targetUserId === activeUser.id);

      if (!isForThisUser) return s;

      if (s.id === splitId) {
        return { ...s, userId: targetUserId, isActive: true };
      }
      return { ...s, isActive: false };
    });

    setSplits(nextSplits);

    const activeSplitObj = nextSplits.find((s) => s.id === splitId);

    if (managedClient && activeSplitObj) {
      const routineIds = activeSplitObj.routines.map((r) => r.id);
      const routineNames = activeSplitObj.routines.map((r) => r.name);
      const updatedClients = clients.map((c) =>
        c.id === managedClient.id
          ? { ...c, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: activeSplitObj.name }
          : c
      );
      setClients(updatedClients);
      saveClientsCloud(currentUser.id, updatedClients).catch(() => {});
      setManagedClient((prev) =>
        prev
          ? { ...prev, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames, assignedSplitName: activeSplitObj.name }
          : null
      );

      const targetIds = [managedClient.id];
      if (managedClient.linkedUserId && managedClient.linkedUserId !== managedClient.id) {
        targetIds.push(managedClient.linkedUserId);
      }
      const clientSplitIds = new Set(targetIds);
      const allClientSplits = nextSplits.filter((s) => clientSplitIds.has(s.userId));
      targetIds.forEach((uid) => {
        saveSplitsCloud(uid, allClientSplits.length > 0 ? allClientSplits : [activeSplitObj]).catch(() => {});
      });
    } else {
      const allUserSplits = nextSplits.filter((s) => s.userId === targetUserId);
      saveSplitsCloud(targetUserId, allUserSplits.length > 0 ? allUserSplits : (activeSplitObj ? [activeSplitObj] : [])).catch(() => {});
    }
  };

  const deleteSplit = (splitId: string) => {
    const splitToDelete = splits.find((s) => s.id === splitId);
    if (!splitToDelete) return;

    const routineIdsToDelete = new Set(splitToDelete.routines.map((r) => r.id));

    // 1. Delete split and promote another split to active if the deleted split was active
    setSplits((prev) => {
      const remaining = prev.filter((s) => s.id !== splitId);
      if (splitToDelete.isActive) {
        const remainingUserSplits = remaining.filter((s) => s.userId === splitToDelete.userId);
        if (remainingUserSplits.length > 0) {
          const firstRemainingId = remainingUserSplits[0].id;
          const updated = remaining.map((s) =>
            s.id === firstRemainingId ? { ...s, isActive: true } : s
          );
          saveSplitsCloud(splitToDelete.userId, updated.filter((s) => s.userId === splitToDelete.userId)).catch(() => {});
          return updated;
        }
      }
      saveSplitsCloud(splitToDelete.userId, remaining.filter((s) => s.userId === splitToDelete.userId)).catch(() => {});
      return remaining;
    });

    // 2. Cascade cleanup on userSchedules
    // Reset any day referencing a deleted routine to 'rest'
    setUserSchedules((prev) => {
      const currentSched = prev[splitToDelete.userId] || [];
      const cleanedSched = currentSched.map((dayItem: DaySchedule) => {
        if (routineIdsToDelete.has(dayItem.routineId)) {
          return {
            day: dayItem.day,
            routineId: 'rest',
            routineName: 'Rest Day',
            exerciseIds: [],
          };
        }
        return dayItem;
      });
      return { ...prev, [splitToDelete.userId]: cleanedSched };
    });
  };

  const toggleStarSplit = (splitId: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.id === splitId ? { ...s, isStarred: !s.isStarred } : s))
    );
  };

  const restoreDefaultSplits = () => {
    // Only restores a clean starter split if user has zero splits, strictly capped at 50
    setSplits((prev) => {
      const userSplits = prev.filter((s) => s.userId === activeUser.id);
      if (userSplits.length >= 50) {
        Alert.alert('Split Limit Reached', 'You have reached the maximum allowed limit of 50 workout splits.');
        return prev;
      }
      const starterSplit = buildSplitFromPreset(PRESET_SPLITS[0], activeUser.id, exercises, true);
      const otherSplits = prev.filter((s) => s.userId !== activeUser.id);
      const next = [starterSplit, ...userSplits, ...otherSplits].slice(0, 50);
      saveSplitsCloud(activeUser.id, next.filter((s) => s.userId === activeUser.id)).catch(() => {});
      return next;
    });
  };

  const clearAllCoachSplits = () => {
    const targetUserId = activeWorkspace.ownerId || activeUser.id;
    setSplits((prev) => {
      const remaining = prev.filter((s) => s.userId !== targetUserId);
      AsyncStorage.setItem(STORAGE_KEYS.SPLITS, JSON.stringify(remaining)).catch(() => {});
      saveSplitsCloud(targetUserId, []).catch(() => {});
      return remaining;
    });
    setUserSchedules((prev) => ({
      ...prev,
      [targetUserId]: [],
    }));
  };

  const removeExerciseFromRoutine = (splitId: string, routineId: string, exerciseId: string) => {
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id !== splitId) return s;
        return {
          ...s,
          routines: s.routines.map((r) => {
            if (r.id !== routineId) return r;
            return {
              ...r,
              exerciseIds: r.exerciseIds.filter((id) => id !== exerciseId),
            };
          }),
        };
      })
    );

    // Also update userSchedules if this routine is currently active on any day
    setUserSchedules((prev) => {
      let changed = false;
      const next: Record<string, DaySchedule[]> = {};
      for (const [userId, sched] of Object.entries(prev)) {
        next[userId] = sched.map((dayItem: DaySchedule) => {
          if (dayItem.routineId === routineId && dayItem.exerciseIds) {
            changed = true;
            return {
              ...dayItem,
              exerciseIds: dayItem.exerciseIds.filter((id: string) => id !== exerciseId),
            };
          }
          return dayItem;
        });
      }
      return changed ? next : prev;
    });
  };

  const saveWorkoutLog = (newLog: Omit<WorkoutLog, 'id'>): WorkoutLog => {
    const isCoaching = managedClient !== null;
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];
    const primaryTargetId = managedClient
      ? (managedClient.linkedUserId || managedClient.id)
      : (newLog.userId || activeUser.id);

    const log: WorkoutLog = {
      ...newLog,
      id: `log_${Date.now()}`,
      userId: primaryTargetId,
      loggedBy: isCoaching ? 'coach' : newLog.loggedBy || 'athlete',
      coachId: isCoaching ? currentUser.id : newLog.coachId,
      coachName: isCoaching ? coachProfile.name || currentUser.displayName : newLog.coachName,
    };
    setWorkoutLogs((prev) => [log, ...prev]);

    // Save to all target user IDs in Firestore (shadow client ID and linked athlete ID)
    targetUserIds.forEach((uid) => {
      saveWorkoutLogCloud(uid, { ...log, userId: uid }).catch(() => {});
    });

    // If coaching, update client's lastSessionDate in roster
    if (isCoaching && managedClient) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === managedClient.id ? { ...c, lastSessionDate: log.date } : c
        )
      );
      saveClientsCloud(
        currentUser.id,
        clients.map((c) => (c.id === managedClient.id ? { ...c, lastSessionDate: log.date } : c))
      ).catch(() => {});
    }

    // If athlete is logging on their own device and linked to a coach, update coach's client roster in real time
    if (!isCoaching && linkedCoach?.coachId) {
      updateCoachClientLastSessionCloud(
        linkedCoach.coachId,
        activeUser.id,
        activeUser.email,
        log.date
      ).catch(() => {});
    }

    return log;
  };

  const deleteWorkoutLog = (logId: string) => {
    setWorkoutLogs((prev) => prev.filter((l) => l.id !== logId));
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];

    targetUserIds.forEach((uid) => {
      deleteWorkoutLogCloud(uid, logId).catch(() => {});
    });
  };

  const saveNutritionMeal = (date: string, mealData: Omit<Meal, 'id'>) => {
    const meal: Meal = {
      ...mealData,
      id: `meal_${Date.now()}`,
      timestamp: Date.now(),
    };

    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];
    const primaryTargetId = managedClient
      ? (managedClient.linkedUserId || managedClient.id)
      : activeUser.id;

    setNutritionLogs((prev) => {
      const existingLogIndex = prev.findIndex(
        (l) => targetUserIds.includes(l.userId) && l.date === date
      );

      let targetLog: NutritionLog;
      let updated: NutritionLog[];

      if (existingLogIndex >= 0) {
        updated = [...prev];
        const currentLog = updated[existingLogIndex];
        targetLog = {
          ...currentLog,
          userId: primaryTargetId,
          meals: [...currentLog.meals, meal],
        };
        updated[existingLogIndex] = targetLog;
      } else {
        targetLog = {
          id: `nut_${primaryTargetId}_${date}`,
          userId: primaryTargetId,
          date,
          meals: [meal],
        };
        updated = [targetLog, ...prev];
      }

      targetUserIds.forEach((uid) => {
        saveNutritionLogCloud(uid, { ...targetLog, userId: uid }).catch(() => {});
      });

      return updated;
    });
  };

  const deleteNutritionMeal = (date: string, mealId: string) => {
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];

    setNutritionLogs((prev) =>
      prev.map((l) => {
        if (targetUserIds.includes(l.userId) && l.date === date) {
          targetUserIds.forEach((uid) => {
            deleteNutritionMealCloud(uid, date, mealId, l).catch(() => {});
          });
          return {
            ...l,
            meals: l.meals.filter((m) => m.id !== mealId),
          };
        }
        return l;
      })
    );
  };

  const clearNutritionDay = (date: string) => {
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];

    setNutritionLogs((prev) =>
      prev.map((l) => {
        if (targetUserIds.includes(l.userId) && l.date === date) {
          return {
            ...l,
            meals: [],
          };
        }
        return l;
      })
    );
    const targetLog = nutritionLogs.find((l) => targetUserIds.includes(l.userId) && l.date === date);
    if (targetLog) {
      targetUserIds.forEach((uid) => {
        saveNutritionLogCloud(uid, { ...targetLog, userId: uid, meals: [] }).catch(() => {});
      });
    }
  };

  const updateMacroTargets = (newTargets: MacroTargets) => {
    const updatedUser = { ...activeUser, macroTargets: newTargets };
    setActiveUser(updatedUser);
    if (activeUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
    } else if (partnerUser && activeUser.id === partnerUser.id) {
      setPartnerUser(updatedUser);
    }
    if (managedClient) {
      setClients((prev) => {
        const updated = prev.map((c) => (c.id === managedClient.id ? { ...c, macroTargets: newTargets } : c));
        saveClientsCloud(currentUser.id, updated).catch(() => {});
        return updated;
      });
      setManagedClient((prev) => (prev ? { ...prev, macroTargets: newTargets } : null));
      if (managedClient.linkedUserId) {
        saveUserProfileCloud(managedClient.linkedUserId, { macroTargets: newTargets }).catch(() => {});
      }
      saveUserProfileCloud(managedClient.id, { macroTargets: newTargets }).catch(() => {});
    } else {
      saveUserProfileCloud(activeUser.id, { macroTargets: newTargets }).catch(() => {});
    }
  };

  const updateUserName = (userId: string, newDisplayName: string) => {
    const trimmed = newDisplayName.trim();
    if (!trimmed) return;
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, displayName: trimmed }));
    }
    if (partnerUser && partnerUser.id === userId) {
      setPartnerUser((prev) => (prev ? { ...prev, displayName: trimmed } : null));
    }
    if (activeUser.id === userId) {
      setActiveUser((prev) => ({ ...prev, displayName: trimmed }));
    }
    saveUserProfileCloud(userId, { displayName: trimmed }).catch(() => {});
  };

  const updateWeightUnit = (unit: WeightUnit) => {
    const updatedUser = { ...activeUser, weightUnit: unit };
    setActiveUser(updatedUser);
    if (activeUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
    } else if (partnerUser && activeUser.id === partnerUser.id) {
      setPartnerUser(updatedUser);
    }
    saveUserProfileCloud(activeUser.id, { weightUnit: unit }).catch(() => {});
  };

  const saveWaterIntake = (date: string, amountMl: number) => {
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];
    const primaryTargetId = managedClient
      ? (managedClient.linkedUserId || managedClient.id)
      : activeUser.id;

    setNutritionLogs((prev) => {
      const existingLogIndex = prev.findIndex(
        (l) => targetUserIds.includes(l.userId) && l.date === date
      );

      let targetLog: NutritionLog;
      let updated: NutritionLog[];

      if (existingLogIndex >= 0) {
        updated = [...prev];
        const currentLog = updated[existingLogIndex];
        targetLog = {
          ...currentLog,
          userId: primaryTargetId,
          waterMl: Math.max(0, amountMl),
        };
        updated[existingLogIndex] = targetLog;
      } else {
        targetLog = {
          id: `nut_${primaryTargetId}_${date}`,
          userId: primaryTargetId,
          date,
          meals: [],
          waterMl: Math.max(0, amountMl),
        };
        updated = [targetLog, ...prev];
      }

      targetUserIds.forEach((uid) => {
        saveNutritionLogCloud(uid, { ...targetLog, userId: uid }).catch(() => {});
      });
      return updated;
    });
  };

  const addBodyMetric = (
    weightKg: number,
    bodyFatPercentage?: number,
    skeletalMuscleMassKg?: number,
    date: string = todayStr
  ) => {
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];
    const primaryTargetId = managedClient
      ? (managedClient.linkedUserId || managedClient.id)
      : activeUser.id;

    const metric: BodyMetric = {
      id: `bm_${Date.now()}`,
      userId: primaryTargetId,
      date,
      weightKg,
      bodyFatPercentage,
      skeletalMuscleMassKg,
    };
    setBodyMetrics((prev) => [metric, ...prev]);

    targetUserIds.forEach((uid) => {
      saveBodyMetricCloud(uid, { ...metric, userId: uid }).catch(() => {});
    });
  };

  const deleteBodyMetric = (metricId: string) => {
    setBodyMetrics((prev) => prev.filter((m) => m.id !== metricId));
    const targetUserIds: string[] = managedClient
      ? ([managedClient.id, managedClient.linkedUserId].filter(Boolean) as string[])
      : [activeUser.id];

    targetUserIds.forEach((uid) => {
      deleteBodyMetricCloud(uid, metricId).catch(() => {});
    });
  };

  const linkPartnerUser = (partnerName: string, partnerEmail: string) => {
    const newPartner: UserProfile = {
      id: `user_partner_${Date.now()}`,
      displayName: partnerName,
      email: partnerEmail,
      activeWorkspaceId: activeWorkspace.id,
      macroTargets: { calories: 2200, protein: 150, carbs: 220, fats: 65 },
      createdAt: Date.now(),
    };
    setPartnerUser(newPartner);
    setActiveWorkspace((prev) => ({
      ...prev,
      memberIds: [...prev.memberIds, newPartner.id],
    }));
  };

  const updateCoachProfile = (profileUpdates: Partial<CoachProfile>) => {
    setCoachProfile((prev) => ({ ...prev, ...profileUpdates }));
  };

  const activeSeatsUsed = clients.filter((c) => c.status === 'active').length;

  const addClient = (newClient: Omit<ClientProfile, 'id' | 'createdAt'>): ClientProfile => {
    const coachDisplayName = coachProfile.name || currentUser.displayName || 'Coach';
    const clientId = `client_${Date.now()}`;
    const initialClient: ClientProfile = {
      ...newClient,
      id: clientId,
      type: newClient.type || 'shadow',
      status: newClient.status || 'active',
      createdAt: Date.now(),
    };
    const token = newClient.claimToken || generateClaimToken(initialClient, coachDisplayName);
    const client: ClientProfile = {
      ...initialClient,
      claimToken: token,
    };

    setClients((prev) => [client, ...prev]);

    // Save roster to cloud
    saveClientsCloud(currentUser.id, [client, ...clients]).catch(() => {});

    // Publish claim token to Cloud Firestore immediately so it is claimable cross-device right away
    publishClientClaimCloud(
      token,
      client,
      currentUser.id,
      coachDisplayName,
      coachProfile,
      workoutLogs,
      nutritionLogs,
      bodyMetrics,
      splits
    ).catch((err) => {
      console.warn('[UserWorkspaceContext] Auto-publish new client claim error:', err);
    });

    return client;
  };

  const updateClient = (client: ClientProfile) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === client.id ? client : c));
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });
    if (managedClient && managedClient.id === client.id) {
      setManagedClient(client);
      if (client.macroTargets) {
        setActiveUser((prev) => ({ ...prev, macroTargets: client.macroTargets }));
      }
    }
    // If linked athlete, mirror macro targets and prescribed archetypes to athlete document
    const targetUserId = client.linkedUserId;
    if (targetUserId) {
      saveUserProfileCloud(targetUserId, {
        macroTargets: client.macroTargets,
        prescribedArchetypes: client.prescribedArchetypes,
      }).catch(() => {});
    }
  };

  const deleteClient = (clientId: string) => {
    const target = clients.find((c) => c.id === clientId);
    if (managedClient && managedClient.id === clientId) {
      stopManagingClient();
    }
    setClients((prev) => {
      const updated = prev.filter((c) => c.id !== clientId);
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });
    if (target?.linkedUserId) {
      saveUserProfileCloud(target.linkedUserId, {
        linkedCoach: null,
        athleteMembership: { status: 'solo_active' },
      }).catch(() => {});
    }
  };

  const unlinkClient = (clientId: string) => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return;

    const updatedClients = clients.map((c) =>
      c.id === clientId
        ? {
            ...c,
            type: 'shadow' as const,
            linkedUserId: undefined,
            linkedAt: undefined,
            claimToken: undefined,
          }
        : c
    );
    setClients(updatedClients);
    saveClientsCloud(currentUser.id, updatedClients).catch(() => {});
    unlinkClientInCoachRosterCloud(currentUser.id, clientId, target.linkedUserId).catch(() => {});
    if (managedClient && managedClient.id === clientId) {
      setManagedClient({
        ...target,
        type: 'shadow',
        linkedUserId: undefined,
        linkedAt: undefined,
        claimToken: undefined,
      });
    }
  };

  const archiveClient = (clientId: string) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, status: 'archived' as const } : c));
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });
  };

  const graduateClient = (clientId: string) => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return;

    const updatedClients = clients.map((c) =>
      c.id === clientId ? { ...c, status: 'graduated' as const } : c
    );
    setClients(updatedClients);
    saveClientsCloud(currentUser.id, updatedClients).catch(() => {});

    // If client is a linked app user, notify their profile in Cloud Firestore
    if (target.linkedUserId) {
      saveUserProfileCloud(target.linkedUserId, {
        athleteMembership: {
          status: 'graduated',
          coachName: coachProfile.name || currentUser.displayName || 'Coach',
          coachBusiness: coachProfile.businessName,
          graduatedAt: Date.now(),
        },
        linkedCoach: null,
      }).catch(() => {});
    }

    // If client was linked to this session, transition their membership to graduated
    if (target.linkedUserId && activeUser.id === target.linkedUserId) {
      setAthleteMembership({
        status: 'graduated',
        coachName: coachProfile.name,
        coachBusiness: coachProfile.businessName,
        graduatedAt: Date.now(),
      });
      unlinkCoach();
    }
  };

  const completeGraduation = (chosenPlan: 'trial' | 'free') => {
    if (accountType === 'coach' || isCoachAccount) {
      return;
    }
    const newMembership: AthleteMembership =
      chosenPlan === 'trial'
        ? {
            status: 'solo_trial',
            coachName: athleteMembership.coachName,
            coachBusiness: athleteMembership.coachBusiness,
            trialEndsAt: Date.now() + 7 * 86400000,
          }
        : {
            status: 'free',
            coachName: athleteMembership.coachName,
            coachBusiness: athleteMembership.coachBusiness,
          };

    setAthleteMembership(newMembership);
    saveUserProfileCloud(activeUser.id, {
      athleteMembership: newMembership,
      linkedCoach: null,
    }).catch(() => {});
    unlinkCoach();
  };

  const unarchiveClient = (clientId: string): { success: boolean; needUpgrade?: boolean } => {
    const currentActiveCount = clients.filter((c) => c.status === 'active').length;
    if (currentActiveCount >= trainerSubscription.seatLimit) {
      return { success: false, needUpgrade: true };
    }
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: 'active' } : c))
    );
    return { success: true };
  };

  const generateClientClaimToken = (clientId: string, force: boolean = false): ClientClaimToken | null => {
    const target = clients.find((c) => c.id === clientId);
    if (!target) return null;
    const coachDisplayName = coachProfile.name || currentUser.displayName || 'Coach';
    const token =
      !force && target.claimToken && target.claimToken.expiresAt > Date.now()
        ? target.claimToken
        : generateClaimToken(target, coachDisplayName);

    const updatedClients = clients.map((c) => (c.id === clientId ? { ...c, claimToken: token } : c));
    setClients(updatedClients);

    // Save updated roster with token to coach's cloud doc
    saveClientsCloud(currentUser.id, updatedClients).catch(() => {});

    // Publish to shared client_claims collection in Firestore for instant cross-device claiming
    publishClientClaimCloud(
      token,
      target,
      currentUser.id,
      coachDisplayName,
      coachProfile,
      workoutLogs,
      nutritionLogs,
      bodyMetrics,
      splits
    ).catch((err) => {
      console.warn('[UserWorkspaceContext] Error publishing claim token to cloud:', err);
    });

    return token;
  };

  const claimClientWithCode = async (
    code: string
  ): Promise<{ success: boolean; coachName?: string; error?: string }> => {
    if (accountType === 'coach' || isCoachAccount) {
      Alert.alert(
        'Action Not Allowed 🔒',
        'You have a Coach Plan. Coach accounts cannot add or link to another coach.'
      );
      return { success: false, error: 'Coach accounts cannot link to another coach.' };
    }

    const { standardCode, pinOnly } = normalizeClaimCode(code);
    if (!pinOnly) {
      return { success: false, error: 'Please enter a valid invite PIN.' };
    }

    // 1. First check if matched locally (useful when testing on same device)
    const localMatch = clients.find(
      (c) =>
        c.claimToken &&
        (normalizeClaimCode(c.claimToken.code).pinOnly === pinOnly ||
          normalizeClaimCode(c.claimToken.code).standardCode === standardCode)
    );

    let claimRecord: ClientClaimCloudRecord | null = null;

    if (localMatch && localMatch.claimToken) {
      claimRecord = {
        code: localMatch.claimToken.code,
        rawPin: pinOnly,
        coachId: currentUser.id,
        coachName: coachProfile.name || currentUser.displayName || 'Coach',
        coachBusiness: coachProfile.businessName,
        coachInstagram: coachProfile.instagramHandle,
        clientId: localMatch.id,
        clientName: localMatch.name,
        clientEmail: localMatch.email,
        macroTargets: localMatch.macroTargets,
        prescribedArchetypes: localMatch.prescribedArchetypes,
        assignedSplitName: localMatch.assignedSplitName,
        assignedRoutineIds: localMatch.assignedRoutineIds,
        assignedRoutineNames: localMatch.assignedRoutineNames,
        initialWorkouts: workoutLogs.filter((w) => w.userId === localMatch.id),
        initialNutrition: nutritionLogs.filter((n) => n.userId === localMatch.id),
        createdAt: Date.now(),
        expiresAt: localMatch.claimToken.expiresAt,
        claimed: false,
      };

      setClients((prev) =>
        prev.map((c) =>
          c.id === localMatch.id
            ? {
                ...c,
                type: 'linked',
                linkedUserId: activeUser.id,
                linkedAt: Date.now(),
                claimToken: undefined,
              }
            : c
        )
      );
    } else {
      // 2. Query Cloud Firestore
      claimRecord = await lookupClientClaimCloud(code);
    }

    if (!claimRecord) {
      return {
        success: false,
        error: `Invalid invite code "${standardCode}". Please confirm the PIN with your trainer.`,
      };
    }

    if (claimRecord.claimed) {
      return {
        success: false,
        error: 'This invite code has already been claimed.',
      };
    }

    if (claimRecord.expiresAt && claimRecord.expiresAt < Date.now()) {
      return {
        success: false,
        error: 'This invite code has expired. Please ask your trainer for a fresh PIN.',
      };
    }

    // 3. Mark claimed in Cloud Firestore and sync coach's client roster
    const claimingUser: UserProfile = {
      ...activeUser,
      id: auth.currentUser?.uid || activeUser.id,
      email: auth.currentUser?.email || activeUser.email,
    };
    await executeClientClaimCloud(claimRecord, claimingUser);

    // 4. Update local athlete state:
    // a. Transfer past workout logs
    if (claimRecord.initialWorkouts && claimRecord.initialWorkouts.length > 0) {
      const transferred = claimRecord.initialWorkouts.map((w) => ({
        ...w,
        userId: activeUser.id,
      }));
      setWorkoutLogs((prev) => {
        const map = new Map<string, WorkoutLog>();
        prev.forEach((l) => map.set(l.id, l));
        transferred.forEach((l) => map.set(l.id, l));
        return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      });
    } else {
      setWorkoutLogs((prev) =>
        prev.map((l) => (l.userId === claimRecord!.clientId ? { ...l, userId: activeUser.id } : l))
      );
    }

    // b. Transfer past nutrition logs
    if (claimRecord.initialNutrition && claimRecord.initialNutrition.length > 0) {
      const transferredNut = claimRecord.initialNutrition.map((n) => ({
        ...n,
        userId: activeUser.id,
      }));
      setNutritionLogs((prev) => {
        const map = new Map<string, NutritionLog>();
        prev.forEach((n) => map.set(n.date, n));
        transferredNut.forEach((n) => map.set(n.date, n));
        return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
      });
    }

    // b2. Transfer past body metrics
    if (claimRecord.initialBodyMetrics && claimRecord.initialBodyMetrics.length > 0) {
      const transferredBm = claimRecord.initialBodyMetrics.map((m) => ({
        ...m,
        userId: activeUser.id,
      }));
      setBodyMetrics((prev) => {
        const map = new Map<string, BodyMetric>();
        prev.forEach((m) => map.set(m.id, m));
        transferredBm.forEach((m) => map.set(m.id, m));
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
    }

    // b3. Transfer past splits
    if (claimRecord.initialSplits && claimRecord.initialSplits.length > 0) {
      const transferredSplits = claimRecord.initialSplits.map((s) => ({
        ...s,
        userId: activeUser.id,
      }));
      setSplits((prev) => {
        const others = prev.filter((s) => s.userId !== activeUser.id);
        return [...transferredSplits, ...others];
      });

      // Also set active weeklySchedule for the athlete locally
      const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const activeSplit = transferredSplits.find((s) => s.isActive) || transferredSplits[0];
      const newSchedule: DaySchedule[] = days.map((day, idx) => {
        const routine = activeSplit.routines?.[idx];
        return routine
          ? { day, routineId: routine.id, routineName: routine.name, exerciseIds: routine.exerciseIds || [] }
          : { day, routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] };
      });
      setUserSchedules((prev) => ({
        ...prev,
        [activeUser.id]: newSchedule,
      }));
    }

    // c. Macro Targets
    if (claimRecord.macroTargets) {
      updateMacroTargets(claimRecord.macroTargets);
    }

    // d. Prescribed Archetypes
    if (claimRecord.prescribedArchetypes && claimRecord.prescribedArchetypes.length > 0) {
      setPrescribedArchetypes(claimRecord.prescribedArchetypes);
    }

    // e. Link Coach with coachId
    linkCoach({
      name: claimRecord.coachName,
      businessName: claimRecord.coachBusiness,
      instagramHandle: claimRecord.coachInstagram,
      coachId: claimRecord.coachId,
    });

    // f. Sponsored VIP membership
    setAthleteMembership({
      status: 'sponsored_by_coach',
      coachName: claimRecord.coachName,
      coachBusiness: claimRecord.coachBusiness,
    });

    return { success: true, coachName: claimRecord.coachName };
  };

  const upgradeTrainerSubscription = (tier: TrainerSubscriptionTier, customSeats?: number) => {
    const config = TIER_CONFIGS[tier];
    const seatLimit = tier === 'studio' && customSeats ? customSeats : config.seatLimit;
    const priceZar =
      tier === 'studio'
        ? calculateCustomTierPrice(seatLimit)
        : config.priceZar;
    setTrainerSubscription({
      tier,
      seatLimit,
      priceZar,
      currency: 'ZAR',
      billingPeriod: 'monthly',
      status: 'active',
      expiresAt: Date.now() + 30 * 86400000,
    });
  };


  const reconcileDowngradeSeats = (newTier: TrainerSubscriptionTier, activeClientIds: string[]) => {
    const config = TIER_CONFIGS[newTier];
    setTrainerSubscription({
      tier: newTier,
      seatLimit: config.seatLimit,
      priceZar: config.priceZar,
      currency: 'ZAR',
      billingPeriod: 'monthly',
      status: 'active',
      expiresAt: Date.now() + 30 * 86400000,
    });
    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        status: activeClientIds.includes(c.id) ? 'active' : 'archived',
      }))
    );
  };

  const getClientWorkoutLogs = (clientId: string): WorkoutLog[] => {
    const targetClient = clients.find((c) => c.id === clientId);
    const validUserIds = new Set<string>([clientId]);
    if (targetClient?.linkedUserId) validUserIds.add(targetClient.linkedUserId);

    return workoutLogs.filter((l) => validUserIds.has(l.userId));
  };

  const logClientWorkout = (clientId: string, logData: Omit<WorkoutLog, 'id'>): WorkoutLog => {
    const targetClient = clients.find((c) => c.id === clientId);
    const targetUserId = targetClient?.linkedUserId || clientId;

    const newLog: WorkoutLog = {
      ...logData,
      id: `log_client_${Date.now()}`,
      userId: targetUserId,
      loggedBy: 'coach',
      coachId: currentUser.id,
      coachName: coachProfile.name || currentUser.displayName,
    };

    setWorkoutLogs((prev) => [newLog, ...prev]);
    saveWorkoutLogCloud(newLog.userId, newLog).catch(() => {});

    // Update client's lastSessionDate and sync coach roster to cloud
    setClients((prev) => {
      const updated = prev.map((c) =>
        c.id === clientId ? { ...c, lastSessionDate: logData.date } : c
      );
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });

    return newLog;
  };

  const assignClientRoutine = (clientId: string, routineId: string, routineName: string) => {
    setClients((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== clientId) return c;
        const ids = c.assignedRoutineIds.includes(routineId)
          ? c.assignedRoutineIds
          : [...c.assignedRoutineIds, routineId];
        const names = c.assignedRoutineNames.includes(routineName)
          ? c.assignedRoutineNames
          : [...c.assignedRoutineNames, routineName];
        return { ...c, assignedRoutineIds: ids, assignedRoutineNames: names };
      });
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });

    const targetClient = clients.find((c) => c.id === clientId);
    if (targetClient?.linkedUserId) {
      const clientUserId = targetClient.linkedUserId;
      const clientSplits = splits.filter((s) => s.userId === clientUserId || s.userId === clientId);
      if (clientSplits.length > 0) {
        saveSplitsCloud(clientUserId, clientSplits).catch(() => {});
      }
    }
  };

  const assignClientMacros = (clientId: string, targets: MacroTargets) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, macroTargets: targets } : c));
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });

    if (managedClient && managedClient.id === clientId) {
      setManagedClient((prev) => (prev ? { ...prev, macroTargets: targets } : null));
      setActiveUser((prev) => ({ ...prev, macroTargets: targets }));
    }

    const targetClient = clients.find((c) => c.id === clientId);
    const targetUserId = targetClient?.linkedUserId || (managedClient?.id === clientId ? managedClient.linkedUserId : undefined);
    if (targetUserId) {
      saveUserProfileCloud(targetUserId, { macroTargets: targets }).catch(() => {});
    }
    saveUserProfileCloud(clientId, { macroTargets: targets }).catch(() => {});
  };

  const assignClientArchetypes = (clientId: string, archetypes: PrescribedMealArchetype[]) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, prescribedArchetypes: archetypes } : c));
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });

    if (managedClient && managedClient.id === clientId) {
      setManagedClient((prev) => (prev ? { ...prev, prescribedArchetypes: archetypes } : null));
    }
    // Only update active athlete prescribedArchetypes view if looking at this client
    if (activeUser.id === clientId || (managedClient && managedClient.id === clientId)) {
      setPrescribedArchetypes(archetypes);
    }

    const targetClient = clients.find((c) => c.id === clientId);
    const targetUserId = targetClient?.linkedUserId || (managedClient?.id === clientId ? managedClient.linkedUserId : undefined);
    if (targetUserId) {
      savePrescribedArchetypesCloud(targetUserId, archetypes).catch(() => {});
      saveUserProfileCloud(targetUserId, { prescribedArchetypes: archetypes }).catch(() => {});
    }
    savePrescribedArchetypesCloud(clientId, archetypes).catch(() => {});
  };

  const addCoachMeal = (meal: Omit<PrescribedMealArchetype, 'id'>): PrescribedMealArchetype => {
    const newMeal: PrescribedMealArchetype = {
      ...meal,
      id: `arch_${Date.now()}`,
    };
    setCoachMeals((prev) => {
      const updated = [...prev, newMeal];
      savePrescribedArchetypesCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });
    return newMeal;
  };

  const deleteCoachMeal = (mealId: string) => {
    setCoachMeals((prev) => {
      const updated = prev.filter((m) => m.id !== mealId);
      savePrescribedArchetypesCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });
  };

  const assignSplitToClient = (clientId: string, split: Split) => {
    const targetClient = clients.find((c) => c.id === clientId);
    if (!targetClient) return;

    const routineIds = split.routines.map((r) => r.id);
    const routineNames = split.routines.map((r) => r.name);

    // Update the coach's client roster
    setClients((prev) => {
      const updated = prev.map((c) =>
        c.id === clientId
          ? { ...c, assignedSplitId: split.id, assignedSplitName: split.name, assignedRoutineIds: routineIds, assignedRoutineNames: routineNames }
          : c
      );
      saveClientsCloud(currentUser.id, updated).catch(() => {});
      return updated;
    });

    // Write split directly to each of the client's Firestore documents so their device gets it
    const splitTargetIds: string[] = [clientId];
    if (targetClient.linkedUserId && targetClient.linkedUserId !== clientId) {
      splitTargetIds.push(targetClient.linkedUserId);
    }

    // Build default schedule mapping for client's weekly calendar
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const clientSchedule: DaySchedule[] = days.map((day, idx) => {
      const routine = split.routines[idx];
      if (routine) {
        return {
          day,
          routineId: routine.id,
          routineName: routine.name,
          exerciseIds: routine.exerciseIds || [],
        };
      }
      return {
        day,
        routineId: 'rest',
        routineName: 'Rest Day',
        exerciseIds: [],
      };
    });

    splitTargetIds.forEach((uid) => {
      saveUserProfileCloud(uid, { weeklySchedule: clientSchedule }).catch(() => {});
      setUserSchedules((prev) => ({ ...prev, [uid]: clientSchedule }));

      const clientSplit: Split = { ...split, userId: uid, isActive: true };
      setSplits((prev) => {
        // Deactivate any existing splits for this user, replace or add this split
        const deactivated = prev.map((s) => (s.userId === uid ? { ...s, isActive: false } : s));
        const filtered = deactivated.filter((s) => !(s.id === split.id && s.userId === uid));
        const newList = [clientSplit, ...filtered];
        // Save complete array for this uid
        saveSplitsCloud(uid, newList.filter((s) => s.userId === uid)).catch(() => {});
        return newList;
      });
    });
  };

  const assignSplitToSelf = (split: Split) => {
    const splitForMe: Split = {
      ...split,
      id: `split_${currentUser.id}_${Date.now()}`,
      userId: currentUser.id,
      isActive: true,
    };
    addSplit(splitForMe);
  };

  const assignMealToSelf = (meal: PrescribedMealArchetype) => {
    const currentList = currentUser.prescribedArchetypes || [];
    const exists = currentList.some((m) => m.id === meal.id);
    const updated = exists ? currentList : [...currentList, meal];
    setCurrentUser((prev) => ({ ...prev, prescribedArchetypes: updated }));
    if (activeUser.id === currentUser.id) {
      setActiveUser((prev) => ({ ...prev, prescribedArchetypes: updated }));
    }
    setPrescribedArchetypes(updated);
    savePrescribedArchetypesCloud(currentUser.id, updated).catch(() => {});
    saveUserProfileCloud(currentUser.id, { prescribedArchetypes: updated }).catch(() => {});
  };

  const linkCoach = (coach: { name: string; businessName?: string; instagramHandle?: string; coachId?: string }) => {
    if (accountType === 'coach' || isCoachAccount) {
      console.warn('[UserWorkspaceContext] Coach accounts cannot link to another coach.');
      return;
    }
    const newLinkedCoach: LinkedCoach = {
      name: coach.name.trim(),
      businessName: coach.businessName?.trim(),
      instagramHandle: coach.instagramHandle?.trim(),
      coachId: coach.coachId,
      linkedAt: Date.now(),
    };
    setLinkedCoach(newLinkedCoach);
    saveUserProfileCloud(activeUser.id, { linkedCoach: newLinkedCoach }).catch(() => {});
  };

  const unlinkCoach = () => {
    const previousCoachId = linkedCoach?.coachId;
    setLinkedCoach(null);
    unlinkCoachCloud(activeUser.id, previousCoachId).catch(() => {});
  };

  const clearAllData = async () => {
    setWorkoutLogs([]);
    setNutritionLogs([]);
    setBodyMetrics([]);
    setLinkedCoach(null);
    setTrainerSubscription(initialTrainerSubscription);
    if (isHydrated) {
      await persistAppData({
        currentUser,
        partnerUser,
        activeUserId: activeUser.id,
        activeWorkspace,
        exercises,
        splits,
        workoutLogs: [],
        nutritionLogs: [],
        bodyMetrics: [],
        userSchedules,
        userRole,
        coachProfile,
        clients,
        prescribedArchetypes,
        linkedCoach: null,
        trainerSubscription: initialTrainerSubscription,
      });
    }
  };

  const resetAllDataToDefaults = async () => {
    await clearStoredAppData();
    setCurrentUser(initialCurrentUser);
    setPartnerUser(initialPartnerUser);
    setActiveUser(initialCurrentUser);
    setActiveWorkspace(initialWorkspace);
    setExercises(DEFAULT_EXERCISES);
    setSplits(initialSplits);
    setWorkoutLogs(initialWorkoutLogs);
    setNutritionLogs(initialNutritionLogs);
    setBodyMetrics(initialBodyMetrics);
    setUserSchedules({
      user_alex: initialAlexSchedule,
      user_jordan: initialJordanSchedule,
    });
    setUserRole('athlete');
    setCoachProfile(initialCoachProfile);
    setClients(initialClients);
    setPrescribedArchetypes(initialPrescribedArchetypes);
    setLinkedCoach(null);
    setTrainerSubscription(initialTrainerSubscription);
  };

  const initializeBrandNewUser = async (
    displayName: string,
    role: UserRole = 'athlete',
    targetAccountType: AccountType = 'athlete'
  ) => {
    const cleanName = displayName.trim() || 'Lifter';
    const newUid = auth?.currentUser?.uid || firebaseUser?.uid || `user_${Date.now()}`;
    const cleanUser: UserProfile = {
      id: newUid,
      displayName: cleanName,
      email: auth?.currentUser?.email || firebaseUser?.email || '',
      activeWorkspaceId: `ws_${newUid}`,
      macroTargets: { calories: 2200, protein: 160, carbs: 220, fats: 70 },
      weightUnit: 'kg',
      createdAt: Date.now(),
    };

    setCurrentUser(cleanUser);
    setActiveUser(cleanUser);
    setPartnerUser(null);
    setActiveWorkspace({
      id: `ws_${newUid}`,
      name: `${cleanName}'s Workspace`,
      ownerId: newUid,
      memberIds: [newUid],
    });

    // Zero logged data & clean splits
    setSplits([]);
    await AsyncStorage.setItem(`@ripped_presets_seeded_v3_${newUid}`, 'true');
    setWorkoutLogs([]);
    setNutritionLogs([]);
    setBodyMetrics([]);
    setUserSchedules({});

    // Zero coach data / zero clients / zero linked coaches
    setLinkedCoach(null);
    setClients([]);
    setPrescribedArchetypes([]);
    setCoachProfile({
      name: cleanName,
      businessName: '',
      instagramHandle: '',
    });

    setUserRoleState(role);
    setAccountTypeState(targetAccountType);

    if (targetAccountType === 'coach') {
      setTrainerSubscription(initialTrainerSubscription);
      setAthleteMembership({ status: 'free' });
    } else {
      setTrainerSubscription({
        tier: 'starter',
        seatLimit: 0,
        priceZar: 0,
        currency: 'ZAR',
        billingPeriod: 'monthly',
        status: 'canceled',
      });
      setAthleteMembership({
        status: targetAccountType === 'client' ? 'sponsored_by_coach' : 'solo_active',
      });
    }

    // Persist empty state immediately so fresh account never shows demo artifacts
    await persistUserData(newUid, {
      workoutLogs: [],
      nutritionLogs: [],
      bodyMetrics: [],
      userRole: role,
    });

    await persistAppData({
      currentUser: cleanUser,
      partnerUser: null,
      activeUserId: newUid,
      activeWorkspace: {
        id: `ws_${newUid}`,
        name: `${cleanName}'s Workspace`,
        ownerId: newUid,
        memberIds: [newUid],
      },
      exercises,
      splits: [],
      workoutLogs: [],
      nutritionLogs: [],
      bodyMetrics: [],
      userSchedules: {},
      userRole: role,
      accountType: targetAccountType,
      coachProfile: {
        name: cleanName,
        businessName: '',
        instagramHandle: '',
      },
      clients: [],
      prescribedArchetypes: [],
      linkedCoach: null,
      trainerSubscription:
        targetAccountType === 'coach'
          ? initialTrainerSubscription
          : {
              tier: 'starter',
              seatLimit: 0,
              priceZar: 0,
              currency: 'ZAR',
              billingPeriod: 'monthly',
              status: 'canceled',
            },
      athleteMembership: {
        status: targetAccountType === 'client' ? 'sponsored_by_coach' : 'solo_active',
      },
    });
  };

  return (
    <UserWorkspaceContext.Provider
      value={{
        isHydrated,
        currentUser,
        partnerUser,
        activeUser,
        activeWorkspace,
        exercises,
        splits,
        workoutLogs,
        nutritionLogs,
        bodyMetrics,
        weeklySchedule: activeWeeklySchedule,
        updateDaySchedule,
        shiftSplitSchedule,
        accountType,
        setAccountType,
        userRole,
        coachProfile,
        clients,
        prescribedArchetypes,
        trainerSubscription,
        activeSeatsUsed,
        managedClient,
        startManagingClient,
        stopManagingClient,
        isCoachAccount,
        isViewingPersonalProfile,
        enterPersonalAthleteMode,
        exitPersonalAthleteMode,
        linkedCoach,
        linkCoach,
        unlinkCoach,
        athleteMembership,
        setAthleteMembership,
        graduateClient,
        completeGraduation,
        setUserRole,
        updateCoachProfile,
        addClient,
        updateClient,
        deleteClient,
        unlinkClient,
        archiveClient,
        unarchiveClient,
        generateClientClaimToken,
        claimClientWithCode,
        upgradeTrainerSubscription,
        reconcileDowngradeSeats,
        getClientWorkoutLogs,
        logClientWorkout,
        assignClientRoutine,
        assignClientMacros,
        assignClientArchetypes,
        coachMeals,
        addCoachMeal,
        deleteCoachMeal,
        assignSplitToClient,
        assignSplitToSelf,
        assignMealToSelf,
        setPrescribedArchetypes,
        switchActiveUser,
        addExercise,
        updateExercise,
        deleteExercise,
        toggleStarExercise,
        addSplit,
        updateSplit,
        deleteSplit,
        setActiveSplit,
        toggleStarSplit,
        restoreDefaultSplits,
        clearAllCoachSplits,
        removeExerciseFromRoutine,
        saveWorkoutLog,
        deleteWorkoutLog,
        saveNutritionMeal,
        deleteNutritionMeal,
        clearNutritionDay,
        updateMacroTargets,
        updateUserName,
        updateWeightUnit,
        saveWaterIntake,
        addBodyMetric,
        deleteBodyMetric,
        linkPartnerUser,
        clearAllData,
        resetAllDataToDefaults,
        initializeBrandNewUser,
        firebaseUser,
        isAuthReady,
        cloudSyncStatus,
        lastCloudSyncTimestamp,
        syncAllToCloud,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
    </UserWorkspaceContext.Provider>
  );
};

export const useUserWorkspace = () => {
  const context = useContext(UserWorkspaceContext);
  if (!context) {
    throw new Error('useUserWorkspace must be used within a UserWorkspaceProvider');
  }
  return context;
};
