import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  UserProfile,
  WorkoutLog,
  NutritionLog,
  BodyMetric,
  Split,
} from '../types';
import { CoachProfile, ClientProfile, PrescribedMealArchetype } from '../types/trainer';

/**
 * Cloud Firestore Service with Offline-First Local Cache Persistence
 *
 * All operations execute immediately against local device cache and sync
 * to Google Cloud Firestore in the background when network connectivity is available.
 */

/**
 * Safely removes `undefined` properties recursively so Cloud Firestore writes never fail.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value === undefined ? null : value))
  );
}

// ----------------------------------------------------
// 1. User Profile & Preferences
// ----------------------------------------------------

export async function saveUserProfileCloud(
  userId: string,
  profile: Partial<UserProfile> & Record<string, any>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, sanitizeForFirestore({ ...profile, updatedAt: Date.now() }), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving user profile to cloud (cached locally):', err);
  }
}

export async function fetchUserProfileCloud(
  userId: string
): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn('[Firestore] Error fetching user profile:', err);
  }
  return null;
}

// ----------------------------------------------------
// 2. Workout Logs
// ----------------------------------------------------

export async function saveWorkoutLogCloud(
  userId: string,
  workoutLog: WorkoutLog
): Promise<void> {
  try {
    const workoutRef = doc(db, 'users', userId, 'workouts', workoutLog.id);
    await setDoc(workoutRef, { ...workoutLog, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[Firestore] Error saving workout log (cached locally):', err);
  }
}

export async function deleteWorkoutLogCloud(
  userId: string,
  logId: string
): Promise<void> {
  try {
    const workoutRef = doc(db, 'users', userId, 'workouts', logId);
    await deleteDoc(workoutRef);
  } catch (err) {
    console.warn('[Firestore] Error deleting workout log:', err);
  }
}

export function subscribeToWorkoutLogs(
  userId: string,
  onUpdate: (logs: WorkoutLog[]) => void
): Unsubscribe {
  try {
    const workoutsColl = collection(db, 'users', userId, 'workouts');
    return onSnapshot(
      workoutsColl,
      (snapshot) => {
        const logs: WorkoutLog[] = [];
        snapshot.forEach((d) => {
          logs.push(d.data() as WorkoutLog);
        });
        // Sort newest first
        logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        onUpdate(logs);
      },
      (err) => {
        console.warn('[Firestore] Workout logs snapshot listener error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error subscribing to workout logs:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// 3. Nutrition Logs
// ----------------------------------------------------

export async function saveNutritionLogCloud(
  userId: string,
  nutritionLog: NutritionLog
): Promise<void> {
  try {
    // Key by date to ensure unique daily entries
    const logRef = doc(db, 'users', userId, 'nutrition', nutritionLog.date);
    await setDoc(logRef, { ...nutritionLog, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[Firestore] Error saving nutrition log (cached locally):', err);
  }
}

export async function deleteNutritionMealCloud(
  userId: string,
  date: string,
  mealId: string,
  existingLog: NutritionLog
): Promise<void> {
  try {
    const updatedMeals = existingLog.meals.filter((m) => m.id !== mealId);
    const logRef = doc(db, 'users', userId, 'nutrition', date);
    await setDoc(logRef, {
      ...existingLog,
      meals: updatedMeals,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[Firestore] Error deleting nutrition meal:', err);
  }
}

export function subscribeToNutritionLogs(
  userId: string,
  onUpdate: (logs: NutritionLog[]) => void
): Unsubscribe {
  try {
    const nutritionColl = collection(db, 'users', userId, 'nutrition');
    return onSnapshot(
      nutritionColl,
      (snapshot) => {
        const logs: NutritionLog[] = [];
        snapshot.forEach((d) => {
          logs.push(d.data() as NutritionLog);
        });
        logs.sort((a, b) => b.date.localeCompare(a.date));
        onUpdate(logs);
      },
      (err) => {
        console.warn('[Firestore] Nutrition logs snapshot error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error subscribing to nutrition logs:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// 4. Body Metrics (Weight, Body Fat %, Skeletal Muscle)
// ----------------------------------------------------

export async function saveBodyMetricCloud(
  userId: string,
  metric: BodyMetric
): Promise<void> {
  try {
    const metricRef = doc(db, 'users', userId, 'bodyMetrics', metric.id);
    await setDoc(metricRef, { ...metric, updatedAt: Date.now() });
  } catch (err) {
    console.warn('[Firestore] Error saving body metric (cached locally):', err);
  }
}

export async function deleteBodyMetricCloud(
  userId: string,
  metricId: string
): Promise<void> {
  try {
    const metricRef = doc(db, 'users', userId, 'bodyMetrics', metricId);
    await deleteDoc(metricRef);
  } catch (err) {
    console.warn('[Firestore] Error deleting body metric:', err);
  }
}

export function subscribeToBodyMetrics(
  userId: string,
  onUpdate: (metrics: BodyMetric[]) => void
): Unsubscribe {
  try {
    const metricsColl = collection(db, 'users', userId, 'bodyMetrics');
    return onSnapshot(
      metricsColl,
      (snapshot) => {
        const metrics: BodyMetric[] = [];
        snapshot.forEach((d) => {
          metrics.push(d.data() as BodyMetric);
        });
        metrics.sort((a, b) => a.date.localeCompare(b.date));
        onUpdate(metrics);
      },
      (err) => {
        console.warn('[Firestore] Body metrics snapshot error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error subscribing to body metrics:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// 5. Splits & Routines
// ----------------------------------------------------

export async function saveSplitsCloud(
  userId: string,
  splits: Split[]
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, sanitizeForFirestore({ splits, updatedAt: Date.now() }), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving splits (cached locally):', err);
  }
}

// ----------------------------------------------------
// 6. Coach Profile & Client Roster
// ----------------------------------------------------

export async function saveCoachProfileCloud(
  userId: string,
  coachProfile: CoachProfile
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, sanitizeForFirestore({ coachProfile, updatedAt: Date.now() }), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving coach profile:', err);
  }
}

export async function saveClientsCloud(
  userId: string,
  clients: ClientProfile[]
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, sanitizeForFirestore({ clients, updatedAt: Date.now() }), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving clients to cloud:', err);
  }
}

export async function savePrescribedArchetypesCloud(
  userId: string,
  archetypes: PrescribedMealArchetype[]
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, sanitizeForFirestore({ prescribedArchetypes: archetypes, updatedAt: Date.now() }), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving prescribed archetypes:', err);
  }
}

// ----------------------------------------------------
// 7. Profile & Coach Snapshot Subscriptions
// ----------------------------------------------------

export function subscribeToUserProfile(
  userId: string,
  onUpdate: (profile: any) => void
): Unsubscribe {
  try {
    const userRef = doc(db, 'users', userId);
    return onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          onUpdate(snap.data());
        }
      },
      (err) => {
        console.warn('[Firestore] User profile snapshot error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error subscribing to user profile:', err);
    return () => {};
  }
}

export function subscribeToCoachData(
  coachUserId: string,
  onUpdate: (data: { clients?: ClientProfile[]; coachProfile?: CoachProfile }) => void
): Unsubscribe {
  try {
    const coachRef = doc(db, 'users', coachUserId);
    return onSnapshot(
      coachRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onUpdate({
            clients: data?.clients,
            coachProfile: data?.coachProfile,
          });
        }
      },
      (err) => {
        console.warn('[Firestore] Coach data snapshot error:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Error subscribing to coach data:', err);
    return () => {};
  }
}

// ----------------------------------------------------
// 8. Coach & Client Relationship Management
// ----------------------------------------------------

/**
 * Unlinks an athlete from their coach in Cloud Firestore:
 * - Clears linkedCoach on athlete's document
 * - Sets athleteMembership status to 'graduated' or 'solo_active'
 * - Updates the coach's roster document so the client status is marked 'graduated'
 */
