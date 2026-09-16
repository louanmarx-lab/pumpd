import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  Workspace,
  Exercise,
  Split,
  WorkoutLog,
  NutritionLog,
  BodyMetric,
  MacroTargets,
  Meal,
  DayOfWeek,
  DaySchedule,
} from '../types';
import { DEFAULT_EXERCISES } from '../utils/fitness';
import {
  UserRole,
  CoachProfile,
  ClientProfile,
  PrescribedMealArchetype,
} from '../types/trainer';
import {
  loadStoredAppData,
  persistAppData,
  clearStoredAppData,
  loadUserData,
  persistUserData,
  getActiveSession,
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
} from '../services/firestoreService';
import { subscribeToAuth, signInAsGuest, signOutUser } from '../services/authService';

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
  
  // Trainer & Client Dual Mode
  userRole: UserRole;
  coachProfile: CoachProfile;
  clients: ClientProfile[];
  prescribedArchetypes: PrescribedMealArchetype[];
  setUserRole: (role: UserRole) => void;
  updateCoachProfile: (profile: Partial<CoachProfile>) => void;
  addClient: (client: Omit<ClientProfile, 'id' | 'createdAt'>) => ClientProfile;
  updateClient: (client: ClientProfile) => void;
  deleteClient: (clientId: string) => void;
  assignClientRoutine: (clientId: string, routineId: string, routineName: string) => void;
  assignClientMacros: (clientId: string, targets: MacroTargets) => void;
  assignClientArchetypes: (clientId: string, archetypes: PrescribedMealArchetype[]) => void;
  setPrescribedArchetypes: React.Dispatch<React.SetStateAction<PrescribedMealArchetype[]>>;

  // Actions
  switchActiveUser: (userId: string) => void;
  addExercise: (exercise: Omit<Exercise, 'id'>) => Exercise;
  deleteExercise: (exerciseId: string) => void;
  addSplit: (split: Omit<Split, 'id'>) => Split;
  updateSplit: (split: Split) => void;
  deleteSplit: (splitId: string) => void;
  removeExerciseFromRoutine: (splitId: string, routineId: string, exerciseId: string) => void;
  saveWorkoutLog: (log: Omit<WorkoutLog, 'id'>) => WorkoutLog;
  deleteWorkoutLog: (logId: string) => void;
  saveNutritionMeal: (date: string, meal: Omit<Meal, 'id'>) => void;
  deleteNutritionMeal: (date: string, mealId: string) => void;
  updateMacroTargets: (targets: MacroTargets) => void;
  updateUserName: (userId: string, newDisplayName: string) => void;
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

  // Firebase Auth & Cloud Sync
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline';
  lastCloudSyncTimestamp: number | null;
  syncAllToCloud: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: (role?: UserRole) => Promise<void>;
}

// Initial Demo Accounts & Workspace
const initialCurrentUser: UserProfile = {
  id: 'user_alex',
  displayName: 'Alex Johnson',
  email: 'alex@pumpd.app',
  activeWorkspaceId: 'ws_pumpd_1',
  macroTargets: { calories: 2600, protein: 185, carbs: 275, fats: 80 },
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
};

const initialPartnerUser: UserProfile = {
  id: 'user_jordan',
  displayName: 'Jordan Smith',
  email: 'jordan@pumpd.app',
  activeWorkspaceId: 'ws_pumpd_1',
  macroTargets: { calories: 2300, protein: 160, carbs: 240, fats: 70 },
  createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
};

const initialWorkspace: Workspace = {
  id: 'ws_pumpd_1',
  name: 'Pumpd Training Duo',
  ownerId: 'user_alex',
  memberIds: ['user_alex', 'user_jordan'],
};

