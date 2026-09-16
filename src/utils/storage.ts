import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  Workspace,
  Exercise,
  Split,
  WorkoutLog,
  NutritionLog,
  BodyMetric,
  DaySchedule,
} from '../types';
import {
  UserRole,
  CoachProfile,
  ClientProfile,
  PrescribedMealArchetype,
} from '../types/trainer';

export const STORAGE_KEYS = {
  INITIALIZED: '@pumpd_initialized_v1',
  CURRENT_USER: '@pumpd_current_user',
  PARTNER_USER: '@pumpd_partner_user',
  ACTIVE_USER_ID: '@pumpd_active_user_id',
  WORKSPACE: '@pumpd_workspace',
  EXERCISES: '@pumpd_exercises',
  SPLITS: '@pumpd_splits',
  WORKOUT_LOGS: '@pumpd_workout_logs',
  NUTRITION_LOGS: '@pumpd_nutrition_logs',
  BODY_METRICS: '@pumpd_body_metrics',
  USER_SCHEDULES: '@pumpd_user_schedules',
  // Trainer & Client Dual Mode Keys
  USER_ROLE: '@pumpd_user_role',
  COACH_PROFILE: '@pumpd_coach_profile',
  CLIENTS: '@pumpd_clients',
  PRESCRIBED_ARCHETYPES: '@pumpd_prescribed_archetypes',
  ACTIVE_SESSION: '@pumpd_auth_session',
  REGISTERED_ACCOUNTS: '@pumpd_registered_accounts',
} as const;

export interface AppStoredData {
  currentUser: UserProfile | null;
  partnerUser: UserProfile | null;
  activeUserId: string | null;
  activeWorkspace: Workspace | null;
  exercises: Exercise[] | null;
  splits: Split[] | null;
  workoutLogs: WorkoutLog[] | null;
  nutritionLogs: NutritionLog[] | null;
  bodyMetrics: BodyMetric[] | null;
  userSchedules: Record<string, DaySchedule[]> | null;
  userRole: UserRole | null;
  coachProfile: CoachProfile | null;
  clients: ClientProfile[] | null;
  prescribedArchetypes: PrescribedMealArchetype[] | null;
}

export async function loadStoredAppData(): Promise<AppStoredData | null> {
  try {
    const isInitialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInitialized) {
      return null;
    }

    const keys = [
      STORAGE_KEYS.CURRENT_USER,
      STORAGE_KEYS.PARTNER_USER,
      STORAGE_KEYS.ACTIVE_USER_ID,
      STORAGE_KEYS.WORKSPACE,
      STORAGE_KEYS.EXERCISES,
      STORAGE_KEYS.SPLITS,
      STORAGE_KEYS.WORKOUT_LOGS,
      STORAGE_KEYS.NUTRITION_LOGS,
      STORAGE_KEYS.BODY_METRICS,
      STORAGE_KEYS.USER_SCHEDULES,
      STORAGE_KEYS.USER_ROLE,
      STORAGE_KEYS.COACH_PROFILE,
      STORAGE_KEYS.CLIENTS,
      STORAGE_KEYS.PRESCRIBED_ARCHETYPES,
    ];

    const pairs = await AsyncStorage.multiGet(keys);
    const dataMap: Record<string, string | null> = {};
    pairs.forEach(([k, v]) => {
      dataMap[k] = v;
    });

    const safeParse = <T>(val: string | null | undefined): T | null => {
      if (!val) return null;
      try {
        return JSON.parse(val) as T;
      } catch {
        return null;
      }
    };

    return {
      currentUser: safeParse<UserProfile>(dataMap[STORAGE_KEYS.CURRENT_USER]),
      partnerUser: safeParse<UserProfile>(dataMap[STORAGE_KEYS.PARTNER_USER]),
      activeUserId: dataMap[STORAGE_KEYS.ACTIVE_USER_ID] || null,
      activeWorkspace: safeParse<Workspace>(dataMap[STORAGE_KEYS.WORKSPACE]),
      exercises: safeParse<Exercise[]>(dataMap[STORAGE_KEYS.EXERCISES]),
      splits: safeParse<Split[]>(dataMap[STORAGE_KEYS.SPLITS]),
      workoutLogs: safeParse<WorkoutLog[]>(dataMap[STORAGE_KEYS.WORKOUT_LOGS]),
      nutritionLogs: safeParse<NutritionLog[]>(dataMap[STORAGE_KEYS.NUTRITION_LOGS]),
      bodyMetrics: safeParse<BodyMetric[]>(dataMap[STORAGE_KEYS.BODY_METRICS]),
      userSchedules: safeParse<Record<string, DaySchedule[]>>(dataMap[STORAGE_KEYS.USER_SCHEDULES]),
      userRole: safeParse<UserRole>(dataMap[STORAGE_KEYS.USER_ROLE]) || (dataMap[STORAGE_KEYS.USER_ROLE] as UserRole) || null,
      coachProfile: safeParse<CoachProfile>(dataMap[STORAGE_KEYS.COACH_PROFILE]),
      clients: safeParse<ClientProfile[]>(dataMap[STORAGE_KEYS.CLIENTS]),
      prescribedArchetypes: safeParse<PrescribedMealArchetype[]>(dataMap[STORAGE_KEYS.PRESCRIBED_ARCHETYPES]),
    };
  } catch (err) {
    console.error('[Storage] Error loading app data:', err);
    return null;
  }
}