export async function unlinkCoachCloud(
  athleteUserId: string,
  coachId?: string,
  targetMembershipStatus: 'graduated' | 'solo_active' | 'solo_trial' | 'free' = 'solo_active'
): Promise<void> {
  try {
    const athleteRef = doc(db, 'users', athleteUserId);
    await setDoc(
      athleteRef,
      sanitizeForFirestore({
        linkedCoach: null,
        athleteMembership: { status: targetMembershipStatus },
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Error unlinking coach on athlete profile:', err);
  }

  if (coachId) {
    try {
      const coachRef = doc(db, 'users', coachId);
      const snap = await getDoc(coachRef);
      if (snap.exists()) {
        const coachData = snap.data();
        const currentClients: ClientProfile[] = Array.isArray(coachData?.clients) ? coachData.clients : [];
        let changed = false;
        const updatedClients = currentClients.map((c) => {
          if (c.linkedUserId === athleteUserId || c.id === athleteUserId) {
            changed = true;
            return {
              ...c,
              status: 'graduated' as const,
            };
          }
          return c;
        });
        if (changed) {
          await setDoc(
            coachRef,
            sanitizeForFirestore({ clients: updatedClients, updatedAt: Date.now() }),
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn('[Firestore] Error updating coach roster on unlink:', err);
    }
  }
}

/**
 * Reverts a linked client back to a shadow client in the coach's roster,
 * and clears the coach link on the athlete's document.
 */
export async function unlinkClientInCoachRosterCloud(
  coachUserId: string,
  clientId: string,
  linkedUserId?: string
): Promise<void> {
  try {
    const coachRef = doc(db, 'users', coachUserId);
    const snap = await getDoc(coachRef);
    if (snap.exists()) {
      const coachData = snap.data();
      const currentClients: ClientProfile[] = Array.isArray(coachData?.clients) ? coachData.clients : [];
      const updatedClients = currentClients.map((c) =>
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
      await setDoc(
        coachRef,
        sanitizeForFirestore({ clients: updatedClients, updatedAt: Date.now() }),
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('[Firestore] Error unlinking client in coach roster:', err);
  }

  if (linkedUserId) {
    try {
      const athleteRef = doc(db, 'users', linkedUserId);
      await setDoc(
        athleteRef,
        sanitizeForFirestore({
          linkedCoach: null,
          athleteMembership: { status: 'solo_active' },
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.warn('[Firestore] Error unlinking athlete on client document:', err);
    }
  }
}
