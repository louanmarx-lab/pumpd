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
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { signInWithEmail, registerWithEmail, sendPasswordReset } from '../src/services/authService';
import { UserRole, AccountType } from '../src/types/trainer';
import { WeightUnit } from '../src/types';
import { getActiveSession } from '../src/utils/storage';
import { QRCodeScannerModal } from '../src/components/QRCodeScannerModal';

export default function Index() {
  const router = useRouter();
  const {
    firebaseUser,
    isAuthReady,
    userRole,
    setUserRole,
    setAccountType,
    updateWeightUnit,
    continueAsGuest,
    syncAllToCloud,
    claimClientWithCode,
    initializeBrandNewUser,
  } = useUserWorkspace();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupPlan, setSignupPlan] = useState<AccountType>('athlete');
  const [trainerCodeInput, setTrainerCodeInput] = useState('');
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('kg');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Forgot Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

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
        <Text className="text-zinc-400 text-xs font-semibold mt-3">Loading Ripped profile...</Text>
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
      const targetRole: UserRole = signupPlan === 'coach' ? 'coach' : 'athlete';
      const targetAccountType: AccountType = signupPlan;

      if (mode === 'signup') {
        const cleanName = displayName.trim() || email.split('@')[0];
        await registerWithEmail(
          email,
          password,
          cleanName,
          targetRole,
          targetAccountType
        );
        await initializeBrandNewUser(cleanName, targetRole, targetAccountType);
        updateWeightUnit(preferredUnit);

        // If client VIP with a trainer invite code, auto-claim
        if (signupPlan === 'client' && trainerCodeInput.trim()) {
          const claimRes = await claimClientWithCode(trainerCodeInput.trim());
          if (!claimRes.success) {
            Alert.alert(
              'Trainer Invite Code Notice',
              claimRes.error || 'Could not verify that PIN right now. You can enter it anytime in Settings.'
            );
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Account Created! 🚀',
          `Welcome to RIPPED, ${cleanName}! We've sent a verification link to ${email.trim()}. You can verify anytime in your Profile settings.`,
          [{ text: "Let's Train!" }]
        );
      } else {
        await signInWithEmail(email, password, targetRole, targetAccountType);
        const session = await getActiveSession();
        const finalRole = session?.userRole || targetRole;
        const finalAccountType = session?.accountType || targetAccountType;
        setUserRole(finalRole);
        setAccountType(finalAccountType);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await syncAllToCloud().catch(() => {});

      const session = await getActiveSession();
      const finalRole = session?.userRole || targetRole;
      if (finalRole === 'coach') {
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

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      setResetError('Please enter your account email address.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetMessage(`Password reset link sent to ${resetEmail.trim()}! Please check your inbox and spam folder.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg = err?.message || '';
      const displayMsg =
        msg.includes('undefined') || msg.includes('not a function')
          ? 'Could not connect to password reset service. Please check your network and try again.'
          : msg || 'Failed to send reset email. Please try again.';
      setResetError(displayMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
  };

  const handleGuest = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const targetRole: UserRole = signupPlan === 'coach' ? 'coach' : 'athlete';
      const targetAccountType: AccountType = signupPlan;
      setUserRole(targetRole);
      setAccountType(targetAccountType);
      await continueAsGuest(targetRole, targetAccountType);
      if (signupPlan === 'client' && trainerCodeInput.trim()) {
        await claimClientWithCode(trainerCodeInput.trim()).catch(() => {});
      }
      if (targetRole === 'coach') {
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
              RIPPED
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

            {/* Account Plan Selector */}
            <View className="mb-5">
              <Text className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Choose Subscription Plan:
              </Text>
              <View className="space-y-2">
                {/* 1. Solo Athlete */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSignupPlan('athlete');
                  }}
                  className={`p-3 rounded-2xl border ${
                    signupPlan === 'athlete'
                      ? 'bg-cyan-500/15 border-cyan-400'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center space-x-1.5">
                      <Ionicons
                        name="barbell"
                        size={15}
                        color={signupPlan === 'athlete' ? '#06B6D4' : '#71717A'}
                      />
                      <Text
                        className={`text-xs font-black ${
                          signupPlan === 'athlete' ? 'text-white' : 'text-zinc-400'
                        }`}
                      >
                        Solo Athlete
                      </Text>
                    </View>
                    <View className="bg-cyan-500/20 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-extrabold text-cyan-400">R59/mo</Text>
                    </View>
                  </View>
                  <Text className="text-[10px] text-zinc-400 leading-snug">
                    Independent lifter • Custom splits, 1RM progressive overload & macros
                  </Text>
                </TouchableOpacity>

                {/* 2. Client (Free VIP Pass) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSignupPlan('client');
                  }}
                  className={`p-3 rounded-2xl border ${
                    signupPlan === 'client'
                      ? 'bg-emerald-500/15 border-emerald-400'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center space-x-1.5">
                      <Ionicons
                        name="gift"
                        size={15}
                        color={signupPlan === 'client' ? '#10B981' : '#71717A'}
                      />
                      <Text
                        className={`text-xs font-black ${
                          signupPlan === 'client' ? 'text-white' : 'text-zinc-400'
                        }`}
                      >
                        Client (Free VIP Pass)
                      </Text>
                    </View>
                    <View className="bg-emerald-500/20 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-extrabold text-emerald-400">100% FREE</Text>
                    </View>
                  </View>
                  <Text className="text-[10px] text-zinc-400 leading-snug">
                    My trainer uses RIPPED • Free sponsored access under coach seat
                  </Text>
                </TouchableOpacity>

                {/* 3. Personal Trainer Pro */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSignupPlan('coach');
                  }}
                  className={`p-3 rounded-2xl border ${
                    signupPlan === 'coach'
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-zinc-900/90 border-zinc-800'
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center space-x-1.5">
                      <Ionicons
                        name="clipboard"
                        size={15}
                        color={signupPlan === 'coach' ? '#F59E0B' : '#71717A'}
                      />
                      <Text
                        className={`text-xs font-black ${
                          signupPlan === 'coach' ? 'text-white' : 'text-zinc-400'
                        }`}
                      >
                        Personal Trainer Pro
                      </Text>
                    </View>
                    <View className="bg-amber-500/20 px-2 py-0.5 rounded">
                      <Text className="text-[9px] font-extrabold text-amber-400">From R199/mo</Text>
                    </View>
                  </View>
                  <Text className="text-[10px] text-zinc-400 leading-snug">
                    Coach & PT suite • Client CRM, shadow logging, diet prescriptions
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trainer Code Input for Client VIP */}
            {mode === 'signup' && signupPlan === 'client' && (
              <View className="mb-4 bg-emerald-950/30 border border-emerald-500/40 p-3.5 rounded-2xl">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center space-x-1.5">
                    <Ionicons name="key" size={14} color="#10B981" />
                    <Text className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      Enter Trainer Invite PIN
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowScanner(true);
                    }}
                    className="flex-row items-center space-x-1 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/40"
                  >
                    <Ionicons name="camera-outline" size={12} color="#10B981" />
                    <Text className="text-[10px] font-bold text-emerald-300">Scan QR</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-[11px] text-zinc-400 mb-2.5">
                  Scan or enter the 6-character code your trainer gave you to instantly sync their routines and unlock free access:
                </Text>
                <View className="flex-row items-center bg-zinc-900 border border-emerald-400/60 rounded-xl px-3.5 py-2">
                  <Ionicons name="ticket-outline" size={16} color="#10B981" />
                  <TextInput
                    value={trainerCodeInput}
                    onChangeText={setTrainerCodeInput}
                    placeholder="e.g. RIP-8K2"
                    placeholderTextColor="#71717A"
                    autoCapitalize="characters"
                    className="flex-1 text-white text-sm ml-2.5 font-bold font-mono tracking-widest uppercase"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowScanner(true);
                    }}
                    className="p-1 bg-emerald-500/10 rounded-lg ml-2"
                  >
                    <Ionicons name="qr-code-outline" size={18} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

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

            {/* Preferred Weight Unit Selector (on signup) */}
            {mode === 'signup' && (
              <View className="mb-4">
                <Text className="text-xs text-zinc-300 font-bold mb-1.5">
                  Preferred Weight Unit
                </Text>
                <View className="flex-row bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPreferredUnit('kg');
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      preferredUnit === 'kg' ? 'bg-cyan-500' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        preferredUnit === 'kg' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Kilograms (kg)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPreferredUnit('lbs');
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      preferredUnit === 'lbs' ? 'bg-cyan-500' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        preferredUnit === 'lbs' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      Pounds (lbs)
                    </Text>
                  </TouchableOpacity>
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

            {/* Forgot Password Link (Sign In mode only) */}
            {mode === 'signin' && (
              <View className="flex-row justify-end mb-3 -mt-2">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setResetEmail(email.trim());
                    setResetError('');
                    setResetMessage('');
                    setShowResetModal(true);
                  }}
                  className="py-1"
                >
                  <Text className="text-xs font-bold text-accent-cyan">Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            )}

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
              className="bg-accent-cyan py-3.5 rounded-xl items-center justify-center shadow-lg shadow-cyan-500/25 mb-3"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#09090B" />
              ) : (
                <Text className="text-black font-black text-base">
                  {mode === 'signup' ? 'Create Account & Start' : 'Log In to RIPPED'}
                </Text>
              )}
            </TouchableOpacity>

            {mode === 'signin' && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setMode('signup');
                  setSignupPlan('client');
                }}
                className="items-center py-1.5 mb-1"
              >
                <Text className="text-xs font-bold text-emerald-400">
                  🎟️ Have a Trainer Code? Claim Free Account →
                </Text>
              </TouchableOpacity>
            )}

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

      <QRCodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={(code) => {
          setTrainerCodeInput(code);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        title="Scan Trainer's QR Code"
        subtitle="Align your trainer's invite QR code in frame"
      />

      {/* Password Reset Modal */}
      {showResetModal && (
        <Modal
          visible={showResetModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowResetModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-black/80 justify-center px-4"
          >
            <View className="bg-dark-card border border-zinc-800 rounded-3xl p-6 shadow-2xl">
              <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="key-outline" size={20} color="#06B6D4" />
                  <Text className="text-lg font-black text-white">Reset Password</Text>
                </View>
                <TouchableOpacity onPress={() => setShowResetModal(false)}>
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <Text className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Enter your account email below. We'll send you an official link to securely set a new password.
              </Text>

              <View className="mb-4">
                <Text className="text-xs text-zinc-300 font-bold mb-1.5">Account Email</Text>
                <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3">
                  <Ionicons name="mail-outline" size={16} color="#71717A" />
                  <TextInput
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="lifter@example.com"
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-sm ml-2.5 font-semibold"
                  />
                </View>
              </View>

              {!!resetError && (
                <View className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl mb-4 flex-row items-center space-x-2">
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text className="text-xs text-red-400 font-semibold flex-1">{resetError}</Text>
                </View>
              )}

              {!!resetMessage && (
                <View className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl mb-4 flex-row items-center space-x-2">
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text className="text-xs text-emerald-400 font-semibold flex-1">{resetMessage}</Text>
                </View>
              )}

              <View className="flex-row space-x-3 mt-2">
                <TouchableOpacity
                  onPress={() => setShowResetModal(false)}
                  className="flex-1 bg-zinc-800 py-3.5 rounded-xl items-center border border-zinc-700"
                >
                  <Text className="text-zinc-300 font-bold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePasswordReset}
                  disabled={resetLoading}
                  className="flex-1 bg-accent-cyan py-3.5 rounded-xl items-center justify-center shadow-lg shadow-cyan-500/25"
                >
                  {resetLoading ? (
                    <ActivityIndicator size="small" color="#09090B" />
                  ) : (
                    <Text className="text-black font-black text-sm">Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </SafeAreaView>
  );
}
