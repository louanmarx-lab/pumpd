import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../config/firebase';

export async function callSecureBackend<T>(name: string, data: unknown = {}): Promise<T> {
  if (!auth.currentUser || auth.currentUser.isAnonymous) throw new Error('Sign in to your account to use this online feature.');
  try {
    const result = await httpsCallable<unknown,T>(getFunctions(app, 'us-central1'), name)(data);
    return result.data;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'functions/not-found' || code === 'functions/unavailable' || code === 'functions/internal') {
      throw new Error('This secure service is not available yet. Please try again later. Nothing has been confirmed.');
    }
    throw error;
  }
}
