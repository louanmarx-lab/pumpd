import 'react-native-get-random-values';
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyAksUKu-5ntNqhOfn_Slsv61TDNJj649q0',
  authDomain: 'ripped-a5726.firebaseapp.com',
  projectId: 'ripped-a5726',
  storageBucket: 'ripped-a5726.firebasestorage.app',
  messagingSenderId: '699479728909',
  appId: '1:699479728909:android:cbc33ec0b79605532d0644',
};

// Initialize or reuse existing Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with React Native AsyncStorage persistence
let authInstance: ReturnType<typeof getAuth>;
try {
  const persistence =
    typeof getReactNativePersistence === 'function'
      ? getReactNativePersistence(AsyncStorage)
      : undefined;

  authInstance = Platform.OS === 'web' ? getAuth(app) : initializeAuth(app, persistence ? { persistence } : {});
} catch (error) {
  if ((error as { code?: string })?.code !== 'auth/already-initialized') throw error;
  authInstance = getAuth(app);
}
export const auth = authInstance;

// Initialize Cloud Firestore safely
let dbInstance: ReturnType<typeof getFirestore>;
try {
  dbInstance = initializeFirestore(app, {});
} catch (e) {
  try {
    dbInstance = getFirestore(app);
  } catch (err) {
    console.warn('[Firebase] Firestore fallback:', err);
    dbInstance = {} as any;
  }
}
export const db = dbInstance;

// Initialize Cloud Storage safely
let storageInstance: any = null;
try {
  storageInstance = getStorage(app);
} catch (err) {
  console.warn('[Firebase] Storage fallback:', err);
}
export const storage = storageInstance;

export default { app, auth, db, storage };
