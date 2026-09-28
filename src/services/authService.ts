import {
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUserWithEmail,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  sendEmailVerification as fbSendEmailVerification,
  reload as fbReload,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfig } from '../config/firebase';
import {
  saveStoredAccount,
  getStoredAccounts,
  setActiveSession,
  clearActiveSession,
  getActiveSession,
  UserSession,
} from '../utils/storage';
import { UserRole, AccountType } from '../types/trainer';

export interface AuthState {
  user: FirebaseUser | null;
  isLoading: boolean;
  isAnonymous: boolean;
}

/**
 * Sign in as anonymous guest.
 * Enables zero-friction local and offline access without requiring an initial login screen.
 */
export async function signInAsGuest(
  role: UserRole = 'athlete',
  accountType: AccountType = 'athlete'
): Promise<FirebaseUser> {
  const guestUid = `guest_${Date.now()}`;
  const guestEmail = 'guest@ripped.app';
  const guestName = accountType === 'coach' || role === 'coach' ? 'Guest Coach' : 'Guest Lifter';

  try {
    if (auth && typeof auth === 'object' && auth.app && typeof fbSignInAnonymously === 'function') {
      const cred = await fbSignInAnonymously(auth);
      await setActiveSession({
        uid: cred.user.uid,
        email: cred.user.email || guestEmail,
        displayName: cred.user.displayName || guestName,
        userRole: role,
        accountType,
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
    accountType,
  });

  return mockGuestUser;
}

/**
 * Sign in with existing email and password
 */
export async function signInWithEmail(
  email: string,
  pass: string,
  selectedRole?: UserRole,
  accountType?: AccountType
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
          const resolvedAccountType = localMatch.accountType || accountType || (resolvedRole === 'coach' ? 'coach' : 'athlete');
          await setActiveSession({
            uid: localMatch.id,
            email: localMatch.email,
            displayName: localMatch.displayName,
            userRole: resolvedRole,
            accountType: resolvedAccountType,
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
  const finalAccountType = match?.accountType || accountType || (finalRole === 'coach' ? 'coach' : 'athlete');

  if (fbUser) {
    const cleanName = fbUser.displayName || cleanEmail.split('@')[0];
    await setActiveSession({
      uid: fbUser.uid,
      email: cleanEmail,
      displayName: cleanName,
      userRole: finalRole,
      accountType: finalAccountType,
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
    accountType: finalAccountType,
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
  role: UserRole = 'athlete',
  accountType: AccountType = 'athlete'
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
        await updateProfile(cred.user, { displayName: cleanName });
        // Automatically send email verification link upon registration
        try {
          await fbSendEmailVerification(cred.user);
        } catch (vErr) {
          console.warn('[Auth] Initial email verification send error:', vErr);
        }
      }
    } catch (err: any) {
      console.warn('[Auth] Firebase createUser failed:', err?.code, err?.message);
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in.');
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
    accountType,
    createdAt: Date.now(),
  });

  await setActiveSession({
    uid,
    email: cleanEmail,
    displayName: cleanName,
    userRole: role,
    accountType,
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

/**
 * Send password reset email via Google Firebase Identity Toolkit REST API.
 * This directly issues the reset email with zero web reCAPTCHA or DOM dependencies,
 * preventing 'undefined is not a function' errors on native mobile platforms.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your email address to reset your password.');
  }

  // Basic email structure validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const apiKey = firebaseConfig?.apiKey;

  // 1. Primary: Direct Google Firebase Identity Toolkit REST API
  if (apiKey) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: cleanEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error?.message || '';
        console.warn('[Auth] sendPasswordReset REST API error:', errorMsg);

        if (errorMsg.includes('EMAIL_NOT_FOUND')) {
          throw new Error('No registered account was found with this email.');
        }
        if (errorMsg.includes('INVALID_EMAIL')) {
          throw new Error('Please enter a valid email address.');
        }
        if (errorMsg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
          throw new Error('Too many reset attempts. Please wait a few minutes before trying again.');
        }
        throw new Error('Could not send password reset email. Please try again.');
      }

      // Successfully dispatched password reset email!
      return;
    } catch (restErr: any) {
      if (
        restErr?.message &&
        !restErr.message.includes('fetch') &&
        !restErr.message.includes('Network') &&
        !restErr.message.includes('undefined')
      ) {
        throw restErr;
      }
      console.warn('[Auth] REST API sendPasswordReset failed, attempting SDK fallback:', restErr);
    }
  }

  // 2. Secondary fallback: Firebase JS SDK
  const isFirebaseValid =
    auth &&
    typeof auth === 'object' &&
    auth.app &&
    typeof fbSendPasswordResetEmail === 'function';

  if (isFirebaseValid) {
    try {
      await fbSendPasswordResetEmail(auth, cleanEmail);
      return;
    } catch (err: any) {
      console.warn('[Auth] sendPasswordReset SDK error:', err?.code, err?.message);
      if (err?.code === 'auth/user-not-found') {
        throw new Error('No registered account was found with this email.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (err?.code === 'auth/too-many-requests') {
        throw new Error('Too many reset attempts. Please wait a few minutes.');
      }
      throw new Error(err?.message || 'Failed to send password reset email. Please try again.');
    }
  }

  throw new Error('Network error. Please check your internet connection and try again.');
}

/**
 * Send verification email to currently signed in user or specified user
 */
export async function sendVerificationEmail(targetUser?: FirebaseUser | null): Promise<void> {
  const user = targetUser || auth?.currentUser;
  if (!user) {
    throw new Error('No user is currently signed in.');
  }

  if (typeof fbSendEmailVerification === 'function') {
    try {
      await fbSendEmailVerification(user);
    } catch (err: any) {
      console.warn('[Auth] sendVerificationEmail error:', err?.code, err?.message);
      if (err?.code === 'auth/too-many-requests') {
        throw new Error('A verification email was sent recently. Please check your inbox or wait a moment.');
      }
      throw new Error(err?.message || 'Failed to send verification email.');
    }
  }
}

/**
 * Reload current user to refresh emailVerified state
 */
export async function reloadCurrentUser(): Promise<FirebaseUser | null> {
  if (auth?.currentUser && typeof fbReload === 'function') {
    try {
      await fbReload(auth.currentUser);
      return auth.currentUser;
    } catch (err) {
      console.warn('[Auth] reloadCurrentUser error:', err);
    }
  }
  return auth?.currentUser || null;
}


