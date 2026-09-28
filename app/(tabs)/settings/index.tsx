import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { AuthModal } from '../../../src/components/auth/AuthModal';
import { DataBackupRestoreModal } from '../../../src/components/settings/DataBackupRestoreModal';
import { TrainerSubscriptionTier, TIER_CONFIGS } from '../../../src/types/trainer';
import { SeatUpgradeModal } from '../../../src/components/coach/SeatUpgradeModal';
import { DowngradeReconcileModal } from '../../../src/components/coach/DowngradeReconcileModal';
import { GraduationModal } from '../../../src/components/coach/GraduationModal';
import { QRCodeScannerModal } from '../../../src/components/QRCodeScannerModal';
import { sendVerificationEmail, reloadCurrentUser } from '../../../src/services/authService';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    currentUser,
    activeUser,
    userRole,
    coachProfile,
    linkedCoach,
    linkCoach,
    unlinkCoach,
    athleteMembership,
    setAthleteMembership,
    completeGraduation,
    clients,
    trainerSubscription,
    activeSeatsUsed,
    managedClient,
    stopManagingClient,
    isCoachAccount,
    isViewingPersonalProfile,
    enterPersonalAthleteMode,
    exitPersonalAthleteMode,
    claimClientWithCode,
    upgradeTrainerSubscription,
    reconcileDowngradeSeats,
    setUserRole,
    setAccountType,
    updateCoachProfile,
    exercises,
    workoutLogs,
    nutritionLogs,
    bodyMetrics,
    updateMacroTargets,
    updateUserName,
    updateWeightUnit,
    clearAllData,
    resetAllDataToDefaults,
    firebaseUser,
    cloudSyncStatus,
    syncAllToCloud,
    signOut,
  } = useUserWorkspace();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBackupRestoreModal, setShowBackupRestoreModal] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);

  // Claim Invite PIN modal
  const [showClaimInviteModal, setShowClaimInviteModal] = useState(false);
  const [claimInviteCode, setClaimInviteCode] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Coach Subscription Management Modals
  const [showSeatUpgradeModal, setShowSeatUpgradeModal] = useState(false);
  const [isUpgradingFromAthlete, setIsUpgradingFromAthlete] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [downgradeTargetTier, setDowngradeTargetTier] = useState<TrainerSubscriptionTier | null>(null);

  // Role & Coach Profile Edit State
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachName, setCoachName] = useState(coachProfile.name);
  const [businessName, setBusinessName] = useState(coachProfile.businessName);
  const [instagramHandle, setInstagramHandle] = useState(coachProfile.instagramHandle);

  // Macro Targets Edit State
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [calories, setCalories] = useState(activeUser.macroTargets.calories.toString());
  const [protein, setProtein] = useState(activeUser.macroTargets.protein.toString());
  const [carbs, setCarbs] = useState(activeUser.macroTargets.carbs.toString());
  const [fats, setFats] = useState(activeUser.macroTargets.fats.toString());

  // Edit Name Modal State
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Email Verification State
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  const handleResendVerification = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSendingVerification(true);
    try {
      await sendVerificationEmail();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Verification Sent! ✉️',
        `A verification link has been sent to ${firebaseUser?.email}. Please check your inbox and spam folder.`
      );
      await reloadCurrentUser();
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not send verification email at this time.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleUnlinkCoach = () => {
    Alert.alert(
      'Graduate & Train Solo 🎓',
      `Ready to graduate and train on your own? 100% of your workouts, PRs, and custom routines with ${linkedCoach?.name || 'your coach'} are permanently saved to your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Graduate & Go Solo',
          style: 'default',
          onPress: () => {
            setAthleteMembership({
              status: 'graduated',
              coachName: linkedCoach?.name || 'Coach',
              coachBusiness: linkedCoach?.businessName,
              graduatedAt: Date.now(),
            });
            setShowGraduationModal(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleClaimInvite = async (customCode?: string | unknown) => {
    const codeToUse = (typeof customCode === 'string' ? customCode : claimInviteCode).trim();
    if (!codeToUse) {
      Alert.alert('Required', 'Please enter your invite PIN (e.g. RIP-8K2 or 8K2).');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsClaiming(true);
    try {
      const res = await claimClientWithCode(codeToUse);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Account Linked! 🎉',
          `You are now connected to coach ${res.coachName || 'your trainer'}. All past workout history, routines, and nutrition targets have been transferred to your device. Your account is fully sponsored and free under your coach's seat plan.`
        );
        setShowClaimInviteModal(false);
        setClaimInviteCode('');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Invite Code Error',
          res.error || 'Invalid or expired invite code. Please check with your trainer.'
        );
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Claim Error', err?.message || 'Failed to claim code. Please check your internet connection.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleScannedInvite = (scanned: string) => {
    setShowScanner(false);
    setClaimInviteCode(scanned);
    handleClaimInvite(scanned);
  };

  const openEditName = (userId: string, currentName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingUserId(userId);
    setEditingName(currentName);
    setShowEditNameModal(true);
  };

  const handleSaveName = () => {
    if (!editingName.trim()) {
      Alert.alert('Required', 'Please enter a valid display name.');
      return;
    }
    if (editingUserId) {
      updateUserName(editingUserId, editingName.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditNameModal(false);
      setEditingUserId(null);
      setEditingName('');
    }
  };

  const handleSaveMacros = () => {
    const c = parseInt(calories, 10) || 2000;
    const p = parseInt(protein, 10) || 150;
    const cb = parseInt(carbs, 10) || 200;
    const f = parseInt(fats, 10) || 60;

    updateMacroTargets({ calories: c, protein: p, carbs: cb, fats: f });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowMacroModal(false);
  };

  const handleSaveCoachProfile = () => {
    updateCoachProfile({
      name: coachName.trim() || activeUser.displayName,
      businessName: businessName.trim() || 'Apex Performance Coaching',
      instagramHandle: instagramHandle.trim().startsWith('@')
        ? instagramHandle.trim()
        : `@${instagramHandle.trim()}`,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCoachModal(false);
  };

  return (
    <View className="flex-1 bg-dark-bg">
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
      {/* 1. MANAGED CLIENT PROFILE VIEW */}
      {managedClient ? (
        <View className="bg-dark-card border border-emerald-500/40 p-5 rounded-3xl mb-5 shadow-lg relative overflow-hidden">
          <View className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <View className="flex-row items-center justify-between mb-3 pb-2.5 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2 flex-1 min-w-0 mr-2">
              <Ionicons name="person" size={18} color="#10B981" />
              <Text className="text-base font-black text-white" numberOfLines={1}>
                Managed Client Account
              </Text>
            </View>
            <View className="bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shrink-0">
              <Text className="text-[10px] font-black uppercase text-emerald-400">
                SPONSORED CLIENT
              </Text>
            </View>
          </View>

          <View className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs text-zinc-400">Client Athlete:</Text>
              <Text className="text-sm font-bold text-white">
                {managedClient.avatarEmoji} {managedClient.name}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs text-zinc-400">Billing & Sponsorship:</Text>
              <Text className="text-xs font-semibold text-emerald-400">
                Covered by Coach Plan (Free VIP)
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs text-zinc-400">Assigned Split:</Text>
              <Text className="text-xs font-bold text-cyan-300">
                {managedClient.assignedSplitName || 'None assigned yet'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-zinc-400">Client PIN / Token:</Text>
              <Text className="text-xs font-mono font-bold text-zinc-300">
                {managedClient.claimToken?.code
                  ? managedClient.claimToken.code
                  : managedClient.type === 'linked'
                  ? 'Linked App User'
                  : 'Shadow Athlete (In-Person)'}
              </Text>
            </View>
          </View>

          <Text className="text-xs text-zinc-400 mb-4 leading-relaxed">
            You are managing {managedClient.name}&apos;s profile, macro prescriptions, and workouts. Changes save directly to their roster record.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              stopManagingClient();
              router.push('/(tabs)/clients');
            }}
            className="bg-emerald-500 py-3 rounded-xl items-center flex-row justify-center space-x-2 shadow-md shadow-emerald-500/20"
          >
            <Ionicons name="arrow-back" size={16} color="#000" />
            <Text className="text-black font-black text-xs uppercase tracking-wider">
              Exit to Coach Roster
            </Text>
          </TouchableOpacity>
        </View>
      ) : isCoachAccount ? (
        /* 2. COACH ACCOUNT VIEW (In Coach Hub or Coach's Own Workout Profile) */
        <View>
          {/* Coach Subscription & Seats Card */}
          <View className="bg-dark-card border border-amber-500/40 p-5 rounded-3xl mb-5 shadow-lg relative overflow-hidden">
            <View className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <View className="flex-row items-center justify-between mb-3 pb-2.5 border-b border-zinc-800">
              <View className="flex-row items-center space-x-2 flex-1 min-w-0 mr-2">
                <Ionicons name="ribbon" size={18} color="#F59E0B" />
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  Coach Subscription & Plan
                </Text>
              </View>
              <View className="bg-amber-500/20 border border-amber-500/50 px-2.5 py-0.5 rounded-full shrink-0">
                <Text className="text-[10px] font-black uppercase text-amber-400">
                  {TIER_CONFIGS[trainerSubscription.tier].name}
                </Text>
              </View>
            </View>

            <View className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 mb-3">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-black text-white">
                  {TIER_CONFIGS[trainerSubscription.tier].name} ({trainerSubscription.seatLimit} Clients)
                </Text>
                <Text className="text-sm font-black text-amber-400">
                  R{trainerSubscription.priceZar}/mo
                </Text>
              </View>
              <Text className="text-xs text-zinc-400 mb-3">
                {activeSeatsUsed} of {trainerSubscription.seatLimit} active client seats occupied.
              </Text>
              {/* Progress Bar */}
              <View className="h-2 w-full bg-zinc-850 rounded-full overflow-hidden mb-1">
                <View
                  className={`h-full rounded-full ${
                    activeSeatsUsed >= trainerSubscription.seatLimit ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((activeSeatsUsed / trainerSubscription.seatLimit) * 100))}%`,
                  }}
                />
              </View>
            </View>

            {/* Personal Profile Free Inclusion Notice */}
            <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3 mb-3 flex-row items-center space-x-2.5">
              <Ionicons name="checkmark-circle" size={18} color="#06B6D4" />
              <View className="flex-1">
                <Text className="text-xs font-bold text-white">
                  Personal Workout Profile Included
                </Text>
                <Text className="text-[11px] text-cyan-300">
                  Free with your coach plan • Consumes 0 of your {trainerSubscription.seatLimit} client seats.
                </Text>
              </View>
            </View>

            {/* Action Buttons: Manage Seats & Mode Switcher */}
            <View className="space-y-2">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setIsUpgradingFromAthlete(false);
                  setShowSeatUpgradeModal(true);
                }}
                className="bg-amber-400 py-3 rounded-xl items-center shadow-md shadow-amber-500/20"
              >
                <Text className="text-black font-extrabold text-xs uppercase tracking-wider">
                  Manage Seat Capacity (ZAR)
                </Text>
              </TouchableOpacity>

              {isViewingPersonalProfile || userRole === 'athlete' ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    exitPersonalAthleteMode();
                    router.push('/(tabs)/clients');
                  }}
                  className="bg-zinc-850 border border-amber-500/40 py-2.5 rounded-xl items-center flex-row justify-center space-x-2"
                >
                  <Ionicons name="arrow-back" size={15} color="#F59E0B" />
                  <Text className="text-xs font-bold text-amber-400">Return to Coach Hub</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    enterPersonalAthleteMode();
                    router.push('/(tabs)/workouts');
                  }}
                  className="bg-zinc-850 border border-cyan-500/40 py-2.5 rounded-xl items-center flex-row justify-center space-x-2"
                >
                  <Ionicons name="person" size={15} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-300">Open My Profile (Workout Mode)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Coach Branding & Business Profile Card */}
          <View className="bg-dark-card border border-cyan-500/30 p-4 rounded-3xl mb-5 shadow-lg relative overflow-hidden">
            <View className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="briefcase" size={18} color="#06B6D4" />
                <Text className="text-base font-black text-white">Coach Branding & Referrals</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCoachName(coachProfile.name);
                  setBusinessName(coachProfile.businessName);
                  setInstagramHandle(coachProfile.instagramHandle);
                  setShowCoachModal(true);
                }}
                className="bg-zinc-800 border border-cyan-500/40 px-3 py-1 rounded-lg"
              >
                <Text className="text-xs font-bold text-accent-cyan">Edit</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-850 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs text-zinc-400">Coach Name:</Text>
                <Text className="text-xs font-bold text-white">{coachProfile.name}</Text>
              </View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs text-zinc-400">Business / Studio:</Text>
                <Text className="text-xs font-bold text-accent-cyan">
                  {coachProfile.businessName || 'Apex Performance Coaching'}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-zinc-400">Instagram Handle:</Text>
                <Text className="text-xs font-mono font-bold text-emerald-400">
                  {coachProfile.instagramHandle || '@ripped_coach'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-xl">
              <View className="flex-row items-center space-x-2 flex-1 mr-2">
                <Ionicons name="people" size={16} color="#06B6D4" />
                <Text className="text-xs text-zinc-300 font-medium">
                  Active Client Directory: <Text className="text-white font-bold">{clients.length} Athletes</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (isViewingPersonalProfile) {
                    exitPersonalAthleteMode();
                  }
                  router.push('/(tabs)/clients');
                }}
                className="bg-accent-cyan px-2.5 py-1 rounded-lg"
              >
                <Text className="text-[10px] font-black text-black">Open Roster →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* 3. SOLO / REGULAR ATHLETE VIEW */
        <View>
          {/* Subscription & Plan */}
          <View className="bg-dark-card border border-dark-border p-5 rounded-3xl mb-5 shadow-lg">
            <View className="flex-row items-center justify-between mb-2 pb-2.5 border-b border-zinc-800">
              <View className="flex-row items-center space-x-2 flex-1 min-w-0 mr-2">
                <Ionicons name="shield-checkmark" size={18} color="#06B6D4" />
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  Subscription & Plan
                </Text>
              </View>
              <View
                className={`px-2.5 py-0.5 rounded-full border shrink-0 ${
                  linkedCoach
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : 'bg-cyan-500/15 border-cyan-500/40'
                }`}
              >
                <Text
                  className={`text-[10px] font-black uppercase ${
                    linkedCoach ? 'text-emerald-400' : 'text-cyan-300'
                  }`}
                >
                  {athleteMembership.status === 'sponsored_by_coach' || linkedCoach
                    ? 'Sponsored Athlete (Free VIP)'
                    : athleteMembership.status === 'solo_trial'
                    ? 'Solo Pro (Free Trial)'
                    : athleteMembership.status === 'solo_active'
                    ? 'Solo Pro Active'
                    : 'Athlete Active'}
                </Text>
              </View>
            </View>

            {athleteMembership.status === 'graduated' && (
              <TouchableOpacity
                onPress={() => setShowGraduationModal(true)}
                className="bg-cyan-500/20 border border-cyan-400 p-3.5 rounded-2xl mb-3 flex-row items-center justify-between"
              >
                <View className="flex-row items-center space-x-2 flex-1 pr-2">
                  <Text className="text-lg">🎓</Text>
                  <View>
                    <Text className="text-xs font-bold text-white">Graduated from Coach Training</Text>
                    <Text className="text-[11px] text-cyan-300">Tap to review milestones & choose a solo plan</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#06B6D4" />
              </TouchableOpacity>
            )}

            {athleteMembership.status === 'solo_trial' && (
              <View className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 mb-3">
                <View className="flex-row items-center space-x-2 mb-1">
                  <Ionicons name="flash" size={16} color="#06B6D4" />
                  <Text className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                    RIPPED Solo Pro Trial Active
                  </Text>
                </View>
                <Text className="text-xs text-zinc-300 leading-relaxed">
                  You graduated from coach training! Your 7-day free trial gives you full access to unlimited custom splits, live co-op, and 1RM progression analytics.
                </Text>
              </View>
            )}

            {linkedCoach ? (
              <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 mb-3">
                <View className="flex-row items-center space-x-2 mb-1">
                  <Ionicons name="gift" size={16} color="#10B981" />
                  <Text className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    Sponsored by Coach
                  </Text>
                </View>
                <Text className="text-xs text-zinc-300 leading-relaxed">
                  Your account is fully sponsored by your coach{' '}
                  <Text className="font-bold text-white">{linkedCoach.name}</Text>
                  {linkedCoach.businessName ? ` (${linkedCoach.businessName})` : ''}. You have full access to workouts, split builder, and macro logging with 0 subscription fees.
                </Text>
              </View>
            ) : athleteMembership.status !== 'solo_trial' && athleteMembership.status !== 'graduated' ? (
              <Text className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Your active subscription includes unlimited custom split builders, workout logs, progressive overload analytics, and macro tracking.
              </Text>
            ) : null}

            {/* Compare Plans & Coach Upgrade */}
            <View className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 mt-1">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center space-x-2">
                  <Ionicons name="sparkles" size={16} color="#06B6D4" />
                  <Text className="text-sm font-bold text-white">Membership & Coaching Tiers</Text>
                </View>
                <Text className="text-xs font-black text-cyan-300">from R59/mo</Text>
              </View>
              <Text className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Compare individual Athlete features (R59/mo) and Personal Trainer client seat plans (Entry R199, Standard R399, Pro R699, Custom).
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setIsUpgradingFromAthlete(true);
                  setShowSeatUpgradeModal(true);
                }}
                className="bg-zinc-850 border border-cyan-500/50 py-3 rounded-xl items-center flex-row justify-center space-x-2 shadow-sm"
              >
                <Ionicons name="layers-outline" size={15} color="#06B6D4" />
                <Text className="text-cyan-300 font-black text-xs uppercase tracking-wider">
                  View & Compare All Plans
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* My Coach / Personal Trainer Card */}
          <View className="bg-dark-card border border-dark-border p-4 rounded-3xl mb-5 shadow-lg">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
              <View className="flex-row items-center space-x-2 flex-1 min-w-0">
                <Ionicons name="shield-checkmark" size={18} color="#06B6D4" />
                <Text className="text-base font-black text-white" numberOfLines={1}>
                  My Coach / Trainer
                </Text>
              </View>
              {linkedCoach && (
                <View className="bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-emerald-400">Linked</Text>
                </View>
              )}
            </View>

            {linkedCoach ? (
              <View>
                <View className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-850 mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs text-zinc-400">Coach Name:</Text>
                    <Text className="text-xs font-bold text-white">{linkedCoach.name}</Text>
                  </View>
                  {linkedCoach.businessName ? (
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs text-zinc-400">Business / Studio:</Text>
                      <Text className="text-xs font-bold text-accent-cyan">
                        {linkedCoach.businessName}
                      </Text>
                    </View>
                  ) : null}
                  {linkedCoach.instagramHandle ? (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-zinc-400">Instagram Handle:</Text>
                      <Text className="text-xs font-mono font-bold text-emerald-400">
                        {linkedCoach.instagramHandle}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] text-zinc-500 flex-1 mr-2">
                    Attribution appears on your performance receipts.
                  </Text>
                  <TouchableOpacity
                    onPress={handleUnlinkCoach}
                    className="bg-cyan-500/15 border border-cyan-400/50 px-2.5 py-1.5 rounded-xl shrink-0 flex-row items-center space-x-1"
                  >
                    <Text className="text-xs">🎓</Text>
                    <Text className="text-xs font-bold text-cyan-300" numberOfLines={1}>Graduate & Go Solo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* No coach linked — show the PIN entry & QR scan */
              <View className="bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-850/80">
                <Text className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Have an invite code from your coach? Scan their QR code or enter your PIN to claim your account, transfer all your data, and train completely free under their plan:
                </Text>
                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowScanner(true);
                    }}
                    className="flex-1 bg-cyan-500/20 border border-cyan-500/50 py-3 rounded-xl items-center flex-row justify-center space-x-1.5 shadow-sm min-w-0"
                  >
                    <Ionicons name="qr-code-outline" size={15} color="#06B6D4" />
                    <Text className="text-xs font-black text-cyan-300" numberOfLines={1}>Scan QR Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setClaimInviteCode('');
                      setShowClaimInviteModal(true);
                    }}
                    className="bg-zinc-850 border border-zinc-750 px-3.5 py-3 rounded-xl items-center flex-row justify-center space-x-1.5 shrink-0"
                  >
                    <Ionicons name="key" size={14} color="#A1A1AA" />
                    <Text className="text-xs font-bold text-zinc-300" numberOfLines={1}>Enter PIN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Active User Identity */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-3 flex-1 min-w-0 mr-2">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center shrink-0 ${
              managedClient
                ? 'bg-emerald-500'
                : isCoachAccount
                ? 'bg-amber-400'
                : 'bg-accent-cyan'
            }`}
          >
            <Text className="text-black font-extrabold text-lg">
              {managedClient
                ? managedClient.avatarEmoji || '👤'
                : (coachProfile.name || activeUser.displayName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center space-x-2">
              <Text className="text-base font-bold text-white flex-1" numberOfLines={1}>
                {managedClient
                  ? managedClient.name
                  : isCoachAccount
                  ? coachProfile.name || activeUser.displayName
                  : activeUser.displayName}
              </Text>
              {!managedClient && (
                <TouchableOpacity
                  onPress={() => openEditName(activeUser.id, activeUser.displayName)}
                  className="p-1 bg-zinc-800 rounded-md border border-zinc-700 shrink-0"
                >
                  <Ionicons name="pencil" size={12} color="#06B6D4" />
                </TouchableOpacity>
              )}
            </View>
            <Text className="text-xs text-zinc-400" numberOfLines={1}>
              {managedClient
                ? `Managed Client • Sponsored under ${coachProfile.name}`
                : isCoachAccount
                ? isViewingPersonalProfile || userRole === 'athlete'
                  ? 'Coach Personal Profile (0 Seats Used • Free)'
                  : `Head Coach • ${coachProfile.businessName || 'Apex Performance'}`
                : activeUser.email}
            </Text>
          </View>
        </View>

        <View
          className={`px-3 py-1 rounded-full border shrink-0 ${
            managedClient
              ? 'bg-emerald-500/20 border-emerald-500'
              : isCoachAccount
              ? 'bg-amber-500/20 border-amber-500'
              : 'bg-accent-cyan/20 border-accent-cyan'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              managedClient
                ? 'text-emerald-400'
                : isCoachAccount
                ? 'text-amber-400'
                : 'text-accent-cyan'
            }`}
            numberOfLines={1}
          >
            {managedClient
              ? 'Client Profile'
              : isCoachAccount
              ? isViewingPersonalProfile || userRole === 'athlete'
                ? 'Personal'
                : 'Coach'
              : 'Active'}
          </Text>
        </View>
      </View>

      {/* App & Training Preferences Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
          <View className="flex-row items-center space-x-2">
            <View className="w-6 h-6 rounded-lg bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
              <Ionicons name="options-outline" size={14} color="#06B6D4" />
            </View>
            <Text className="text-base font-bold text-white">App Preferences</Text>
          </View>
        </View>

        <View className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-bold text-white">Weight Display Unit</Text>
              <Text className="text-[11px] text-zinc-400 mt-0.5">
                Choose whether workouts and logs display in kg or lbs.
              </Text>
            </View>
            <View className="flex-row bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateWeightUnit('kg');
                }}
                className={`px-3 py-1.5 rounded-lg ${
                  (activeUser.weightUnit || 'kg') === 'kg' ? 'bg-cyan-500' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    (activeUser.weightUnit || 'kg') === 'kg' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  KG
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateWeightUnit('lbs');
                }}
                className={`px-3 py-1.5 rounded-lg ${
                  activeUser.weightUnit === 'lbs' ? 'bg-cyan-500' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    activeUser.weightUnit === 'lbs' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  LBS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Cloud Sync & Firebase Account Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
          <View className="flex-row items-center space-x-2">
            <View className="w-6 h-6 rounded-lg bg-cyan-500/20 items-center justify-center border border-cyan-500/40">
              <Ionicons name="cloud-done" size={14} color="#06B6D4" />
            </View>
            <Text className="text-base font-bold text-white">Cloud Sync & Backup</Text>
          </View>
          <View
            className={`px-2 py-0.5 rounded-full border ${
              cloudSyncStatus === 'synced'
                ? 'bg-emerald-500/20 border-emerald-500/40'
                : 'bg-amber-500/20 border-amber-500/40'
            }`}
          >
            <Text
              className={`text-[10px] font-extrabold uppercase ${
                cloudSyncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {cloudSyncStatus === 'synced' ? '● Connected' : '● Offline Cache'}
            </Text>
          </View>
        </View>

        <View className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 mb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-xs text-zinc-400 font-medium">Active Account</Text>
              <Text className="text-sm font-bold text-white mt-0.5" numberOfLines={1}>
                {!firebaseUser || firebaseUser.isAnonymous
                  ? 'Guest / Local Device'
                  : firebaseUser.email}
              </Text>
              {firebaseUser && !firebaseUser.isAnonymous && (
                <View className="mt-1.5 flex-row items-center">
                  {firebaseUser.emailVerified ? (
                    <View className="flex-row items-center space-x-1 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                      <Text className="text-[10px] font-bold text-emerald-400">Verified Email</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleResendVerification}
                      disabled={isSendingVerification}
                      className="flex-row items-center space-x-1.5 bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 rounded-full"
                    >
                      <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                      <Text className="text-[10px] font-bold text-amber-400">
                        {isSendingVerification ? 'Sending link...' : 'Unverified · Tap to resend link'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAuthModal(true);
              }}
              className="bg-zinc-800 border border-cyan-500/40 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-xs font-bold text-accent-cyan">
                {!firebaseUser || firebaseUser.isAnonymous ? 'Sign In / Link' : 'Manage'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text className="text-[11px] text-zinc-500 mt-2">
            Database: ripped-a5726 • 100% offline-resilient local cache enabled
          </Text>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await syncAllToCloud();
              Alert.alert('Sync Complete ☁️', 'All workouts, metrics, and profiles are synced to Cloud Firestore.');
            }}
            className="flex-1 bg-zinc-900 border border-zinc-750 py-2.5 rounded-xl flex-row items-center justify-center space-x-2"
          >
            <Ionicons name="sync-outline" size={15} color="#06B6D4" />
            <Text className="text-xs font-bold text-accent-cyan">Sync Cloud</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowBackupRestoreModal(true);
            }}
            className="flex-1 bg-zinc-900 border border-emerald-500/40 py-2.5 rounded-xl flex-row items-center justify-center space-x-2"
          >
            <Ionicons name="download-outline" size={15} color="#10B981" />
            <Text className="text-xs font-bold text-emerald-400">Export / Import</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out? You will return to the welcome screen where you or a friend can log in with your own account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await signOut();
                    router.replace('/');
                  },
                },
              ]
            );
          }}
          className="mt-2.5 bg-rose-500/10 border border-rose-500/30 py-2.5 rounded-xl flex-row items-center justify-center space-x-2"
        >
          <Ionicons name="log-out-outline" size={16} color="#F43F5E" />
          <Text className="text-xs font-bold text-rose-400">
            Sign Out / Switch Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* Target Macros Config Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="nutrition" size={20} color="#06B6D4" />
            <Text className="text-base font-bold text-white">Daily Macro Targets</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setCalories(activeUser.macroTargets.calories.toString());
              setProtein(activeUser.macroTargets.protein.toString());
              setCarbs(activeUser.macroTargets.carbs.toString());
              setFats(activeUser.macroTargets.fats.toString());
              setShowMacroModal(true);
            }}
            className="bg-zinc-800 border border-cyan-500/40 px-3 py-1 rounded-lg"
          >
            <Text className="text-xs font-bold text-accent-cyan">Edit</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-center bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
          <View className="items-center flex-1 border-r border-zinc-800">
            <Text className="text-[10px] text-zinc-500 font-bold">ENERGY</Text>
            <Text className="text-base font-bold text-accent-cyan">
              {activeUser.macroTargets.calories}
            </Text>
            <Text className="text-[10px] text-zinc-400">kcal</Text>
          </View>
          <View className="items-center flex-1 border-r border-zinc-800">
            <Text className="text-[10px] text-zinc-500 font-bold">PROTEIN</Text>
            <Text className="text-base font-bold text-accent-emerald">
              {activeUser.macroTargets.protein}g
            </Text>
          </View>
          <View className="items-center flex-1 border-r border-zinc-800">
            <Text className="text-[10px] text-zinc-500 font-bold">CARBS</Text>
            <Text className="text-base font-bold text-accent-cyan">
              {activeUser.macroTargets.carbs}g
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-[10px] text-zinc-500 font-bold">FATS</Text>
            <Text className="text-base font-bold text-amber-400">
              {activeUser.macroTargets.fats}g
            </Text>
          </View>
        </View>
      </View>



      {/* Device Local Storage & Test Data Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-10">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="phone-portrait-outline" size={20} color="#06B6D4" />
            <Text className="text-base font-bold text-white">Device Local Storage</Text>
          </View>
          <View className="flex-row items-center bg-accent-emerald/15 border border-accent-emerald/30 px-2 py-0.5 rounded-full">
            <View className="w-1.5 h-1.5 rounded-full bg-accent-emerald mr-1.5" />
            <Text className="text-[10px] font-bold text-accent-emerald">Persistent</Text>
          </View>
        </View>

        <Text className="text-xs text-zinc-400 mb-3">
          All workouts, custom exercises, splits, and weigh-ins are saved directly to your device's persistent storage (<Text className="text-zinc-300 font-mono">AsyncStorage</Text>). Your changes remain intact across app updates, reboots, and offline gym use.
        </Text>

        <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-4">
          <Text className="text-xs font-semibold text-zinc-300 mb-2">Locally Saved Summary:</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-base font-bold text-white">{workoutLogs.length}</Text>
              <Text className="text-[10px] text-zinc-400">Workouts</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base font-bold text-white">{nutritionLogs.length}</Text>
              <Text className="text-[10px] text-zinc-400">Nutrition Days</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base font-bold text-white">{bodyMetrics.length}</Text>
              <Text className="text-[10px] text-zinc-400">Weigh-Ins</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base font-bold text-white">{exercises.length}</Text>
              <Text className="text-[10px] text-zinc-400">Exercises</Text>
            </View>
          </View>
        </View>

        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Clear Test Logs',
                'Are you sure you want to clear all logged workouts, nutrition, and weigh-in records to start testing with a fresh slate?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear Data',
                    style: 'destructive',
                    onPress: async () => {
                      await clearAllData();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Logs Cleared', 'All test workouts, meals, and weigh-in logs have been cleared.');
                    },
                  },
                ]
              );
            }}
            className="flex-1 bg-zinc-800 border border-zinc-700 py-2.5 px-3 rounded-xl items-center mr-1"
          >
            <Text className="text-xs font-bold text-rose-400">Clear Test Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Reset to Demo Defaults',
                'Reset all accounts, splits, exercises, and logs to initial factory demo state?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset All',
                    style: 'destructive',
                    onPress: async () => {
                      await resetAllDataToDefaults();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Reset Complete', 'App data has been reset to initial defaults.');
                    },
                  },
                ]
              );
            }}
            className="flex-1 bg-zinc-800 border border-zinc-700 py-2.5 px-3 rounded-xl items-center ml-1"
          >
            <Text className="text-xs font-bold text-zinc-300">Reset Defaults</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Macro Target Edit Modal */}
      <Modal visible={showMacroModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <Text className="text-lg font-bold text-white">
                Edit Target Macros ({activeUser.displayName})
              </Text>
              <TouchableOpacity onPress={() => setShowMacroModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-1">Target Calories (kcal)</Text>
            <TextInput
              keyboardType="numeric"
              value={calories}
              onChangeText={setCalories}
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold"
            />

            <View className="flex-row space-x-3 mb-6">
              <View className="flex-1">
                <Text className="text-xs text-accent-emerald mb-1">Protein (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-accent-cyan mb-1">Carbs (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-amber-400 mb-1">Fats (g)</Text>
                <TextInput
                  keyboardType="numeric"
                  value={fats}
                  onChangeText={setFats}
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl font-bold"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveMacros}
              className="bg-accent-cyan p-3.5 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Save Targets</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* Edit Display Name Modal */}
      <Modal visible={showEditNameModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <Text className="text-lg font-bold text-white">Edit Display Name</Text>
              <TouchableOpacity onPress={() => setShowEditNameModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-2">
              Update the name that appears throughout workouts, logs, and benchmarks:
            </Text>
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor="#71717A"
              autoFocus
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold text-base"
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowEditNameModal(false)}
                className="flex-1 bg-zinc-800 py-3 rounded-xl items-center border border-zinc-700"
              >
                <Text className="text-zinc-300 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                className="flex-1 bg-accent-cyan py-3 rounded-xl items-center shadow-md shadow-cyan-500/20"
              >
                <Text className="text-black font-extrabold text-sm">Save Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Coach Profile & Branding Modal */}
      <Modal visible={showCoachModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="briefcase" size={20} color="#06B6D4" />
                <Text className="text-lg font-black text-white">Coach & Business Branding</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCoachModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-3">
              This info automatically appears on your exported client plans and branded workout receipt cards.
            </Text>

            <Text className="text-xs font-bold text-zinc-400 mb-1">Coach Display Name</Text>
            <TextInput
              value={coachName}
              onChangeText={setCoachName}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold"
            />

            <Text className="text-xs font-bold text-zinc-400 mb-1">Business / Studio / Gym Name</Text>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Apex Performance Coaching"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-bold"
            />

            <Text className="text-xs font-bold text-zinc-400 mb-1">Instagram Handle (Referral Tag)</Text>
            <TextInput
              value={instagramHandle}
              onChangeText={setInstagramHandle}
              placeholder="@alex_apexfit"
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-5 font-mono font-bold"
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowCoachModal(false)}
                className="flex-1 bg-zinc-800 py-3.5 rounded-xl items-center border border-zinc-700"
              >
                <Text className="text-zinc-300 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveCoachProfile}
                className="flex-1 bg-accent-cyan py-3.5 rounded-xl items-center shadow-md shadow-cyan-500/20"
              >
                <Text className="text-black font-extrabold text-sm">Save Branding</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Claim Invite PIN Modal for Athletes */}
      <Modal visible={showClaimInviteModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-3xl">
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="key" size={20} color="#06B6D4" />
                <Text className="text-lg font-black text-white">Claim Coach Invite</Text>
              </View>
              <TouchableOpacity onPress={() => setShowClaimInviteModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-3 leading-relaxed">
              Enter the 6-character PIN code provided by your coach (e.g. <Text className="font-mono text-cyan-300">RIP-XXXX</Text>).
            </Text>

            <View className="flex-row items-center space-x-2 mb-3">
              <TextInput
                value={claimInviteCode}
                onChangeText={(t) => setClaimInviteCode(t.toUpperCase())}
                placeholder="e.g. RIP-8K2"
                placeholderTextColor="#71717A"
                autoCapitalize="characters"
                className="flex-1 bg-zinc-900 border border-zinc-800 text-white p-3.5 rounded-xl font-mono font-black text-center text-lg tracking-widest"
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowClaimInviteModal(false);
                  setShowScanner(true);
                }}
                className="p-3.5 bg-cyan-500/20 border border-cyan-500/50 rounded-xl items-center justify-center"
              >
                <Ionicons name="camera-outline" size={22} color="#06B6D4" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowClaimInviteModal(false);
                setShowScanner(true);
              }}
              className="mb-4 bg-cyan-500/10 border border-cyan-500/30 py-2.5 rounded-xl items-center flex-row justify-center space-x-2"
            >
              <Ionicons name="qr-code-outline" size={15} color="#06B6D4" />
              <Text className="text-xs font-bold text-cyan-300">Point Camera at Coach's QR Code</Text>
            </TouchableOpacity>

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowClaimInviteModal(false)}
                className="flex-1 bg-zinc-800 py-3.5 rounded-xl items-center border border-zinc-700"
              >
                <Text className="text-zinc-300 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClaimInvite}
                disabled={isClaiming}
                className={`flex-1 py-3.5 rounded-xl items-center shadow-md ${
                  isClaiming ? 'bg-cyan-500/50' : 'bg-accent-cyan shadow-cyan-500/20'
                }`}
              >
                <Text className="text-black font-extrabold text-sm">
                  {isClaiming ? 'Linking...' : 'Claim & Sync'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subscription & Coaching Tiers Modal */}
      <SeatUpgradeModal
        visible={showSeatUpgradeModal}
        onClose={() => {
          setShowSeatUpgradeModal(false);
          setIsUpgradingFromAthlete(false);
        }}
        currentSubscription={trainerSubscription}
        activeSeatsUsed={activeSeatsUsed}
        isCurrentlyAthlete={!isCoachAccount}
        onUpgradeSuccess={(tier, customSeats) => {
          if (!isCoachAccount || isUpgradingFromAthlete) {
            setAccountType('coach');
            setIsUpgradingFromAthlete(false);
          }
          upgradeTrainerSubscription(tier, customSeats);
        }}
        onRequireDowngradeReconcile={(targetTier) => {
          setDowngradeTargetTier(targetTier);
          setShowDowngradeModal(true);
        }}
        onSwitchToAthlete={() => {
          setAccountType('athlete');
          router.push('/(tabs)/workouts');
        }}
      />

      {/* Coach: Downgrade Seat Reconciliation */}
      <DowngradeReconcileModal
        visible={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        targetTier={downgradeTargetTier}
        activeClients={clients.filter((c) => c.status !== 'archived')}
        onConfirmReconcile={(tier, selectedIds) => {
          reconcileDowngradeSeats(tier, selectedIds);
          Alert.alert(
            'Tier Downgraded',
            `Switched to ${TIER_CONFIGS[tier].name}. ${selectedIds.length} clients remain active.`
          );
        }}
      />

      {/* Cloud Sync & Firebase Account Modal */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* JSON Backup & Restore Modal */}
      <DataBackupRestoreModal
        visible={showBackupRestoreModal}
        onClose={() => setShowBackupRestoreModal(false)}
      />

      {/* Athlete Graduation Modal */}
      <GraduationModal
        visible={showGraduationModal || athleteMembership.status === 'graduated'}
        onClose={() => setShowGraduationModal(false)}
      />

      {/* QR Code Camera Scanner */}
      <QRCodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleScannedInvite}
        title="Scan Coach's QR Code"
        subtitle="Align your coach's invite QR code in frame"
      />
    </ScrollView>
  </View>
);
}