export async function persistAppData(data: {
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  activeUserId: string;
  activeWorkspace: Workspace;
  exercises: Exercise[];
  splits: Split[];
  workoutLogs: WorkoutLog[];
  nutritionLogs: NutritionLog[];
  bodyMetrics: BodyMetric[];
  userSchedules: Record<string, DaySchedule[]>;
  userRole?: UserRole;
  coachProfile?: CoachProfile;
  clients?: ClientProfile[];
  prescribedArchetypes?: PrescribedMealArchetype[];
}): Promise<void> {
  try {
    const pairs: [string, string][] = [
      [STORAGE_KEYS.INITIALIZED, 'true'],
      [STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.currentUser)],
      [STORAGE_KEYS.PARTNER_USER, JSON.stringify(data.partnerUser)],
      [STORAGE_KEYS.ACTIVE_USER_ID, data.activeUserId],
      [STORAGE_KEYS.WORKSPACE, JSON.stringify(data.activeWorkspace)],
      [STORAGE_KEYS.EXERCISES, JSON.stringify(data.exercises)],
      [STORAGE_KEYS.SPLITS, JSON.stringify(data.splits)],
      [STORAGE_KEYS.WORKOUT_LOGS, JSON.stringify(data.workoutLogs)],
      [STORAGE_KEYS.NUTRITION_LOGS, JSON.stringify(data.nutritionLogs)],
      [STORAGE_KEYS.BODY_METRICS, JSON.stringify(data.bodyMetrics)],
      [STORAGE_KEYS.USER_SCHEDULES, JSON.stringify(data.userSchedules)],
    ];

    if (data.userRole) {
      pairs.push([STORAGE_KEYS.USER_ROLE, JSON.stringify(data.userRole)]);
    }
    if (data.coachProfile) {
      pairs.push([STORAGE_KEYS.COACH_PROFILE, JSON.stringify(data.coachProfile)]);
    }
    if (data.clients) {
      pairs.push([STORAGE_KEYS.CLIENTS, JSON.stringify(data.clients)]);
    }
    if (data.prescribedArchetypes) {
      pairs.push([STORAGE_KEYS.PRESCRIBED_ARCHETYPES, JSON.stringify(data.prescribedArchetypes)]);
    }

    await AsyncStorage.multiSet(pairs);
  } catch (err) {
    console.error('[Storage] Error saving app data:', err);
  }
}

export async function clearStoredAppData(): Promise<void> {
  try {
    const allKeys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(allKeys);
  } catch (err) {
    console.error('[Storage] Error clearing app data:', err);
  }
}

export interface UserSession {
  uid: string;
  email: string;
  displayName: string;
  userRole?: UserRole;
}

export interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
  password?: string;
  userRole?: UserRole;
  createdAt: number;
}

export async function getActiveSession(): Promise<UserSession | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setActiveSession(session: UserSession): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (err) {
    console.error('[Storage] Error saving active session:', err);
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch (err) {
    console.error('[Storage] Error clearing active session:', err);
  }
}

export async function getStoredAccounts(): Promise<StoredAccount[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.REGISTERED_ACCOUNTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveStoredAccount(account: StoredAccount): Promise<void> {
  try {
    const existing = await getStoredAccounts();
    const filtered = existing.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
    filtered.push(account);
    await AsyncStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(filtered));
  } catch (err) {
    console.error('[Storage] Error saving account:', err);
  }
}

export async function loadUserData(userId: string): Promise<{
  workoutLogs: WorkoutLog[] | null;
  nutritionLogs: NutritionLog[] | null;
  bodyMetrics: BodyMetric[] | null;
  userRole?: UserRole | null;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(`@pumpd_user_data_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function persistUserData(
  userId: string,
  data: {
    workoutLogs: WorkoutLog[];
    nutritionLogs: NutritionLog[];
    bodyMetrics: BodyMetric[];
    userRole?: UserRole;
  }
): Promise<void> {
  try {
    await AsyncStorage.setItem(`@pumpd_user_data_${userId}`, JSON.stringify(data));
  } catch (err) {
    console.error('[Storage] Error saving user data:', err);
  }
}

