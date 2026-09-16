import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { JamConnectionStatus, JamRole } from '../types/gymjam';
import { QRCodeView } from './QRCodeView';

interface GymJamLobbyModalProps {
  visible: boolean;
  onClose: () => void;
  connectionStatus: JamConnectionStatus;
  roomPin: string | null;
  role: JamRole | null;
  partnerName: string | null;
  isWebRTC?: boolean;
  onHostSession: () => void;
  onJoinSession: (pin: string) => Promise<boolean>;
  onSimulatePartner?: () => void;
  onDisconnect: () => void;
  onStartSession: () => void;
}

export const GymJamLobbyModal: React.FC<GymJamLobbyModalProps> = ({
  visible,
  onClose,
  connectionStatus,
  roomPin,
  role,
  partnerName,
  isWebRTC = true,
  onHostSession,
  onJoinSession,
  onSimulatePartner,
  onDisconnect,
  onStartSession,
}) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [pinInput, setPinInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Auto initialize host room if opening modal with disconnected status
  useEffect(() => {
    if (visible && connectionStatus === 'disconnected' && !roomPin && activeTab === 'host') {
      onHostSession();
    }
  }, [visible, connectionStatus, roomPin, activeTab]);

  const handleSharePin = async () => {
    if (!roomPin) return;
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `Join my Gym Jam session on Pumpd! Room PIN: ${roomPin}`,
        title: 'Pumpd Gym Jam Invitation',
      });
    } catch (err) {
      // Ignored
    }
  };

  const handleJoin = async () => {
    const clean = pinInput.trim().toUpperCase();
    if (!clean) {
      Alert.alert('Missing Code', 'Please enter the room code (e.g. PUMP-42 or 42).');
      return;
    }

    setIsJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await onJoinSession(clean);
    setIsJoining(false);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert(
        'Connection Failed',
        'Could not reach room. Make sure the host has the lobby open and your code is correct.'
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-black/85 justify-end"
      >
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[90%] shadow-2xl">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400 items-center justify-center">
                <Ionicons name="radio-outline" size={18} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-lg font-black text-white">Gym Jam Co-Op</Text>
                <Text className="text-[10px] font-semibold text-accent-cyan">
                  Real-Time Cloud Co-Op (Cross-Device)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-zinc-850 items-center justify-center border border-zinc-700"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mt-4">

            {/* Active Connected State Banner */}
            {connectionStatus === 'connected' ? (
              <View className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 mb-4 items-center">
                <View className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 items-center justify-center mb-2">
                  <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                </View>
                <Text className="text-base font-black text-white mb-0.5">
                  Lifting with {partnerName || 'Gym Partner'}
                </Text>
                <Text className="text-xs font-mono font-bold text-emerald-400">
                  Room: {roomPin} • Co-Op Session Active
                </Text>

                <View className="flex-row space-x-3 w-full mt-4">
                  <TouchableOpacity
                    onPress={onDisconnect}
                    className="flex-1 bg-zinc-900 border border-zinc-750 py-3 rounded-xl items-center"
                  >
                    <Text className="text-xs font-bold text-rose-400">Leave Jam</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onStartSession}
                    className="flex-1 bg-accent-cyan py-3 rounded-xl items-center shadow-lg shadow-cyan-500/20"
                  >
                    <Text className="text-xs font-black text-black">Start Co-Op</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Host / Join Tabs Switcher */}
                <View className="flex-row items-center bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl mb-4">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTab('host');
                      if (!roomPin) onHostSession();
                    }}
                    className={`flex-1 py-2.5 rounded-lg items-center ${
                      activeTab === 'host' ? 'bg-accent-cyan' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        activeTab === 'host' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      ⚡ Host a Jam
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTab('join');
                    }}
                    className={`flex-1 py-2.5 rounded-lg items-center ${
                      activeTab === 'join' ? 'bg-accent-cyan' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        activeTab === 'join' ? 'text-black' : 'text-zinc-400'
                      }`}
                    >
                      🔗 Join Partner
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* TAB 1: HOST SESSION */}
                {activeTab === 'host' && (
                  <View className="items-center bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 mb-3">
                    <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                      Scan QR or Enter Code on Partner Device
                    </Text>

                    {/* QR Code Graphic */}
                    {roomPin ? (
                      <View className="my-2 p-3 bg-white rounded-2xl shadow-xl">
                        <QRCodeView value={roomPin} size={170} />
                      </View>
                    ) : (
                      <View className="w-44 h-44 bg-zinc-900 rounded-2xl items-center justify-center my-2">
                        <Text className="text-xs text-zinc-500">Generating PIN...</Text>
                      </View>
                    )}

                    {/* Short Room PIN Display */}
                    <View className="flex-row items-center space-x-2 my-2 bg-zinc-900 border border-zinc-700 px-4 py-2 rounded-xl">
                      <Text className="text-2xl font-mono font-black text-accent-cyan tracking-widest">
                        {roomPin || 'PUMP-..'}
                      </Text>
                      <TouchableOpacity
                        onPress={handleSharePin}
                        className="bg-cyan-500/20 p-2 rounded-lg"
                      >
                        <Ionicons name="share-social-outline" size={16} color="#06B6D4" />
                      </TouchableOpacity>
                    </View>

                    {/* Connection Status Pill */}
                    <View className="flex-row items-center space-x-2 mt-2">
                      <View className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      <Text className="text-xs font-medium text-zinc-400">
                        Waiting for partner to scan or connect...
                      </Text>
                    </View>
                  </View>
                )}

                {/* TAB 2: JOIN SESSION */}
                {activeTab === 'join' && (
                  <View className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 mb-3">
                    <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
                      Enter Host's Room Code
                    </Text>

                    <TextInput
                      value={pinInput}
                      onChangeText={(val) => setPinInput(val.toUpperCase())}
                      placeholder="PUMP-42 or 42"
                      placeholderTextColor="#52525B"
                      autoCapitalize="characters"
                      className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-2xl font-mono font-black text-accent-cyan text-center mb-4 tracking-widest"
                    />

                    <TouchableOpacity
                      disabled={isJoining}
                      onPress={handleJoin}
                      className="bg-accent-cyan py-3.5 rounded-xl items-center justify-center flex-row space-x-2 shadow-lg shadow-cyan-500/20"
                    >
                      <Ionicons name="link" size={18} color="#09090B" />
                      <Text className="text-sm font-black text-black">
                        {isJoining ? 'Connecting to Jam...' : 'Join Gym Jam'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Protocol Explanation Footer */}
            <View className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-850 my-2">
              <Text className="text-[11px] text-zinc-400 leading-relaxed">
                💡 <Text className="font-bold text-zinc-300">Cloud Real-Time Co-Op:</Text>{' '}
                Both lifters take turns performing sets, synchronize rest timers, and advance exercises
                together across devices in real time.
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
