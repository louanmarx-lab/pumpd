import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { signInWithEmail, registerWithEmail } from '../src/services/authService';
import { UserRole } from '../src/types/trainer';
import { getActiveSession } from '../src/utils/storage';

export default function Index() {
  const router = useRouter();
  const {
    firebaseUser,
    isAuthReady,
    userRole,
    setUserRole,
    continueAsGuest,
    syncAllToCloud,
  } = useUserWorkspace();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<UserRole>('athlete');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated (or guest session active), redirect to respective deck
  if (isAuthReady && firebaseUser) {
    if (userRole === 'coach') {
      return <Redirect href="/(tabs)/clients" />;
    }
    return <Redirect href="/(tabs)/workouts" />;
  }

  // While checking initial Firebase auth state
  if (!isAuthReady) {
    return (
      <View className="flex-1 bg-dark-bg items-center justify-center">
        <ActivityIndicator size="large" color="#06B6D4" />
        <Text className="text-zinc-400 text-xs font-semibold mt-3">Loading Pumpd profile...</Text>
      </View>
    );
  }

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
          displayName.trim() || email.split('@')[0],
          selectedRole
        );
        setUserRole(selectedRole);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await signInWithEmail(email, password, selectedRole);
        const session = await getActiveSession();
        const finalRole = session?.userRole || selectedRole;
        setUserRole(finalRole);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await syncAllToCloud().catch(() => {});

      const session = await getActiveSession();
      const targetRole = session?.userRole || selectedRole;
      if (targetRole === 'coach') {
        router.replace('/(tabs)/clients');
      } else {
        router.replace('/(tabs)/workouts');
      }
    } catch (err: any) {
      console.warn('[AuthScreen] Authentication failed:', err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Please log in.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Network error. Check your connection or continue as guest.');
      } else {
        setErrorMessage(err.message || 'Authentication error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      setUserRole(selectedRole);
      await continueAsGuest(selectedRole);
      if (selectedRole === 'coach') {
        router.replace('/(tabs)/clients');
      } else {
        router.replace('/(tabs)/workouts');
      }
    } catch (err) {
      console.warn('Guest login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Hero Branding */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500 items-center justify-center mb-3 shadow-lg shadow-cyan-500/30">
              <Ionicons name="barbell" size={32} color="#06B6D4" />
            </View>
            <Text className="text-3xl font-black text-white tracking-wider">
              PUMPD
            </Text>
            <Text className="text-xs font-bold text-accent-cyan uppercase tracking-widest mt-0.5">
              Evidence-Based Performance & Hypertrophy
            </Text>
            <Text className="text-xs text-zinc-400 text-center mt-2 px-4">
              Sign in to access your personal workout logs, custom splits, and calorie tracking.
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-dark-card border border-dark-border p-6 rounded-3xl shadow-xl">
            {/* Mode Switcher */}
            <View className="flex-row bg-zinc-900 p-1 rounded-xl mb-5 border border-zinc-800">
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setMode('signin');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2.5 items-center rounded-lg ${
                  mode === 'signin' ? 'bg-accent-cyan' : ''
                }`}
              >
                <Text
                  className={`text-xs font-extrabold ${
                    mode === 'signin' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  Log In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setMode('signup');
                  setErrorMessage('');
                }}
                className={`flex-1 py-2.5 items-center rounded-lg ${
                  mode === 'signup' ? 'bg-accent-cyan' : ''
                }`}
              >
                <Text
                  className={`text-xs font-extrabold ${
                    mode === 'signup' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Account Role Selector */}
            <View className="mb-5">
              <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                I am using Pumpd as a:
              </Text>
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedRole('athlete');
                  }}
                  className={`flex-1 p-3 rounded-2xl border ${
                    selectedRole === 'athlete'
                      ? 'bg-cyan-500/15 border-cyan-400'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center space-x-1.5 mb-1">
                    <Ionicons
                      name="barbell"
                      size={15}
                      color={selectedRole === 'athlete' ? '#06B6D4' : '#71717A'}
                    />
                    <Text
                      className={`text-xs font-black ${
                        selectedRole === 'athlete' ? 'text-white' : 'text-zinc-400'
                      }`}
                    >
                      Client / Lifter
                    </Text>
                  </View>
                  <Text className="text-[10px] text-zinc-400 leading-snug">
                    Workouts, diet & gym jams
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedRole('coach');
                  }}
                  className={`flex-1 p-3 rounded-2xl border ${
                    selectedRole === 'coach'
                      ? 'bg-cyan-500/15 border-cyan-400'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center space-x-1.5 mb-1">
                    <Ionicons
                      name="clipboard"
                      size={15}
                      color={selectedRole === 'coach' ? '#06B6D4' : '#71717A'}
                    />
                    <Text
                      className={`text-xs font-black ${
                        selectedRole === 'coach' ? 'text-white' : 'text-zinc-400'
                      }`}
                    >
                      Personal Trainer
                    </Text>
                  </View>
                  <Text className="text-[10px] text-zinc-400 leading-snug">
                    Client CRM, splits & diet plans
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Display Name (on signup) */}
            {mode === 'signup' && (
              <View className="mb-4">
                <Text className="text-xs text-zinc-300 font-bold mb-1.5">
                  Your Name / Lifter Alias
                </Text>
                <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3">
                  <Ionicons name="person-outline" size={16} color="#71717A" />
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="e.g. Alex Johnson"
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-sm ml-2.5 font-semibold"
                  />
                </View>
              </View>
            )}

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-xs text-zinc-300 font-bold mb-1.5">Email Address</Text>
              <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3">
                <Ionicons name="mail-outline" size={16} color="#71717A" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="lifter@example.com"
                  placeholderTextColor="#71717A"
                  className="flex-1 text-white text-sm ml-2.5 font-semibold"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="mb-4">
              <Text className="text-xs text-zinc-300 font-bold mb-1.5">Password</Text>
              <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3">
                <Ionicons name="lock-closed-outline" size={16} color="#71717A" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#71717A"
                  className="flex-1 text-white text-sm ml-2.5 font-semibold"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#71717A"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {!!errorMessage && (
              <View className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl mb-4 flex-row items-center space-x-2">
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-xs text-red-400 font-semibold flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={loading}
              className="bg-accent-cyan py-3.5 rounded-xl items-center justify-center shadow-lg shadow-cyan-500/25 mb-4"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <Text className="text-black font-black text-base">
                  {mode === 'signup' ? 'Create Account & Start' : 'Log In to Pumpd'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-3">
              <View className="flex-1 h-[1px] bg-zinc-800" />
              <Text className="text-[11px] text-zinc-500 font-bold px-3">OR</Text>
              <View className="flex-1 h-[1px] bg-zinc-800" />
            </View>

            {/* Continue as Guest Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleGuest}
              disabled={loading}
              className="bg-zinc-900 border border-zinc-800 py-3 rounded-xl items-center flex-row justify-center space-x-2"
            >
              <Ionicons name="flash-outline" size={16} color="#A1A1AA" />
              <Text className="text-xs font-bold text-zinc-300">
                Continue as Guest (Offline Mode)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <Text className="text-[11px] text-zinc-500 text-center mt-6">
            Cloud Sync powered by Firebase. Each account maintains its own private data, workouts, and nutrition logs.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
