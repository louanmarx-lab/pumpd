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

export default function SettingsScreen() {
  const router = useRouter();
  const {
    currentUser,
    partnerUser,
    activeUser,
    activeWorkspace,
    userRole,
    coachProfile,
    clients,
    setUserRole,
    updateCoachProfile,
    exercises,
    workoutLogs,
    nutritionLogs,
    bodyMetrics,
    updateMacroTargets,
    updateUserName,
    linkPartnerUser,
    switchActiveUser,
    clearAllData,
    resetAllDataToDefaults,
    firebaseUser,
    cloudSyncStatus,
    syncAllToCloud,
    signOut,
  } = useUserWorkspace();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBackupRestoreModal, setShowBackupRestoreModal] = useState(false);

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

  // Link Partner Modal State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');

  // Edit Name Modal State
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  const handleLinkPartner = () => {
    if (!partnerName.trim()) {
      Alert.alert('Required', 'Please enter partner name.');
      return;
    }
    linkPartnerUser(partnerName.trim(), partnerEmail.trim() || 'partner@pumpd.app');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPartnerName('');
    setPartnerEmail('');
    setShowPartnerModal(false);
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
    <ScrollView
      className="flex-1 bg-dark-bg px-4 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Role Switcher Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-3xl mb-5 shadow-lg">
        <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-zinc-800">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="swap-horizontal" size={18} color="#06B6D4" />
            <Text className="text-base font-black text-white">App Experience Mode</Text>
          </View>
          <View className="bg-cyan-500/15 border border-cyan-500/40 px-2.5 py-0.5 rounded-full">
            <Text className="text-[10px] font-black text-cyan-300 uppercase">
              {userRole === 'coach' ? 'Trainer View' : 'Athlete View'}
            </Text>
          </View>
        </View>

        <Text className="text-xs text-zinc-400 mb-3">
          Switch between personal trainer client management and solo athlete workout tracking.
        </Text>

        <View className="flex-row space-x-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setUserRole('coach');
            }}
            className={`flex-1 py-3 px-3 rounded-xl items-center flex-row justify-center space-x-2 border ${
              userRole === 'coach'
                ? 'bg-accent-cyan border-accent-cyan shadow-md shadow-cyan-500/20'
                : 'bg-transparent border-transparent'
            }`}
          >
            <Ionicons
              name="barbell"
              size={18}
              color={userRole === 'coach' ? '#09090B' : '#71717A'}
            />
            <View>
              <Text
                className={`text-xs font-black ${
                  userRole === 'coach' ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Coach / Trainer
              </Text>
              <Text
                className={`text-[9px] ${
                  userRole === 'coach' ? 'text-zinc-900 font-bold' : 'text-zinc-500'
                }`}
              >
                Roster & Controller
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setUserRole('athlete');
            }}
            className={`flex-1 py-3 px-3 rounded-xl items-center flex-row justify-center space-x-2 border ${
              userRole === 'athlete'
                ? 'bg-accent-cyan border-accent-cyan shadow-md shadow-cyan-500/20'
                : 'bg-transparent border-transparent'
            }`}
          >
            <Ionicons
              name="fitness"
              size={18}
              color={userRole === 'athlete' ? '#09090B' : '#71717A'}
            />
            <View>
              <Text
                className={`text-xs font-black ${
                  userRole === 'athlete' ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Athlete / Lifter
              </Text>
              <Text
                className={`text-[9px] ${
                  userRole === 'athlete' ? 'text-zinc-900 font-bold' : 'text-zinc-500'
                }`}
              >
                Solo Tracking
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Coach Branding & Business Profile Card (Shown when role is coach) */}
      {userRole === 'coach' && (
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
                {coachProfile.instagramHandle || '@pumpd_coach'}
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
              onPress={() => router.push('/clients')}
              className="bg-accent-cyan px-2.5 py-1 rounded-lg"
            >
              <Text className="text-[10px] font-black text-black">Open Roster →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Active User Identity */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center space-x-3 flex-1">
          <View className="w-12 h-12 rounded-full bg-accent-cyan items-center justify-center">
            <Text className="text-black font-extrabold text-lg">
              {activeUser.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center space-x-2">
              <Text className="text-base font-bold text-white">{activeUser.displayName}</Text>
              <TouchableOpacity
                onPress={() => openEditName(activeUser.id, activeUser.displayName)}
                className="p-1 bg-zinc-800 rounded-md border border-zinc-700"
              >
                <Ionicons name="pencil" size={12} color="#06B6D4" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-zinc-400">{activeUser.email}</Text>
          </View>
        </View>

        <View className="bg-accent-cyan/20 border border-accent-cyan px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-accent-cyan">Active</Text>
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

      {/* Shared Workspace & Partner Account Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-5 shadow-md">
        <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="people" size={20} color="#8B5CF6" />
            <Text className="text-base font-bold text-white">Shared Workspace</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowPartnerModal(true)}
            className="bg-accent-purple/20 border border-accent-purple px-3 py-1 rounded-lg"
          >
            <Text className="text-xs font-bold text-accent-purple">+ Link Partner</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xs font-bold text-zinc-300 mb-1">{activeWorkspace.name}</Text>
        <Text className="text-xs text-zinc-400 mb-4">
          ID: {activeWorkspace.id} • {activeWorkspace.memberIds.length} Members
        </Text>

        {/* Member 1: Primary Account */}
        <View className="flex-row items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl mb-2">
          <View className="flex-row items-center space-x-3 flex-1">
            <View className="w-8 h-8 rounded-full bg-accent-orange items-center justify-center">
              <Text className="text-white font-bold text-xs">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center space-x-1.5">
                <Text className="text-sm font-bold text-white" numberOfLines={1}>
                  {currentUser.displayName}
                </Text>
                <TouchableOpacity
                  onPress={() => openEditName(currentUser.id, currentUser.displayName)}
                  className="p-1 bg-zinc-800 rounded-md border border-zinc-700"
                >
                  <Ionicons name="pencil" size={11} color="#06B6D4" />
                </TouchableOpacity>
              </View>
              <Text className="text-[10px] text-zinc-400">{currentUser.email}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              switchActiveUser(currentUser.id);
            }}
            className="bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-lg"
          >
            <Text className="text-xs font-bold text-zinc-300">
              {activeUser.id === currentUser.id ? 'Active' : 'Switch'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member 2: Gym Partner */}
        {partnerUser ? (
          <View className="flex-row items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
            <View className="flex-row items-center space-x-3 flex-1">
              <View className="w-8 h-8 rounded-full bg-accent-purple items-center justify-center">
                <Text className="text-white font-bold text-xs">
                  {partnerUser.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center space-x-1.5">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {partnerUser.displayName}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openEditName(partnerUser.id, partnerUser.displayName)}
                    className="p-1 bg-zinc-800 rounded-md border border-zinc-700"
                  >
                    <Ionicons name="pencil" size={11} color="#A78BFA" />
                  </TouchableOpacity>
                </View>
                <Text className="text-[10px] text-zinc-400">{partnerUser.email}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                switchActiveUser(partnerUser.id);
              }}
              className="bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-lg"
            >
              <Text className="text-xs font-bold text-zinc-300">
                {activeUser.id === partnerUser.id ? 'Active' : 'Switch'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="p-3 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl items-center">
            <Text className="text-xs text-zinc-400">No partner account linked yet.</Text>
          </View>
        )}
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

      {/* Link Partner Modal */}
      <Modal visible={showPartnerModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center px-4">
          <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-2">
              <Text className="text-lg font-bold text-white">Link Gym Partner</Text>
              <TouchableOpacity onPress={() => setShowPartnerModal(false)}>
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-1">Partner Display Name</Text>
            <TextInput
              value={partnerName}
              onChangeText={setPartnerName}
              placeholder="e.g. Jordan Smith"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-3 font-medium"
            />

            <Text className="text-xs text-zinc-400 mb-1">Partner Email / User ID</Text>
            <TextInput
              value={partnerEmail}
              onChangeText={setPartnerEmail}
              placeholder="e.g. jordan@pumpd.app"
              placeholderTextColor="#71717A"
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-6 font-medium"
            />

            <TouchableOpacity
              onPress={handleLinkPartner}
              className="bg-accent-cyan p-3.5 rounded-xl items-center shadow-md shadow-cyan-500/20"
            >
              <Text className="text-black font-extrabold text-base">Link Partner Account</Text>
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
    </ScrollView>
  );
}
