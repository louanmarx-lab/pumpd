import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, getFirestore, Firestore } from 'firebase/firestore';

// Default Firebase configuration using environment variables or fallback values
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyPumpdDemoApiKeyForLocalDevelopment123",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "pumpd-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "pumpd-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "pumpd-app.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "100000000000",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:100000000000:web:pumpdappdemo123456",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: Firestore;
try {
  // Initialize Firestore with offline persistence enabled
  db = initializeFirestore(app, {
    localCache: persistentLocalCache(),
  });
} catch (e) {
  // Return existing firestore instance if already initialized
  db = getFirestore(app);
}

export { app, db };
