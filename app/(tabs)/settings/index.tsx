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

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';

export default function SettingsScreen() {
  const {
    currentUser,
    partnerUser,
    activeUser,
    activeWorkspace,
    updateMacroTargets,
    updateUserName,
    linkPartnerUser,
    switchActiveUser,
  } = useUserWorkspace();

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

  return (
    <ScrollView className="flex-1 bg-dark-bg px-4 py-4" showsVerticalScrollIndicator={false}>
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

      {/* Offline Persistence Status Card */}
      <View className="bg-dark-card border border-dark-border p-4 rounded-2xl mb-10">
        <View className="flex-row items-center space-x-2 mb-2">
          <Ionicons name="cloud-done-outline" size={20} color="#10B981" />
          <Text className="text-base font-bold text-white">Firestore Offline Engine</Text>
        </View>
        <Text className="text-xs text-zinc-400 mb-3">
          Zero-latency local cache enabled (`persistentLocalCache`). Logs and benchmarks read & write instantly in gym conditions.
        </Text>
        <View className="flex-row items-center bg-accent-emerald/10 border border-accent-emerald/30 p-2.5 rounded-xl space-x-2">
          <View className="w-2.5 h-2.5 rounded-full bg-accent-emerald" />
          <Text className="text-xs font-bold text-accent-emerald">
            Offline Storage & Cache Sync Active
          </Text>
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
    </ScrollView>
  );
}
