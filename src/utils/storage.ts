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
  LinkedCoach,
  TrainerSubscription,
  AthleteMembership,
  AccountType,
} from '../types/trainer';

export const STORAGE_KEYS = {
  INITIALIZED: '@ripped_initialized_v1',
  CURRENT_USER: '@ripped_current_user',
  PARTNER_USER: '@ripped_partner_user',
  ACTIVE_USER_ID: '@ripped_active_user_id',
  WORKSPACE: '@ripped_workspace',
  EXERCISES: '@ripped_exercises',
  SPLITS: '@ripped_splits',
  WORKOUT_LOGS: '@ripped_workout_logs',
  NUTRITION_LOGS: '@ripped_nutrition_logs',
  BODY_METRICS: '@ripped_body_metrics',
  USER_SCHEDULES: '@ripped_user_schedules',
  // Trainer & Client Dual Mode Keys
  USER_ROLE: '@ripped_user_role',
  ACCOUNT_TYPE: '@ripped_account_type',
  COACH_PROFILE: '@ripped_coach_profile',
  CLIENTS: '@ripped_clients',
  PRESCRIBED_ARCHETYPES: '@ripped_prescribed_archetypes',
  LINKED_COACH: '@ripped_linked_coach',
  TRAINER_SUBSCRIPTION: '@ripped_trainer_subscription',
  ATHLETE_MEMBERSHIP: '@ripped_athlete_membership',
  ACTIVE_SESSION: '@ripped_auth_session',
  REGISTERED_ACCOUNTS: '@ripped_registered_accounts',
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
  accountType: AccountType | null;
  coachProfile: CoachProfile | null;
  clients: ClientProfile[] | null;
  prescribedArchetypes: PrescribedMealArchetype[] | null;
  linkedCoach: LinkedCoach | null;
  trainerSubscription: TrainerSubscription | null;
  athleteMembership: AthleteMembership | null;
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
      STORAGE_KEYS.ACCOUNT_TYPE,
      STORAGE_KEYS.COACH_PROFILE,
      STORAGE_KEYS.CLIENTS,
      STORAGE_KEYS.PRESCRIBED_ARCHETYPES,
      STORAGE_KEYS.LINKED_COACH,
      STORAGE_KEYS.TRAINER_SUBSCRIPTION,
      STORAGE_KEYS.ATHLETE_MEMBERSHIP,
    ];

    const pairs = await AsyncStorage.multiGet(keys);
    const dataMap: Record<string, string | null> = {};
    for (const [k, v] of pairs) {
      if (v !== null) {
        dataMap[k] = v;
      } else {
        const legacyKey = k.replace('@ripped_', '@pumpd_');
        dataMap[k] = await AsyncStorage.getItem(legacyKey);
      }
    }

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
      accountType: (dataMap[STORAGE_KEYS.ACCOUNT_TYPE] as AccountType) || null,
      coachProfile: safeParse<CoachProfile>(dataMap[STORAGE_KEYS.COACH_PROFILE]),
      clients: safeParse<ClientProfile[]>(dataMap[STORAGE_KEYS.CLIENTS]),
      prescribedArchetypes: safeParse<PrescribedMealArchetype[]>(dataMap[STORAGE_KEYS.PRESCRIBED_ARCHETYPES]),
      linkedCoach: safeParse<LinkedCoach>(dataMap[STORAGE_KEYS.LINKED_COACH]),
      trainerSubscription: safeParse<TrainerSubscription>(dataMap[STORAGE_KEYS.TRAINER_SUBSCRIPTION]),
      athleteMembership: safeParse<AthleteMembership>(dataMap[STORAGE_KEYS.ATHLETE_MEMBERSHIP]),
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
  accountType?: AccountType | null;
  coachProfile?: CoachProfile;
  clients?: ClientProfile[];
  prescribedArchetypes?: PrescribedMealArchetype[];
  linkedCoach?: LinkedCoach | null;
  trainerSubscription?: TrainerSubscription | null;
  athleteMembership?: AthleteMembership | null;
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
    if (data.accountType) {
      pairs.push([STORAGE_KEYS.ACCOUNT_TYPE, data.accountType]);
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
    if (data.linkedCoach !== undefined) {
      if (data.linkedCoach) {
        pairs.push([STORAGE_KEYS.LINKED_COACH, JSON.stringify(data.linkedCoach)]);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.LINKED_COACH);
      }
    }
    if (data.trainerSubscription !== undefined) {
      if (data.trainerSubscription) {
        pairs.push([STORAGE_KEYS.TRAINER_SUBSCRIPTION, JSON.stringify(data.trainerSubscription)]);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.TRAINER_SUBSCRIPTION);
      }
    }
    if (data.athleteMembership !== undefined) {
      if (data.athleteMembership) {
        pairs.push([STORAGE_KEYS.ATHLETE_MEMBERSHIP, JSON.stringify(data.athleteMembership)]);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ATHLETE_MEMBERSHIP);
      }
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
  accountType?: AccountType;
}

export interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
  password?: string;
  userRole?: UserRole;
  accountType?: AccountType;
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
    let raw = await AsyncStorage.getItem(`@ripped_user_data_${userId}`);
    if (!raw) {
      raw = await AsyncStorage.getItem(`@pumpd_user_data_${userId}`);
    }
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
    await AsyncStorage.setItem(`@ripped_user_data_${userId}`, JSON.stringify(data));
  } catch (err) {
    console.error('[Storage] Error saving user data:', err);
  }
}

