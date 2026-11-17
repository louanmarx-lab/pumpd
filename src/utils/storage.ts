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
  WeightUnit,
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

const workspaceKey = (uid: string) => `@ripped_workspace_data_${uid}`;

export async function loadStoredAppData(uid: string, legacyOwnerId = uid): Promise<AppStoredData | null> {
  try {
    const scoped = await AsyncStorage.getItem(workspaceKey(uid));
    if (scoped) {
      const data = JSON.parse(scoped) as AppStoredData | null;
      return data?.currentUser?.id === uid ? data : null;
    }

    const isInitialized = await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED)
      || await AsyncStorage.getItem(STORAGE_KEYS.INITIALIZED.replace('@ripped_', '@pumpd_'));
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

    const currentUser = safeParse<UserProfile>(dataMap[STORAGE_KEYS.CURRENT_USER]);
    if (currentUser?.id !== legacyOwnerId) return null;

    return {
      currentUser,
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
  const owner=data.currentUser.id;
  const serialized=JSON.stringify(data);
  const write=(workspaceWrites.get(owner)||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!frozenOwners.has(owner))await AsyncStorage.setItem(workspaceKey(owner),serialized);
  });
  workspaceWrites.set(owner,write);await write;
}

export async function clearStoredAppData(uid: string): Promise<void> {
  await AsyncStorage.setItem(workspaceKey(uid), 'null');
  await AsyncStorage.multiRemove([`@ripped_user_data_${uid}`, `@pumpd_user_data_${uid}`]);
}

export interface UserSession {
  uid: string;
  email: string;
  displayName: string;
  userRole?: UserRole;
  accountType?: AccountType;
  isLocalGuest?: boolean;
  weightUnit?: WeightUnit;
  trainerCode?: string;
}

export interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
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

export function setActiveSession(session: UserSession): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
}

export function clearActiveSession(): Promise<void> {
  return AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
}

const guestOwnerKey = (role: UserRole) => `@ripped_guest_workspace_${role}`;

export function getGuestOwner(role: UserRole): Promise<string | null> {
  return AsyncStorage.getItem(guestOwnerKey(role));
}

export function rememberGuestOwner(role: UserRole, uid: string): Promise<void> {
  return AsyncStorage.setItem(guestOwnerKey(role), uid);
}

export async function getStoredAccounts(): Promise<StoredAccount[]> {
  const accounts = new Map<string, StoredAccount>();
  for (const key of [STORAGE_KEYS.REGISTERED_ACCOUNTS.replace('@ripped_', '@pumpd_'), STORAGE_KEYS.REGISTERED_ACCOUNTS]) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    const sanitized = parsed.flatMap((record) => {
      if (!record || typeof record.id !== 'string' || typeof record.email !== 'string') return [];
      const { password: _password, ...account } = record;
      accounts.set(account.id, account);
      return [account];
    });
    if (JSON.stringify(sanitized) !== raw) {
      await AsyncStorage.setItem(key, JSON.stringify(sanitized));
    }
  }
  return [...accounts.values()];
}

export async function saveStoredAccount(account: StoredAccount): Promise<void> {
  const existing = await getStoredAccounts();
  const next = existing.filter((item) => item.id !== account.id);
  const { id, email, displayName, userRole, accountType, createdAt } = account;
  next.push({ id, email, displayName, userRole, accountType, createdAt });
  await AsyncStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(next));
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


const frozenOwners = new Set<string>();
const workspaceWrites=new Map<string,Promise<void>>();
export function freezeLocalOwner(uid:string) { frozenOwners.add(uid); }
export function unfreezeLocalOwner(uid:string) { frozenOwners.delete(uid); }
export async function eraseOwnerLocalData(uid:string):Promise<void> {
  frozenOwners.add(uid);
  await workspaceWrites.get(uid)?.catch(()=>{});
  const keys=await AsyncStorage.getAllKeys();
  const owned=keys.filter(key=>key===workspaceKey(uid)||key===`@ripped_user_data_${uid}`||key===`@pumpd_user_data_${uid}`||key===`@ripped_cloud_outbox_${uid}`||['@ripped_','@pumpd_'].some(prefix=>key.startsWith(`${prefix}workout_draft_${JSON.stringify([uid]).slice(0,-1)},`)));
  for(const prefix of ['@ripped_','@pumpd_']){
    const raw=await AsyncStorage.getItem(`${prefix}current_user`);
    if(raw && (()=>{try{return JSON.parse(raw)?.id===uid;}catch{return false;}})())owned.push(...Object.values(STORAGE_KEYS).map(key=>key.replace('@ripped_',prefix)).filter(key=>!key.endsWith('registered_accounts')&&!key.endsWith('auth_session')));
    const registryKey=`${prefix}registered_accounts`;
    const registry=await AsyncStorage.getItem(registryKey);
    if(registry){try{const entries=JSON.parse(registry);if(Array.isArray(entries))await AsyncStorage.setItem(registryKey,JSON.stringify(entries.filter((item:StoredAccount)=>item.id!==uid)));}catch{}}
  }
  for(const cacheKey of keys.filter(key=>key.startsWith('@ripped_shared_split_')||key.startsWith('@pumpd_shared_split_'))){
    try{const payload=JSON.parse((await AsyncStorage.getItem(cacheKey))||'null');if(payload?.authorId===uid)owned.push(cacheKey);}catch{}
  }
  await AsyncStorage.multiRemove([...new Set(owned)]);
  const session=await getActiveSession();if(session?.uid===uid)await clearActiveSession();
}