// Initial Demo Splits
const initialSplits: Split[] = [
  {
    id: 'split_1',
    userId: 'user_alex',
    name: 'Push / Pull / Legs (PPL)',
    isActive: true,
    routines: [
      { id: 'r_push', name: 'Push Day (Chest, Shoulders, Triceps)', exerciseIds: ['ex_1', 'ex_2', 'ex_13', 'ex_14', 'ex_18'] },
      { id: 'r_pull', name: 'Pull Day (Back & Biceps)', exerciseIds: ['ex_4', 'ex_5', 'ex_6', 'ex_16', 'ex_17'] },
      { id: 'r_legs', name: 'Leg Day (Quads, Hamstrings, Calves)', exerciseIds: ['ex_8', 'ex_9', 'ex_11', 'ex_12', 'ex_20'] },
    ],
  },
  {
    id: 'split_2',
    userId: 'user_jordan',
    name: 'Upper / Lower Hypertrophy',
    isActive: true,
    routines: [
      { id: 'r_upper', name: 'Upper Body A', exerciseIds: ['ex_1', 'ex_5', 'ex_13', 'ex_16', 'ex_18'] },
      { id: 'r_lower', name: 'Lower Body A', exerciseIds: ['ex_8', 'ex_11', 'ex_9', 'ex_20', 'ex_21'] },
    ],
  },
];

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
    workspaceId: 'ws_pumpd_1',
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
    workspaceId: 'ws_pumpd_1',
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
    workspaceId: 'ws_pumpd_1',
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
  name: 'Alex Johnson',
  businessName: 'Apex Performance Coaching',
  instagramHandle: '@alex_apexfit',
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
    notes: 'Glute hypertrophy and pull-up progression.',
    macroTargets: { calories: 2100, protein: 145, carbs: 220, fats: 65 },
    assignedRoutineIds: ['r_upper', 'r_lower'],
    assignedRoutineNames: ['Upper Body Power', 'Lower Body Hypertrophy'],
    prescribedArchetypes: [initialPrescribedArchetypes[2]],
    createdAt: Date.now() - 20 * 86400000,
    lastSessionDate: threeDaysAgoStr,
  },
];

const UserWorkspaceContext = createContext<UserWorkspaceContextType | undefined>(undefined);

