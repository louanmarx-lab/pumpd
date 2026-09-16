import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Share,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { QRCodeView } from '../QRCodeView';

interface ShareWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  shareCode: string | null;
  title: string;
  type: 'split' | 'routine';
  routinesCount?: number;
  exercisesCount?: number;
  isGenerating?: boolean;
}

export const ShareWorkoutModal: React.FC<ShareWorkoutModalProps> = ({
  visible,
  onClose,
  shareCode,
  title,
  type,
  routinesCount = 1,
  exercisesCount = 0,
  isGenerating = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleShareNative = async () => {
    if (!shareCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const shareTypeLabel = type === 'split' ? 'Workout Split' : 'Workout Routine';
    const message = `🏋️ Check out my ${shareTypeLabel} on Pumpd!\n\n"${title}"\n${
      type === 'split' ? `• ${routinesCount} Routines\n` : ''
    }• ${exercisesCount} Exercises\n\nTo copy this workout to your phone, open Pumpd, go to Workouts > Import Split, and enter code:\n👉 ${shareCode}`;

    try {
      await Share.share({
        message,
        title: `Pumpd ${shareTypeLabel} - ${title}`,
      });
    } catch (err) {
      console.warn('Native share failed:', err);
    }
  };

  const handleCopyCode = () => {
    if (!shareCode) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/85 justify-end">
        <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-6 max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-cyan-500/20 items-center justify-center">
                <Ionicons name="share-social" size={16} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-black text-white">
                  Share {type === 'split' ? 'Workout Split' : 'Routine'}
                </Text>
                <Text className="text-[11px] text-zinc-400" numberOfLines={1}>
                  {title}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            {isGenerating ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#06B6D4" />
                <Text className="text-xs font-bold text-zinc-400 mt-3">
                  Generating share code...
                </Text>
              </View>
            ) : shareCode ? (
              <>
                {/* QR Code Card for In-Person Gym Buddy Scan */}
                <View className="bg-white p-3 rounded-2xl shadow-xl mb-4 border border-zinc-200">
                  <QRCodeView value={shareCode} size={160} />
                </View>

                {/* Big Share Code Box */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCopyCode}
                  className="bg-zinc-900 border-2 border-cyan-500/60 rounded-2xl px-6 py-3 items-center mb-3 w-full shadow-lg shadow-cyan-500/10"
                >
                  <Text className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">
                    Share Code
                  </Text>
                  <Text className="text-3xl font-mono font-black text-white tracking-widest">
                    {shareCode}
                  </Text>
                  <View className="flex-row items-center space-x-1 mt-1">
                    <Ionicons
                      name={copied ? 'checkmark-circle' : 'copy-outline'}
                      size={12}
                      color={copied ? '#10B981' : '#71717A'}
                    />
                    <Text className={`text-[10px] font-bold ${copied ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {copied ? 'Copied to Clipboard!' : 'Tap to Copy Code'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Workout Details Summary Pill */}
                <View className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-2.5 flex-row items-center justify-between w-full mb-4">
                  <View>
                    <Text className="text-xs font-bold text-white" numberOfLines={1}>
                      {title}
                    </Text>
                    <Text className="text-[10px] text-zinc-400">
                      {type === 'split'
                        ? `${routinesCount} Routines • ${exercisesCount} Exercises`
                        : `${exercisesCount} Exercises`}
                    </Text>
                  </View>
                  <View className="bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-400/40">
                    <Text className="text-[9px] font-black text-cyan-400 uppercase">
                      {type === 'split' ? 'SPLIT' : 'ROUTINE'}
                    </Text>
                  </View>
                </View>

                {/* Native Share Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleShareNative}
                  className="bg-accent-cyan py-3.5 px-5 rounded-xl w-full flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 mb-2"
                >
                  <Ionicons name="paper-plane" size={16} color="#09090B" />
                  <Text className="text-black font-black text-sm">
                    Share via Messages / WhatsApp
                  </Text>
                </TouchableOpacity>

                <Text className="text-[11px] text-zinc-500 text-center mt-1 px-4 leading-relaxed">
                  💡 Your friend can import this workout instantly in Pumpd by going to{' '}
                  <Text className="text-zinc-300 font-bold">Workouts &gt; Import Split</Text>.
                </Text>
              </>
            ) : (
              <View className="py-8 items-center">
                <Text className="text-xs text-rose-400 font-bold">
                  Failed to generate share code. Check your internet connection.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
