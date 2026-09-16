import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import {
  signInWithEmail,
  registerWithEmail,
  signOutUser,
  signInAsGuest,
} from '../../services/authService';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const {
    firebaseUser,
    activeUser,
    cloudSyncStatus,
    syncAllToCloud,
    signOut,
  } = useUserWorkspace();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isGuest = !firebaseUser || firebaseUser.isAnonymous;

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (mode === 'signup') {
        await registerWithEmail(
          email,
          password,
          displayName.trim() || activeUser.displayName
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Account Created! 🚀',
          'Your account is set up and your workouts are synced to the cloud.'
        );
      } else {
        await signInWithEmail(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Welcome Back! 🎯',
          'Signed in successfully. Syncing your data from the cloud.'
        );
      }
      await syncAllToCloud();
      onClose();
    } catch (err: any) {
      console.warn('Auth action failed:', err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Try signing in.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Network error. Offline cache is still active on your device.');
      } else {
        setErrorMessage(err.message || 'Authentication error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will return to the welcome login screen where you or a friend can log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              onClose();
              await signOut();
              router.replace('/');
            } catch (err) {
              console.warn('Error signing out:', err);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/80 justify-end"
      >
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-6 max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-xl bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
                <Ionicons name="cloud-outline" size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-lg font-bold text-white">
                  Cloud Sync & Account
                </Text>
                <Text className="text-xs text-zinc-400">
                  Google Cloud Firestore • Offline-First
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 bg-zinc-850 rounded-full items-center justify-center border border-zinc-750"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="py-4">
            {/* Status Pill */}
            <View className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl mb-5">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-zinc-300">
                  Current Session:
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-full border ${
                    cloudSyncStatus === 'synced'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-amber-500/20 border-amber-500/40'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-extrabold uppercase ${
                      cloudSyncStatus === 'synced'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {cloudSyncStatus === 'synced'
                      ? '● Cloud Active'
                      : '● Offline Local Cache'}
                  </Text>
                </View>
              </View>

              <Text className="text-sm font-bold text-white">
                {isGuest
                  ? '👤 Guest / Local Device Session'
                  : `✉️ ${firebaseUser?.email}`}
              </Text>
              <Text className="text-[11px] text-zinc-400 mt-1">
                {isGuest
                  ? 'Your workouts and nutrition are cached on this phone. Sign in with an email to back up and sync across devices.'
                  : 'Your data automatically synchronizes with Cloud Firestore whenever connected.'}
              </Text>
            </View>

            {/* If Already Authenticated with Email */}
            {!isGuest && (
              <View className="space-y-3 mb-6">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    syncAllToCloud();
                    Alert.alert('Sync Complete', 'All local logs pushed to Cloud Firestore.');
                  }}
                  className="bg-accent-cyan p-3.5 rounded-xl flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="sync" size={16} color="#09090B" />
                  <Text className="text-black font-extrabold text-sm">
                    Sync Local Data to Cloud
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSignOut}
                  className="bg-zinc-900 border border-red-500/40 p-3.5 rounded-xl flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                  <Text className="text-red-400 font-bold text-sm">
                    Sign Out
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Sign In / Sign Up Form for Guests */}
            {isGuest && (
              <View>
                {/* Mode Selector */}
                <View className="flex-row bg-zinc-900 p-1 rounded-xl mb-4 border border-zinc-800">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMode('signin');
                      setErrorMessage('');
                    }}
                    className={`flex-1 py-2 items-center rounded-lg ${
                      mode === 'signin' ? 'bg-accent-cyan' : ''
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        mode === 'signin' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMode('signup');
                      setErrorMessage('');
                    }}
                    className={`flex-1 py-2 items-center rounded-lg ${
                      mode === 'signup' ? 'bg-accent-cyan' : ''
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        mode === 'signup' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Name field for Sign Up */}
                {mode === 'signup' && (
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-400 font-medium mb-1">
                      Display Name
                    </Text>
                    <TextInput
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder={activeUser.displayName || 'Your Name'}
                      placeholderTextColor="#71717A"
                      className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl text-sm"
                    />
                  </View>
                )}

                {/* Email Field */}
                <View className="mb-3">
                  <Text className="text-xs text-zinc-400 font-medium mb-1">
                    Email Address
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="lifter@example.com"
                    placeholderTextColor="#71717A"
                    className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl text-sm"
                  />
                </View>

                {/* Password Field */}
                <View className="mb-4">
                  <Text className="text-xs text-zinc-400 font-medium mb-1">
                    Password
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#71717A"
                    className="bg-zinc-900 border border-zinc-800 text-white px-3.5 py-2.5 rounded-xl text-sm"
                  />
                </View>

                {/* Error Banner */}
                {!!errorMessage && (
                  <View className="bg-red-500/20 border border-red-500/40 p-2.5 rounded-xl mb-3">
                    <Text className="text-xs text-red-400 text-center font-medium">
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSubmit}
                  disabled={loading}
                  className="bg-accent-cyan py-3 rounded-xl items-center justify-center mb-3"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#09090B" />
                  ) : (
                    <Text className="text-black font-extrabold text-sm">
                      {mode === 'signup'
                        ? 'Create Cloud Account'
                        : 'Sign In to Cloud'}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  🔒 Offline-Protected: Your local workout history is preserved and merged automatically upon account connection.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
export default AuthModal;
