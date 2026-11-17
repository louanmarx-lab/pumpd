import { callSecureBackend } from './secureBackend';
import { clearCloudQueue } from '../utils/cloudSyncQueue';
import { eraseOwnerLocalData, freezeLocalOwner, unfreezeLocalOwner } from '../utils/storage';
import {
  signInWithEmailAndPassword as fbSignInWithEmail,
  createUserWithEmailAndPassword as fbCreateUserWithEmail,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  sendEmailVerification as fbSendEmailVerification,
  reload as fbReload,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth, firebaseConfig } from '../config/firebase';
import {
  saveStoredAccount,
  getStoredAccounts,
  setActiveSession,
  clearActiveSession,
  getActiveSession,
  getGuestOwner,
} from '../utils/storage';
import { UserRole, AccountType } from '../types/trainer';
import { WeightUnit } from '../types';

export interface AuthState {
  user: FirebaseUser | null;
  isLoading: boolean;
  isAnonymous: boolean;
}

// Wait for auth metadata to be persisted before exposing a new identity to the workspace.
let transition: Promise<unknown> = Promise.resolve();
const sessionListeners = new Set<() => void>();

function changeSession<T>(action: () => Promise<T>): Promise<T> {
  const result = transition.then(action);
  transition = result.then(() => undefined, () => undefined);
  void result.then(() => sessionListeners.forEach((listener) => listener()), () => {});
  return result;
}

function guestUser(uid: string, displayName: string): FirebaseUser {
  return { uid, displayName, email: null, isAnonymous: true } as FirebaseUser;
}

export function signInAsGuest(
  role: UserRole = 'athlete',
  accountType: AccountType = 'athlete'
): Promise<FirebaseUser> {
  return changeSession(async () => {
    if (auth.currentUser) await fbSignOut(auth);
    const session = await getActiveSession();
    const uid = (session?.isLocalGuest && session.userRole === role ? session.uid : await getGuestOwner(role))
      || `guest_local_${accountType}`;
    const displayName = role === 'coach' ? 'Guest Coach' : 'Guest Lifter';
    await setActiveSession({ uid, email: '', displayName, userRole: role, accountType, isLocalGuest: true });
    return guestUser(uid, displayName);
  });
}

export function signInWithEmail(
  email: string,
  password: string,
  selectedRole?: UserRole,
  accountType?: AccountType
): Promise<FirebaseUser> {
  return changeSession(async () => {
    const cleanEmail = email.trim().toLowerCase();
    const { user } = await fbSignInWithEmail(auth, cleanEmail, password.trim());
    const stored = (await getStoredAccounts()).find((account) => account.id === user.uid);
    const role = stored?.userRole || selectedRole;
    await setActiveSession({
      uid: user.uid,
      email: cleanEmail,
      displayName: user.displayName || cleanEmail.split('@')[0],
      userRole: role,
      accountType: stored?.accountType || accountType,
    });
    return user;
  });
}

export function registerWithEmail(
  email: string,
  password: string,
  displayName?: string,
  role: UserRole = 'athlete',
  accountType: AccountType = 'athlete',
  weightUnit?: WeightUnit,
  trainerCode?: string
): Promise<FirebaseUser> {
  return changeSession(async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName?.trim() || cleanEmail.split('@')[0];
    const { user } = await fbCreateUserWithEmail(auth, cleanEmail, password.trim());
    await setActiveSession({
      uid: user.uid, email: cleanEmail, displayName: cleanName, userRole: role, accountType, weightUnit, trainerCode,
    });
    await saveStoredAccount({
      id: user.uid, email: cleanEmail, displayName: cleanName, userRole: role, accountType, createdAt: Date.now(),
    });
    // Profile and verification email can be retried after the account itself has been created.
    void updateProfile(user, { displayName: cleanName })
      .catch(() => {})
      .then(() => fbSendEmailVerification(user))
      .catch(() => {});
    return user;
  });
}

export function signOutUser(): Promise<void> {
  return changeSession(async () => {
    if (auth.currentUser) await fbSignOut(auth);
    await clearActiveSession();
  });
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void): () => void {
  let revision = 0;
  let disposed = false;
  const emit = async () => {
    const currentRevision = ++revision;
    await transition;
    const session = await getActiveSession();
    if (disposed || currentRevision !== revision) return;
    const user = auth?.currentUser;
    if (user) callback(user);
    else if (session?.isLocalGuest || session?.uid.startsWith('guest_')) {
      callback(guestUser(session.uid, session.displayName));
    } else callback(null);
  };
  sessionListeners.add(emit);
  let unsubscribe: (() => void) | undefined;
  try {
    unsubscribe = fbOnAuthStateChanged(auth, emit, emit);
  } catch {
    void emit();
  }
  return () => {
    disposed = true;
    sessionListeners.delete(emit);
    unsubscribe?.();
  };
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



export function deleteCurrentAccount(password:string):Promise<void>{
  return changeSession(async()=>{
    const user=auth.currentUser;
    if(!user?.email || user.isAnonymous)throw new Error('Sign in to the account you want to delete.');
    const owner=user.uid;
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
    if(auth.currentUser?.uid!==owner)throw new Error('Your account changed.');
    freezeLocalOwner(owner);
    try{
      const result=await callSecureBackend<{success:boolean}>('deleteMyAccount');
      if(!result.success)throw new Error('Deletion has not completed. Please retry.');
    }catch(error){unfreezeLocalOwner(owner);throw error;}
    try{await clearCloudQueue(owner);await eraseOwnerLocalData(owner);}
    finally{await fbSignOut(auth);await clearActiveSession();}
  });
}
