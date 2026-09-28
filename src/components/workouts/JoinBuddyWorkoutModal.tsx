import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { QRCodeScannerModal } from '../QRCodeScannerModal';
import { peekJamRoomCloud, normalizeJamRoomPin, JamRoomData } from '../../services/gymJamService';

interface JoinBuddyWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onJoin: (room: JamRoomData) => void;
}

export const JoinBuddyWorkoutModal: React.FC<JoinBuddyWorkoutModalProps> = ({
  visible,
  onClose,
  onJoin,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundRoom, setFoundRoom] = useState<JamRoomData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const resetState = () => {
    setPinInput('');
    setIsSearching(false);
    setFoundRoom(null);
    setErrorMessage(null);
    setShowScanner(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSearch = async (rawCode?: string) => {
    const code = (rawCode !== undefined ? rawCode : pinInput).trim();
    if (!code) {
      setErrorMessage('Please enter your buddy’s room PIN or code.');
      return;
    }

    setErrorMessage(null);
    setIsSearching(true);
    setFoundRoom(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await peekJamRoomCloud(code);
      if (res.success && res.data) {
        setFoundRoom(res.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMessage(res.error || 'Workout session not found. Please verify the PIN with your buddy.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to search for session.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleScannedCode = (scanned: string) => {
    setShowScanner(false);
    const clean = scanned.trim().toUpperCase();
    setPinInput(clean);
    handleSearch(clean);
  };

  const handleConfirmJoin = () => {
    if (!foundRoom) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onJoin(foundRoom);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/80"
      >
        <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[88%]">
          {/* Top Handle */}
          <View className="items-center mb-3">
            <View className="w-12 h-1.5 rounded-full bg-zinc-700" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <View className="flex-row items-center space-x-2.5">
              <View className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 items-center justify-center">
                <Ionicons name="people" size={22} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-lg font-black text-white">Join RIPPED BUDDY</Text>
                <Text className="text-xs text-zinc-400">Train in real-time with your workout partner</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              className="p-1.5 rounded-full bg-zinc-800"
            >
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* PIN Entry Card */}
            <View className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 mb-4">
              <Text className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Buddy Room PIN / Code
              </Text>

              <View className="flex-row items-center space-x-2 mb-3">
                <View className="flex-1 flex-row items-center bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5">
                  <Ionicons name="key-outline" size={18} color="#06B6D4" className="mr-2" />
                  <TextInput
                    value={pinInput}
                    onChangeText={(val) => {
                      setPinInput(val.toUpperCase());
                      setErrorMessage(null);
                      if (foundRoom) setFoundRoom(null);
                    }}
                    placeholder="e.g. 42 or RIP-42"
                    placeholderTextColor="#52525B"
                    autoCapitalize="characters"
                    returnKeyType="search"
                    onSubmitEditing={() => handleSearch()}
                    className="flex-1 text-white font-mono text-base font-bold ml-2"
                  />
                  {pinInput.length > 0 && (
                    <TouchableOpacity onPress={() => setPinInput('')}>
                      <Ionicons name="close-circle" size={18} color="#71717A" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Scan QR Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowScanner(true);
                  }}
                  className="bg-zinc-800 border border-cyan-500/40 p-3 rounded-xl items-center justify-center"
                >
                  <Ionicons name="qr-code-outline" size={20} color="#06B6D4" />
                </TouchableOpacity>
              </View>

              {/* Find Session Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSearch()}
                disabled={isSearching || !pinInput.trim()}
                className={`py-3 rounded-xl flex-row items-center justify-center space-x-2 ${
                  isSearching || !pinInput.trim()
                    ? 'bg-zinc-800 border border-zinc-700 opacity-60'
                    : 'bg-cyan-500 shadow-md shadow-cyan-500/25'
                }`}
              >
                {isSearching ? (
                  <>
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-black font-extrabold text-sm">Searching Room...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={16} color={!pinInput.trim() ? '#A1A1AA' : '#000'} />
                    <Text
                      className={`text-sm font-extrabold ${
                        !pinInput.trim() ? 'text-zinc-400' : 'text-black'
                      }`}
                    >
                      Find Live Session
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="mb-4 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex-row items-center space-x-2">
                <Ionicons name="alert-circle" size={18} color="#F43F5E" />
                <Text className="text-xs text-rose-300 flex-1 font-medium leading-4">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Live Session Found Preview Card */}
            {foundRoom && (
              <View className="bg-cyan-500/10 border border-cyan-500/40 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center space-x-1.5 bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                    <View className="w-2 h-2 rounded-full bg-emerald-400" />
                    <Text className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                      Live Workout Session
                    </Text>
                  </View>
                  <Text className="text-xs font-mono font-bold text-cyan-300">
                    {foundRoom.roomPin}
                  </Text>
                </View>

                <Text className="text-lg font-black text-white mb-0.5">
                  {foundRoom.routineName || 'Gym Workout'}
                </Text>

                <View className="flex-row items-center space-x-2 mb-3">
                  <Text className="text-xs font-bold text-cyan-300">
                    Hosted by {foundRoom.hostName}
                  </Text>
                  <Text className="text-zinc-600">•</Text>
                  <Text className="text-xs text-zinc-400">
                    {foundRoom.exerciseIds?.length || 0} exercises scheduled
                  </Text>
                </View>

                {/* Confirm Jump In Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmJoin}
                  className="bg-accent-cyan py-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/30"
                >
                  <Ionicons name="flash" size={18} color="#000000" />
                  <Text className="text-black font-black text-sm">
                    Jump In & Train Together
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Explainer Tip */}
            <View className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 flex-row items-start space-x-2.5">
              <Ionicons name="information-circle-outline" size={18} color="#06B6D4" className="mt-0.5" />
              <Text className="text-xs text-zinc-400 flex-1 leading-relaxed">
                When you jump in, you will be connected directly to your friend's live workout. Both of your phones will sync sets, rest timers, and weights in real-time!
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Camera QR Scanner Modal */}
      <QRCodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScanned={handleScannedCode}
        title="Scan Buddy QR Code"
        subtitle="Align your buddy's GymBuddy QR code in frame"
      />
    </Modal>
  );
};
