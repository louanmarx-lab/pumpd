import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useUserWorkspace } from '../src/context/UserWorkspaceContext';

export const HeaderSwitcher: React.FC = () => {
  const { currentUser, partnerUser, activeUser, switchActiveUser, updateUserName } = useUserWorkspace();
  const [modalVisible, setModalVisible] = useState(false);

  // Edit Name Sub-modal state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSwitch = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    switchActiveUser(userId);
    setModalVisible(false);
  };

  const openEditName = (userId: string, currentName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingUserId(userId);
    setEditingName(currentName);
  };

  const handleSaveName = () => {
    if (!editingName.trim()) {
      Alert.alert('Required', 'Please enter a valid display name.');
      return;
    }
    if (editingUserId) {
      updateUserName(editingUserId, editingName.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingUserId(null);
      setEditingName('');
    }
  };

  const isPartnerActive = partnerUser && activeUser.id === partnerUser.id;
  const firstName = activeUser.displayName ? activeUser.displayName.split(' ')[0] : 'User';

  return (
    <View className="relative">
      {/* Sleek Compact Header Chip */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
        className="flex-row items-center bg-zinc-900 border border-zinc-700/80 px-2.5 py-1.5 rounded-full space-x-1.5 shadow-sm"
      >
        <View
          className={`w-5 h-5 rounded-full items-center justify-center ${
            isPartnerActive ? 'bg-accent-purple' : 'bg-accent-cyan'
          }`}
        >
          <Text className="text-[11px] font-black text-black">
            {activeUser.displayName ? activeUser.displayName.charAt(0).toUpperCase() : 'P'}
          </Text>
        </View>
        <Text className="text-xs text-zinc-100 font-bold max-w-[80px]" numberOfLines={1}>
          {firstName}
        </Text>
        <Ionicons name="chevron-down" size={12} color="#A1A1AA" />
      </TouchableOpacity>

      {/* Main Switcher & Profile Modal */}
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
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <View className="flex-row items-center space-x-2">
                <Ionicons name="people-sharp" size={20} color="#06B6D4" />
                <Text className="text-lg font-bold text-white">Pumpd Partners</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#71717A" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-3">
              Tap a user to switch active sets & stats, or tap the pencil to edit their name:
            </Text>

            {/* Current User Option */}
            <View
              className={`p-3.5 rounded-xl mb-3 border ${
                activeUser.id === currentUser.id
                  ? 'bg-zinc-800/90 border-accent-cyan'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSwitch(currentUser.id)}
                  className="flex-row items-center space-x-3 flex-1"
                >
                  <View className="w-10 h-10 rounded-full bg-accent-cyan items-center justify-center">
                    <Text className="text-black font-extrabold text-base">
                      {currentUser.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-white" numberOfLines={1}>
                      {currentUser.displayName}
                    </Text>
                    <Text className="text-[11px] text-zinc-400">Account Owner</Text>
                  </View>
                </TouchableOpacity>

                <View className="flex-row items-center space-x-2">
                  <TouchableOpacity
                    onPress={() => openEditName(currentUser.id, currentUser.displayName)}
                    className="p-1.5 bg-zinc-800 rounded-lg border border-zinc-700"
                  >
                    <Ionicons name="pencil" size={14} color="#06B6D4" />
                  </TouchableOpacity>

                  {activeUser.id === currentUser.id && (
                    <View className="bg-accent-cyan/20 px-2 py-0.5 rounded-full border border-accent-cyan">
                      <Text className="text-[10px] font-bold text-accent-cyan">Active</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Partner User Option */}
            {partnerUser ? (
              <View
                className={`p-3.5 rounded-xl border mb-2 ${
                  activeUser.id === partnerUser.id
                    ? 'bg-zinc-800/90 border-accent-purple'
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleSwitch(partnerUser.id)}
                    className="flex-row items-center space-x-3 flex-1"
                  >
                    <View className="w-10 h-10 rounded-full bg-accent-purple items-center justify-center">
                      <Text className="text-white font-extrabold text-base">
                        {partnerUser.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-white" numberOfLines={1}>
                        {partnerUser.displayName}
                      </Text>
                      <Text className="text-[11px] text-zinc-400">Gym Partner</Text>
                    </View>
                  </TouchableOpacity>

                  <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                      onPress={() => openEditName(partnerUser.id, partnerUser.displayName)}
                      className="p-1.5 bg-zinc-800 rounded-lg border border-zinc-700"
                    >
                      <Ionicons name="pencil" size={14} color="#A78BFA" />
                    </TouchableOpacity>

                    {activeUser.id === partnerUser.id && (
                      <View className="bg-accent-purple/20 px-2 py-0.5 rounded-full border border-accent-purple">
                        <Text className="text-[10px] font-bold text-accent-purple">Active</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View className="p-3 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl items-center mb-2">
                <Text className="text-xs text-zinc-400 text-center">
                  No gym partner linked yet. Go to Settings to link a partner account.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Name Sub-modal */}
      <Modal
        visible={editingUserId !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingUserId(null)}
      >
        <Pressable
          className="flex-1 bg-black/80 justify-center items-center px-4"
          onPress={() => setEditingUserId(null)}
        >
          <Pressable
            className="w-full max-w-xs bg-dark-card border border-zinc-800 rounded-2xl p-5 shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
              <Text className="text-base font-bold text-white">Edit Display Name</Text>
              <TouchableOpacity onPress={() => setEditingUserId(null)}>
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-zinc-400 mb-2">Enter new name for this user profile:</Text>
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
                onPress={() => setEditingUserId(null)}
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
