import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUserWorkspace } from '../src/context/UserWorkspaceContext';

export const HeaderSwitcher: React.FC = () => {
  const router = useRouter();
  const {
    activeUser,
    userRole,
    setUserRole,
    updateUserName,
    firebaseUser,
  } = useUserWorkspace();
  const [modalVisible, setModalVisible] = useState(false);

  // Edit Name Sub-modal state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');

  const openEditName = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingName(activeUser.displayName || '');
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (!editingName.trim()) {
      Alert.alert('Required', 'Please enter a valid display name.');
      return;
    }
    updateUserName(activeUser.id, editingName.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditingName(false);
  };

  const displayName = activeUser.displayName || (firebaseUser?.email ? firebaseUser.email.split('@')[0] : 'Lifter');
  const firstName = displayName.split(' ')[0];
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <View className="relative flex-row items-center space-x-2">
      {/* Sleek Compact Header Chip */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
        className="flex-row items-center bg-zinc-900 border border-zinc-700/80 px-2.5 py-1.5 rounded-full space-x-2 shadow-sm"
      >
        <View
          className={`w-6 h-6 rounded-full items-center justify-center ${
            userRole === 'coach' ? 'bg-amber-400' : 'bg-accent-cyan'
          }`}
        >
          <Text className="text-[11px] font-black text-black">
            {userRole === 'coach' ? 'C' : userInitial}
          </Text>
        </View>
        <Text className="text-xs text-zinc-100 font-bold max-w-[80px]" numberOfLines={1}>
          {firstName}
        </Text>
        <View className={`px-1.5 py-0.5 rounded ${userRole === 'coach' ? 'bg-amber-500/20' : 'bg-cyan-500/20'}`}>
          <Text
            className={`text-[9px] font-extrabold uppercase ${
              userRole === 'coach' ? 'text-amber-400' : 'text-cyan-400'
            }`}
          >
            {userRole === 'coach' ? 'Coach' : 'Athlete'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={11} color="#A1A1AA" />
      </TouchableOpacity>

      {/* Main Profile & Experience Mode Sheet */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/75 justify-center items-center px-4"
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm bg-dark-card border border-zinc-800 rounded-2xl p-5 shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="person-circle-outline" size={22} color="#06B6D4" />
                <Text className="text-lg font-bold text-white">Profile & Mode</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Role Switcher Mode Bar */}
            <Text className="text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-wider">
              Experience Mode:
            </Text>
            <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-row mb-4">
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setUserRole('athlete');
                }}
                className={`flex-1 py-2 rounded-lg items-center ${
                  userRole === 'athlete' ? 'bg-cyan-500' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    userRole === 'athlete' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  🏃 Athlete Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setUserRole('coach');
                }}
                className={`flex-1 py-2 rounded-lg items-center ${
                  userRole === 'coach' ? 'bg-amber-400' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    userRole === 'coach' ? 'text-black' : 'text-zinc-400'
                  }`}
                >
                  🏋️ Coach CRM
                </Text>
              </TouchableOpacity>
            </View>

            {/* Authenticated User Profile Card */}
            <View className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center space-x-3 flex-1">
                  <View
                    className={`w-11 h-11 rounded-full items-center justify-center ${
                      userRole === 'coach' ? 'bg-amber-400' : 'bg-accent-cyan'
                    }`}
                  >
                    <Text className="text-black font-black text-lg">{userInitial}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-white" numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text className="text-xs text-zinc-400 mt-0.5" numberOfLines={1}>
                      {activeUser.email || firebaseUser?.email || 'Logged In'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={openEditName}
                  className="p-2 bg-zinc-800 rounded-lg border border-zinc-700 ml-2"
                >
                  <Ionicons name="pencil" size={15} color="#06B6D4" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Actions */}
            <View className="space-y-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setModalVisible(false);
                  router.push('/(tabs)/settings');
                }}
                className="w-full bg-zinc-800/80 border border-zinc-700 py-2.5 rounded-xl flex-row items-center justify-center space-x-2"
              >
                <Ionicons name="settings-outline" size={16} color="#A1A1AA" />
                <Text className="text-xs font-bold text-zinc-200">Account & Cloud Settings</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Name Sub-modal */}
      <Modal
        visible={isEditingName}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEditingName(false)}
      >
        <Pressable
          className="flex-1 bg-black/80 justify-center items-center px-4"
          onPress={() => setIsEditingName(false)}
        >
          <Pressable
            className="w-full max-w-xs bg-dark-card border border-zinc-800 rounded-2xl p-5 shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <Text className="text-base font-bold text-white">Edit Display Name</Text>
              <TouchableOpacity onPress={() => setIsEditingName(false)}>
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-2">Update your profile name:</Text>
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              placeholder="e.g. Alex"
              placeholderTextColor="#71717A"
              autoFocus
              className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold"
            />

            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={() => setIsEditingName(false)}
                className="flex-1 bg-zinc-800 py-2.5 rounded-xl items-center border border-zinc-700"
              >
                <Text className="text-zinc-300 font-semibold text-xs">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                className="flex-1 bg-accent-cyan py-2.5 rounded-xl items-center"
              >
                <Text className="text-black font-bold text-xs">Save Name</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default HeaderSwitcher;