export const UserWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialCurrentUser);
  const [partnerUser, setPartnerUser] = useState<UserProfile | null>(initialPartnerUser);
  const [activeUser, setActiveUser] = useState<UserProfile>(initialCurrentUser);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(initialWorkspace);

  // Trainer & Client Dual Mode State
  const [userRole, setUserRole] = useState<UserRole>('athlete');
  const [coachProfile, setCoachProfile] = useState<CoachProfile>(initialCoachProfile);
  const [clients, setClients] = useState<ClientProfile[]>(initialClients);
  const [prescribedArchetypes, setPrescribedArchetypes] = useState<PrescribedMealArchetype[]>(initialPrescribedArchetypes);

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
        const stored = await loadStoredAppData();
        if (stored && isMounted) {
          if (stored.currentUser) setCurrentUser(stored.currentUser);
          if (stored.partnerUser !== undefined) setPartnerUser(stored.partnerUser);
          if (stored.activeWorkspace) setActiveWorkspace(stored.activeWorkspace);
          if (stored.exercises && stored.exercises.length > 0) setExercises(stored.exercises);
          if (stored.splits && stored.splits.length > 0) setSplits(stored.splits);
          if (stored.workoutLogs) setWorkoutLogs(stored.workoutLogs);
          if (stored.nutritionLogs) setNutritionLogs(stored.nutritionLogs);
          if (stored.bodyMetrics) setBodyMetrics(stored.bodyMetrics);
          if (stored.userSchedules) setUserSchedules(stored.userSchedules);
          if (stored.userRole) setUserRole(stored.userRole);
          if (stored.coachProfile) setCoachProfile(stored.coachProfile);
          if (stored.clients && stored.clients.length > 0) setClients(stored.clients);
          if (stored.prescribedArchetypes && stored.prescribedArchetypes.length > 0) {
            setPrescribedArchetypes(stored.prescribedArchetypes);
          }

          if (stored.activeUserId) {
            if (stored.partnerUser && stored.activeUserId === stored.partnerUser.id) {
              setActiveUser(stored.partnerUser);
            } else if (stored.currentUser && stored.activeUserId === stored.currentUser.id) {
              setActiveUser(stored.currentUser);
            }
          }
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

  // 2. Persist state to local storage whenever changed (after initial hydration)
  useEffect(() => {
    if (!isHydrated) return;

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
      coachProfile,
      clients,
      prescribedArchetypes,
    });

    if (activeUser?.id) {
      persistUserData(activeUser.id, {
        workoutLogs,
        nutritionLogs,
        bodyMetrics,
        userRole,
      });
    }
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
    coachProfile,
    clients,
    prescribedArchetypes,
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

        // Load isolated user data for this specific user
        const userData = await loadUserData(user.uid);
        if (userData) {
          if (userData.workoutLogs) setWorkoutLogs(userData.workoutLogs);
          if (userData.nutritionLogs) setNutritionLogs(userData.nutritionLogs);
          if (userData.bodyMetrics) setBodyMetrics(userData.bodyMetrics);
          if (userData.userRole) setUserRole(userData.userRole);
        }

        const session = await getActiveSession();
        if (session?.userRole) {
          setUserRole(session.userRole);
        }
      } else if (user && user.isAnonymous) {
        setCloudSyncStatus('synced');
        const session = await getActiveSession();
        if (session?.userRole) {
          setUserRole(session.userRole);
        }
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

  const continueAsGuest = async (role: UserRole = 'athlete') => {
    try {
      setUserRole(role);
      await signInAsGuest(role);
    } catch (err) {
      console.warn('[Auth] Error signing in as guest:', err);
    }
  };

  // 4. Cloud Firestore Real-Time Sync with Local Persistent Cache
  useEffect(() => {
    if (!activeUser?.id || !isHydrated) return;

    const unsubWorkouts = subscribeToWorkoutLogs(activeUser.id, (cloudLogs) => {
      if (cloudLogs.length > 0) {
        setWorkoutLogs((prev) => {
          const map = new Map<string, WorkoutLog>();
          prev.forEach((l) => map.set(l.id, l));
          cloudLogs.forEach((l) => map.set(l.id, l));
          return Array.from(map.values()).sort(
            (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
          );
        });
        setLastCloudSyncTimestamp(Date.now());
        setCloudSyncStatus('synced');
      }
    });

    const unsubNutrition = subscribeToNutritionLogs(activeUser.id, (cloudLogs) => {
      if (cloudLogs.length > 0) {
        setNutritionLogs((prev) => {
          const map = new Map<string, NutritionLog>();
          prev.forEach((l) => map.set(l.date, l));
          cloudLogs.forEach((l) => map.set(l.date, l));
          return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
        });
        setLastCloudSyncTimestamp(Date.now());
        setCloudSyncStatus('synced');
      }
    });

    const unsubMetrics = subscribeToBodyMetrics(activeUser.id, (cloudMetrics) => {
      if (cloudMetrics.length > 0) {
        setBodyMetrics((prev) => {
          const map = new Map<string, BodyMetric>();
          prev.forEach((m) => map.set(m.id, m));
          cloudMetrics.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        });
        setLastCloudSyncTimestamp(Date.now());
        setCloudSyncStatus('synced');
      }
    });

    return () => {
      unsubWorkouts();
      unsubNutrition();
      unsubMetrics();
    };
  }, [activeUser.id, isHydrated]);

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

  const addExercise = (newEx: Omit<Exercise, 'id'>): Exercise => {
    const exercise: Exercise = {
      ...newEx,
      id: `ex_custom_${Date.now()}`,
    };
    setExercises((prev) => [exercise, ...prev]);
    return exercise;
  };

  const deleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const addSplit = (newSplit: Omit<Split, 'id'>): Split => {
    const split: Split = {
      ...newSplit,
      id: `split_${Date.now()}`,
    };
    setSplits((prev) => {
      // If setting this split to active, deactivate other splits for activeUser
      const updated = split.isActive
        ? prev.map((s) => (s.userId === split.userId ? { ...s, isActive: false } : s))
        : [...prev];
      return [split, ...updated];
    });
    return split;
  };

  const updateSplit = (updatedSplit: Split) => {
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id === updatedSplit.id) return updatedSplit;
        if (updatedSplit.isActive && s.userId === updatedSplit.userId) {
          return { ...s, isActive: false };
        }
        return s;
      })
    );
  };

  const deleteSplit = (splitId: string) => {
    const splitToDelete = splits.find((s) => s.id === splitId);
    if (!splitToDelete) return;

    const userSplits = splits.filter((s) => s.userId === splitToDelete.userId);
    // Protected default: prevent deleting if only 1 split remains for user
    if (userSplits.length <= 1) {
      return;
    }

    const routineIdsToDelete = new Set(splitToDelete.routines.map((r) => r.id));

    // 1. Delete split and promote another split to active if the deleted split was active
    setSplits((prev) => {
      const remaining = prev.filter((s) => s.id !== splitId);
      if (splitToDelete.isActive) {
        const remainingUserSplits = remaining.filter((s) => s.userId === splitToDelete.userId);
        if (remainingUserSplits.length > 0) {
          const firstRemainingId = remainingUserSplits[0].id;
          return remaining.map((s) =>
            s.id === firstRemainingId ? { ...s, isActive: true } : s
          );
        }
      }
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
    const log: WorkoutLog = {
      ...newLog,
      id: `log_${Date.now()}`,
    };
    setWorkoutLogs((prev) => [log, ...prev]);
    saveWorkoutLogCloud(log.userId, log).catch(() => {});
    return log;
  };

  const deleteWorkoutLog = (logId: string) => {
    setWorkoutLogs((prev) => prev.filter((l) => l.id !== logId));
    deleteWorkoutLogCloud(activeUser.id, logId).catch(() => {});
  };

  const saveNutritionMeal = (date: string, mealData: Omit<Meal, 'id'>) => {
    const meal: Meal = {
      ...mealData,
      id: `meal_${Date.now()}`,
      timestamp: Date.now(),
    };

    setNutritionLogs((prev) => {
      const existingLogIndex = prev.findIndex(
        (l) => l.userId === activeUser.id && l.date === date
      );

      let targetLog: NutritionLog;
      let updated: NutritionLog[];

      if (existingLogIndex >= 0) {
        updated = [...prev];
        const currentLog = updated[existingLogIndex];
        targetLog = {
          ...currentLog,
          meals: [...currentLog.meals, meal],
        };
        updated[existingLogIndex] = targetLog;
      } else {
        targetLog = {
          id: `nut_${activeUser.id}_${date}`,
          userId: activeUser.id,
          date,
          meals: [meal],
        };
        updated = [targetLog, ...prev];
      }
      saveNutritionLogCloud(activeUser.id, targetLog).catch(() => {});
      return updated;
    });
  };

  const deleteNutritionMeal = (date: string, mealId: string) => {
    setNutritionLogs((prev) =>
      prev.map((l) => {
        if (l.userId === activeUser.id && l.date === date) {
          deleteNutritionMealCloud(activeUser.id, date, mealId, l).catch(() => {});
          return {
            ...l,
            meals: l.meals.filter((m) => m.id !== mealId),
          };
        }
        return l;
      })
    );
  };

  const updateMacroTargets = (newTargets: MacroTargets) => {
    const updatedUser = { ...activeUser, macroTargets: newTargets };
    setActiveUser(updatedUser);
    if (activeUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
    } else if (partnerUser && activeUser.id === partnerUser.id) {
      setPartnerUser(updatedUser);
    }
    saveUserProfileCloud(activeUser.id, { macroTargets: newTargets }).catch(() => {});
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

  const addBodyMetric = (
    weightKg: number,
    bodyFatPercentage?: number,
    skeletalMuscleMassKg?: number,
    date: string = todayStr
  ) => {
    const metric: BodyMetric = {
      id: `bm_${Date.now()}`,
      userId: activeUser.id,
      date,
      weightKg,
      bodyFatPercentage,
      skeletalMuscleMassKg,
    };
    setBodyMetrics((prev) => [metric, ...prev]);
    saveBodyMetricCloud(activeUser.id, metric).catch(() => {});
  };

  const deleteBodyMetric = (metricId: string) => {
    setBodyMetrics((prev) => prev.filter((m) => m.id !== metricId));
    deleteBodyMetricCloud(activeUser.id, metricId).catch(() => {});
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

  const addClient = (newClient: Omit<ClientProfile, 'id' | 'createdAt'>): ClientProfile => {
    const client: ClientProfile = {
      ...newClient,
      id: `client_${Date.now()}`,
      createdAt: Date.now(),
    };
    setClients((prev) => [client, ...prev]);
    return client;
  };

  const updateClient = (client: ClientProfile) => {
    setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
  };

  const deleteClient = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const assignClientRoutine = (clientId: string, routineId: string, routineName: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const ids = c.assignedRoutineIds.includes(routineId)
          ? c.assignedRoutineIds
          : [...c.assignedRoutineIds, routineId];
        const names = c.assignedRoutineNames.includes(routineName)
          ? c.assignedRoutineNames
          : [...c.assignedRoutineNames, routineName];
        return { ...c, assignedRoutineIds: ids, assignedRoutineNames: names };
      })
    );
  };

  const assignClientMacros = (clientId: string, targets: MacroTargets) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, macroTargets: targets } : c))
    );
  };

  const assignClientArchetypes = (clientId: string, archetypes: PrescribedMealArchetype[]) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, prescribedArchetypes: archetypes } : c))
    );
  };

  const clearAllData = async () => {
    setWorkoutLogs([]);
    setNutritionLogs([]);
    setBodyMetrics([]);
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
    setUserRole('coach');
    setCoachProfile(initialCoachProfile);
    setClients(initialClients);
    setPrescribedArchetypes(initialPrescribedArchetypes);
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
        userRole,
        coachProfile,
        clients,
        prescribedArchetypes,
        setUserRole,
        updateCoachProfile,
        addClient,
        updateClient,
        deleteClient,
        assignClientRoutine,
        assignClientMacros,
        assignClientArchetypes,
        setPrescribedArchetypes,
        switchActiveUser,
        addExercise,
        deleteExercise,
        addSplit,
        updateSplit,
        deleteSplit,
        removeExerciseFromRoutine,
        saveWorkoutLog,
        deleteWorkoutLog,
        saveNutritionMeal,
        deleteNutritionMeal,
        updateMacroTargets,
        updateUserName,
        addBodyMetric,
        deleteBodyMetric,
        linkPartnerUser,
        clearAllData,
        resetAllDataToDefaults,
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
