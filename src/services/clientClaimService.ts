import { ClientProfile, ClientClaimToken, LinkedCoach, PrescribedMealArchetype } from '../types/trainer';
import { UserProfile, WorkoutLog, NutritionLog, MacroTargets, BodyMetric, Split } from '../types';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { sanitizeForFirestore } from './firestoreService';

/**
 * Cloud Account Claiming & Personal Trainer Synchronization Service
 *
 * Facilitates the transition of offline "Type A: Shadow Client" profiles
 * into active "Type B: Linked Client" profiles when an athlete registers or enters
 * a coach's PIN on any device.
 *
 * Automatically migrates past workouts, nutrition logs, macro targets, and
 * meal archetypes to the athlete's account and updates the coach's roster in real time.
 */

export interface ClientClaimCloudRecord {
  code: string;               // e.g. "RIP-347K"
  rawPin: string;             // e.g. "347K"
  coachId: string;
  coachName: string;
  coachBusiness?: string;
  coachInstagram?: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  macroTargets?: MacroTargets;
  prescribedArchetypes?: PrescribedMealArchetype[];
  assignedSplitName?: string;
  assignedRoutineIds?: string[];
  assignedRoutineNames?: string[];
  initialWorkouts?: WorkoutLog[];
  initialNutrition?: NutritionLog[];
  initialBodyMetrics?: BodyMetric[];
  initialSplits?: Split[];
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
  claimedByUserId?: string | null;
  claimedAt?: number | null;
  athleteName?: string;
  athleteEmail?: string;
}

const COLLECTION_NAME = 'client_claims';
const LOCAL_CLAIM_PREFIX = '@ripped_claim_';

/**
 * Normalizes any variation of an invite code (e.g. "RIP-8K2", "8k2", "rip 8k2", legacy "PUMP-8K2", QR JSON)
 * into a standard format:
 * - standardCode: "RIP-8K2"
 * - pinOnly: "8K2"
 */
export function normalizeClaimCode(raw: string): { standardCode: string; pinOnly: string } {
  let clean = (raw || '').trim().toUpperCase();

  // Check if input is a JSON string from a scanned QR payload
  if (clean.startsWith('{') && (clean.includes('RIPPED_CLIENT_CLAIM') || clean.includes('PUMPD_CLIENT_CLAIM'))) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed.code) clean = parsed.code.toUpperCase();
    } catch {
      // Continue with raw input
    }
  }

  // Remove any spaces or symbols, keeping only alphanumeric characters
  const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');
  let pinOnly = alphanumeric;
  if (pinOnly.startsWith('RIPPED')) pinOnly = pinOnly.slice(6);
  else if (pinOnly.startsWith('RIP')) pinOnly = pinOnly.slice(3);
  else if (pinOnly.startsWith('PUMP')) pinOnly = pinOnly.slice(4);

  const standardCode = `RIP-${pinOnly}`;

  return { standardCode, pinOnly };
}

/**
 * Generates a 6-character claim token with QR payload, valid for 30 days.
 */
export function generateClaimToken(client: ClientProfile, coachName: string): ClientClaimToken {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const code = `RIP-${randomPart}`;
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // Valid for 30 days

  const qrPayload = JSON.stringify({
    type: 'RIPPED_CLIENT_CLAIM',
    code,
    clientId: client.id,
    clientName: client.name,
    coachName,
  });

  return {
    code,
    expiresAt,
    qrPayload,
  };
}

/**
 * Publishes the claim token to Cloud Firestore and local storage cache
 * so any device can claim it instantly.
 */
