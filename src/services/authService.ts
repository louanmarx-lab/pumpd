import {
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUserWithEmail,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  saveStoredAccount,
  getStoredAccounts,
  setActiveSession,
  clearActiveSession,
  getActiveSession,
  UserSession,
} from '../utils/storage';
import { UserRole } from '../types/trainer';

export interface AuthState {
  user: FirebaseUser | null;
  isLoading: boolean;
  isAnonymous: boolean;
}

/**
 * Sign in as anonymous guest.
 * Enables zero-friction local and offline access without requiring an initial login screen.
 */
export async function signInAsGuest(role: UserRole = 'athlete'): Promise<FirebaseUser> {
  const guestUid = `guest_${Date.now()}`;
  const guestEmail = 'guest@pumpd.app';
  const guestName = role === 'coach' ? 'Guest Coach' : 'Guest Lifter';

  try {
    if (auth && typeof auth === 'object' && auth.app && typeof fbSignInAnonymously === 'function') {
      const cred = await fbSignInAnonymously(auth);
      await setActiveSession({
        uid: cred.user.uid,
        email: cred.user.email || guestEmail,
        displayName: cred.user.displayName || guestName,
        userRole: role,
      });
      return cred.user;
    }
  } catch (err) {
    console.warn('[Auth] Firebase guest sign-in fallback:', err);
  }

  const mockGuestUser = {
    uid: guestUid,
    email: guestEmail,
    displayName: guestName,
    isAnonymous: true,
  } as unknown as FirebaseUser;

  await setActiveSession({
    uid: guestUid,
    email: guestEmail,
    displayName: guestName,
    userRole: role,
  });

  return mockGuestUser;
}

/**
 * Sign in with existing email and password
 */
export async function signInWithEmail(
  email: string,
  pass: string,
  selectedRole?: UserRole
): Promise<FirebaseUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both email and password.');
  }

  let fbUser: FirebaseUser | null = null;
  const isFirebaseValid =
    auth &&
    typeof auth === 'object' &&
    auth.app &&
    typeof fbSignInWithEmail === 'function';

  if (isFirebaseValid) {
    try {
      const cred = await fbSignInWithEmail(auth, cleanEmail, cleanPass);
      if (cred && cred.user) {
        fbUser = cred.user;
      }
    } catch (err: any) {
      console.warn('[Auth] Firebase signIn failed:', err?.code, err?.message);
      if (
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential'
      ) {
        // Also check if local account matches
        const localAccounts = await getStoredAccounts();
        const localMatch = localAccounts.find(
          (a) => a.email.toLowerCase() === cleanEmail
        );
        if (localMatch && localMatch.password === cleanPass) {
          const resolvedRole = localMatch.userRole || selectedRole || 'athlete';
          await setActiveSession({
            uid: localMatch.id,
            email: localMatch.email,
            displayName: localMatch.displayName,
            userRole: resolvedRole,
          });
          return {
            uid: localMatch.id,
            email: localMatch.email,
            displayName: localMatch.displayName,
            isAnonymous: false,
          } as unknown as FirebaseUser;
        }
        throw new Error('Invalid email or password. Please try again.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
    }
  }

  // Check local account for role preference
  const localAccounts = await getStoredAccounts();
  const match = localAccounts.find(
    (a) => a.email.toLowerCase() === cleanEmail
  );

  const finalRole = match?.userRole || selectedRole || 'athlete';

  if (fbUser) {
    const cleanName = fbUser.displayName || cleanEmail.split('@')[0];
    await setActiveSession({
      uid: fbUser.uid,
      email: cleanEmail,
      displayName: cleanName,
      userRole: finalRole,
    });
    return fbUser;
  }

  if (!match) {
    throw new Error('Account not found. Please check your email or create an account.');
  }

  if (match.password && match.password !== cleanPass) {
    throw new Error('Invalid email or password. Please try again.');
  }

  await setActiveSession({
    uid: match.id,
    email: match.email,
    displayName: match.displayName,
    userRole: finalRole,
  });

  return {
    uid: match.id,
    email: match.email,
    displayName: match.displayName,
    isAnonymous: false,
  } as unknown as FirebaseUser;
}

/**
 * Create new account with email and password
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  displayName?: string,
  role: UserRole = 'athlete'
): Promise<FirebaseUser> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = pass.trim();
  const cleanName = (displayName || cleanEmail.split('@')[0]).trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both email and password.');
  }
  if (cleanPass.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  let fbUser: FirebaseUser | null = null;
  const isFirebaseValid =
    auth &&
    typeof auth === 'object' &&
    auth.app &&
    typeof fbCreateUserWithEmail === 'function';

  if (isFirebaseValid) {
    try {
      const cred = await fbCreateUserWithEmail(auth, cleanEmail, cleanPass);
      if (cred && cred.user) {
        fbUser = cred.user;
        if (cleanName) {
          await updateProfile(fbUser, { displayName: cleanName }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[Auth] Firebase createUser error:', err?.code, err?.message);
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      }
    }
  }

  const localAccounts = await getStoredAccounts();
  const alreadyExists = localAccounts.some(
    (a) => a.email.toLowerCase() === cleanEmail
  );
  if (alreadyExists && !fbUser) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const uid = fbUser?.uid || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  await saveStoredAccount({
    id: uid,
    email: cleanEmail,
    displayName: cleanName,
    password: cleanPass,
    userRole: role,
    createdAt: Date.now(),
  });

  await setActiveSession({
    uid,
    email: cleanEmail,
    displayName: cleanName,
    userRole: role,
  });

  if (fbUser) {
    return fbUser;
  }

  return {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    isAnonymous: false,
  } as unknown as FirebaseUser;
}

/**
 * Sign out from Firebase and clear active session
 */
export async function signOutUser(): Promise<void> {
  try {
    if (auth && typeof auth === 'object' && auth.app && typeof fbSignOut === 'function') {
      await fbSignOut(auth).catch(() => {});
    }
  } catch (err) {
    console.warn('[Auth] Error signing out of Firebase:', err);
  }
  await clearActiveSession();
}

/**
 * Subscribe to Auth State changes
 */
export function subscribeToAuth(
  callback: (user: FirebaseUser | null) => void
): () => void {
  try {
    if (!auth || typeof auth !== 'object' || !auth.app || typeof fbOnAuthStateChanged !== 'function') {
      getActiveSession().then((session) => {
        if (session) {
          callback({
            uid: session.uid,
            email: session.email,
            displayName: session.displayName,
            isAnonymous: false,
          } as unknown as FirebaseUser);
        } else {
          callback(null);
        }
      });
      return () => {};
    }

    return fbOnAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          await setActiveSession({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Lifter',
          });
          callback(user);
        } else {
          const session = await getActiveSession();
          if (session) {
            callback({
              uid: session.uid,
              email: session.email,
              displayName: session.displayName,
              isAnonymous: false,
            } as unknown as FirebaseUser);
          } else {
            callback(null);
          }
        }
      },
      (err) => {
        console.warn('[Auth] onAuthStateChanged error:', err);
        getActiveSession().then((session) => {
          if (session) {
            callback({
              uid: session.uid,
              email: session.email,
              displayName: session.displayName,
              isAnonymous: false,
            } as unknown as FirebaseUser);
          } else {
            callback(null);
          }
        });
      }
    );
  } catch (err) {
    console.warn('[Auth] Error subscribing to auth state:', err);
    getActiveSession().then((session) => {
      if (session) {
        callback({
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
          isAnonymous: false,
        } as unknown as FirebaseUser);
      } else {
        callback(null);
      }
    });
    return () => {};
  }
}