export async function publishClientClaimCloud(
  token: ClientClaimToken,
  client: ClientProfile,
  coachUserId: string,
  coachName: string,
  coachProfile?: Partial<{ businessName: string; instagramHandle: string }>,
  allWorkouts: WorkoutLog[] = [],
  allNutrition: NutritionLog[] = [],
  allBodyMetrics: BodyMetric[] = [],
  allSplits: Split[] = []
): Promise<void> {
  const { standardCode, pinOnly } = normalizeClaimCode(token.code);
  const clientSpecificSplits = allSplits.filter((s) => s.userId === client.id);
  const assignedSplit = (client.assignedSplitId || client.assignedSplitName)
    ? allSplits.find(
        (s) =>
          (client.assignedSplitId && s.id === client.assignedSplitId) ||
          (client.assignedSplitName && s.name.trim().toLowerCase() === client.assignedSplitName.trim().toLowerCase())
      )
    : null;
  const initialSplits =
    clientSpecificSplits.length > 0
      ? clientSpecificSplits
      : assignedSplit
      ? [{ ...assignedSplit, userId: client.id, isActive: true }]
      : [];

  const payload: ClientClaimCloudRecord = {
    code: standardCode,
    rawPin: pinOnly,
    coachId: coachUserId,
    coachName: coachName || 'Personal Trainer',
    coachBusiness: coachProfile?.businessName || '',
    coachInstagram: coachProfile?.instagramHandle || '',
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email || '',
    macroTargets: client.macroTargets || { calories: 2500, protein: 180, carbs: 250, fats: 70 },
    prescribedArchetypes: client.prescribedArchetypes || [],
    assignedSplitName: client.assignedSplitName || '',
    assignedRoutineIds: client.assignedRoutineIds || [],
    assignedRoutineNames: client.assignedRoutineNames || [],
    initialWorkouts: allWorkouts.filter((w) => w.userId === client.id),
    initialNutrition: allNutrition.filter((n) => n.userId === client.id),
    initialBodyMetrics: allBodyMetrics.filter((m) => m.userId === client.id),
    initialSplits,
    createdAt: Date.now(),
    expiresAt: token.expiresAt,
    claimed: false,
    claimedByUserId: null,
    claimedAt: null,
  };

  const sanitized = sanitizeForFirestore(payload);

  // 1. Write to Firestore under standardCode ("PUMP-8K2") and rawPin ("8K2")
  try {
    await setDoc(doc(db, COLLECTION_NAME, standardCode), sanitized);
    await setDoc(doc(db, COLLECTION_NAME, pinOnly), sanitized);
  } catch (err) {
    console.warn('[ClientClaim] Firestore publish error (cached locally):', err);
  }

  // 2. Cache in local storage for offline capability
  try {
    await AsyncStorage.setItem(`${LOCAL_CLAIM_PREFIX}${standardCode}`, JSON.stringify(payload));
    await AsyncStorage.setItem(`${LOCAL_CLAIM_PREFIX}${pinOnly}`, JSON.stringify(payload));
  } catch {}
}

/**
 * Looks up a claim token across Cloud Firestore and local device cache.
 */
export async function lookupClientClaimCloud(
  rawInput: string
): Promise<ClientClaimCloudRecord | null> {
  const { standardCode, pinOnly } = normalizeClaimCode(rawInput);
  if (!pinOnly) return null;

  // 1. Try direct document lookup by standardCode in Firestore
  try {
    const docRef1 = doc(db, COLLECTION_NAME, standardCode);
    const snap1 = await getDoc(docRef1);
    if (snap1.exists()) {
      return snap1.data() as ClientClaimCloudRecord;
    }
  } catch (err) {
    console.warn('[ClientClaim] Lookup by standardCode failed, trying pinOnly:', err);
  }

  // 2. Try direct document lookup by pinOnly in Firestore
  try {
    const docRef2 = doc(db, COLLECTION_NAME, pinOnly);
    const snap2 = await getDoc(docRef2);
    if (snap2.exists()) {
      return snap2.data() as ClientClaimCloudRecord;
    }
  } catch (err) {
    console.warn('[ClientClaim] Lookup by pinOnly failed, trying query:', err);
  }

  // 3. Query collection where code == standardCode or rawPin == pinOnly
  try {
    const q = query(collection(db, COLLECTION_NAME), where('rawPin', '==', pinOnly));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as ClientClaimCloudRecord;
    }
  } catch (err) {
    console.warn('[ClientClaim] Query fallback failed, checking offline cache:', err);
  }

  // 4. Check local AsyncStorage cache
  try {
    const cached1 = await AsyncStorage.getItem(`${LOCAL_CLAIM_PREFIX}${standardCode}`);
    if (cached1) return JSON.parse(cached1);
    const cached2 = await AsyncStorage.getItem(`${LOCAL_CLAIM_PREFIX}${pinOnly}`);
    if (cached2) return JSON.parse(cached2);
  } catch {}

  return null;
}

/**
 * Executes account linking in Cloud Firestore:
 * - Marks claim record as claimed by athlete
 * - Updates coach's user doc so the client is marked as linked with athlete's UID
 * - Copies past workouts and nutrition logs to athlete's account
 * - Updates athlete's user profile with coach link and prescribed macros/archetypes
 */
export async function executeClientClaimCloud(
  claimRecord: ClientClaimCloudRecord,
  athleteUser: UserProfile
): Promise<void> {
  const { standardCode, pinOnly } = normalizeClaimCode(claimRecord.code);

  const claimUpdates = {
    claimed: true,
    claimedByUserId: athleteUser.id,
    claimedAt: Date.now(),
    athleteName: athleteUser.displayName || '',
    athleteEmail: athleteUser.email || '',
  };

  // 1. Mark claim document as claimed in Firestore
  try {
    await setDoc(doc(db, COLLECTION_NAME, standardCode), claimUpdates, { merge: true });
    await setDoc(doc(db, COLLECTION_NAME, pinOnly), claimUpdates, { merge: true });
  } catch (err) {
    console.warn('[ClientClaim] Could not update claim doc status:', err);
  }

  // 2. Update coach's client roster in Firestore so coach's roster shows Type B: Linked Client
  try {
    const coachRef = doc(db, 'users', claimRecord.coachId);
    const coachSnap = await getDoc(coachRef);
    if (coachSnap.exists()) {
      const coachData = coachSnap.data();
      const currentClients: ClientProfile[] = Array.isArray(coachData?.clients) ? coachData.clients : [];
      const updatedClients = currentClients.map((c) =>
        c.id === claimRecord.clientId
          ? {
              ...c,
              type: 'linked' as const,
              linkedUserId: athleteUser.id,
              linkedAt: Date.now(),
              status: 'active' as const,
              email: athleteUser.email || c.email,
              claimToken: undefined,
            }
          : c
      );
      await setDoc(
        coachRef,
        sanitizeForFirestore({ clients: updatedClients, updatedAt: Date.now() }),
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('[ClientClaim] Error linking client in coach roster:', err);
  }

  // 3. Update the athlete's user document in Firestore
  try {
    const athleteRef = doc(db, 'users', athleteUser.id);
    await setDoc(
      athleteRef,
      sanitizeForFirestore({
        macroTargets: claimRecord.macroTargets,
        prescribedArchetypes: claimRecord.prescribedArchetypes,
        linkedCoach: {
          name: claimRecord.coachName,
          businessName: claimRecord.coachBusiness,
          instagramHandle: claimRecord.coachInstagram,
          coachId: claimRecord.coachId,
          linkedAt: Date.now(),
        },
        athleteMembership: {
          status: 'sponsored_by_coach',
          coachName: claimRecord.coachName,
          coachBusiness: claimRecord.coachBusiness,
        },
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('[ClientClaim] Error updating athlete cloud profile:', err);
  }

  // 4. Transfer past workout logs recorded for the shadow client to the athlete's cloud account
  const workoutsToCopy: WorkoutLog[] = Array.isArray(claimRecord.initialWorkouts) ? [...claimRecord.initialWorkouts] : [];
  try {
    const liveWorkoutsSnap = await getDocs(collection(db, 'users', claimRecord.clientId, 'workouts'));
    liveWorkoutsSnap.forEach((d) => {
      const w = d.data() as WorkoutLog;
      if (!workoutsToCopy.some((existing) => existing.id === w.id)) {
        workoutsToCopy.push(w);
      }
    });
  } catch (err) {
    console.warn('[ClientClaim] Could not read live shadow workouts:', err);
  }

  for (const w of workoutsToCopy) {
    try {
      const transferredWorkout: WorkoutLog = {
        ...w,
        userId: athleteUser.id,
      };
      await setDoc(
        doc(db, 'users', athleteUser.id, 'workouts', transferredWorkout.id),
        sanitizeForFirestore(transferredWorkout)
      );
    } catch (err) {
      console.warn('[ClientClaim] Error copying workout to athlete:', err);
    }
  }

  // 5. Transfer past nutrition logs recorded for the shadow client to the athlete's cloud account
  const nutritionToCopy: NutritionLog[] = Array.isArray(claimRecord.initialNutrition) ? [...claimRecord.initialNutrition] : [];
  try {
    const liveNutritionSnap = await getDocs(collection(db, 'users', claimRecord.clientId, 'nutrition'));
    liveNutritionSnap.forEach((d) => {
      const n = d.data() as NutritionLog;
      if (!nutritionToCopy.some((existing) => existing.date === n.date)) {
        nutritionToCopy.push(n);
      }
    });
  } catch (err) {
    console.warn('[ClientClaim] Could not read live shadow nutrition:', err);
  }

  for (const n of nutritionToCopy) {
    try {
      const transferredNutrition: NutritionLog = {
        ...n,
        userId: athleteUser.id,
      };
      await setDoc(
        doc(db, 'users', athleteUser.id, 'nutrition', transferredNutrition.date),
        sanitizeForFirestore(transferredNutrition)
      );
    } catch (err) {
      console.warn('[ClientClaim] Error copying nutrition to athlete:', err);
    }
  }

  // 6. Transfer past body metrics recorded for the shadow client to the athlete's cloud account
  const metricsToCopy: BodyMetric[] = Array.isArray(claimRecord.initialBodyMetrics) ? [...claimRecord.initialBodyMetrics] : [];
  try {
    const liveMetricsSnap = await getDocs(collection(db, 'users', claimRecord.clientId, 'bodyMetrics'));
    liveMetricsSnap.forEach((d) => {
      const bm = d.data() as BodyMetric;
      if (!metricsToCopy.some((existing) => existing.id === bm.id)) {
        metricsToCopy.push(bm);
      }
    });
  } catch (err) {
    console.warn('[ClientClaim] Could not read live shadow metrics:', err);
  }

  for (const bm of metricsToCopy) {
    try {
      const transferredMetric: BodyMetric = {
        ...bm,
        userId: athleteUser.id,
      };
      await setDoc(
        doc(db, 'users', athleteUser.id, 'bodyMetrics', transferredMetric.id),
        sanitizeForFirestore(transferredMetric)
      );
    } catch (err) {
      console.warn('[ClientClaim] Error copying body metric to athlete:', err);
    }
  }

  // 7. Transfer assigned splits and weekly schedule to the athlete's cloud account
  if (Array.isArray(claimRecord.initialSplits) && claimRecord.initialSplits.length > 0) {
    try {
      const transferredSplits: Split[] = claimRecord.initialSplits.map((s) => ({
        ...s,
        userId: athleteUser.id,
      }));
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const activeSplit = transferredSplits.find((s) => s.isActive) || transferredSplits[0];
      const weeklySchedule = days.map((day, idx) => {
        const routine = activeSplit.routines?.[idx];
        return routine
          ? { day, routineId: routine.id, routineName: routine.name, exerciseIds: routine.exerciseIds || [] }
          : { day, routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] };
      });
      await setDoc(
        doc(db, 'users', athleteUser.id),
        sanitizeForFirestore({ splits: transferredSplits, weeklySchedule, updatedAt: Date.now() }),
        { merge: true }
      );
    } catch (err) {
      console.warn('[ClientClaim] Error copying splits to athlete:', err);
    }
  }
}
