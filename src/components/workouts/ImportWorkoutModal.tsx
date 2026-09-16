import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchSharedSplitCloud, SharedSplitPayload } from '../../services/shareSplitService';
import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import { Split, Exercise } from '../../types';

interface ImportWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (importedSplit: Split) => void;
}

export const ImportWorkoutModal: React.FC<ImportWorkoutModalProps> = ({
  visible,
  onClose,
  onImportSuccess,
}) => {
  const { activeUser, activeWorkspace, exercises, addExercise, addSplit, updateSplit } = useUserWorkspace();

  const [codeInput, setCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<SharedSplitPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setCodeInput('');
    setIsLoading(false);
    setPreviewPayload(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFetchWorkout = async () => {
    if (!codeInput.trim()) {
      setErrorMessage('Please enter a share code.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    setErrorMessage(null);
    setPreviewPayload(null);

    try {
      const result = await fetchSharedSplitCloud(codeInput);
      if (result) {
        setPreviewPayload(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setErrorMessage('Workout not found. Please check the code and try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.warn('Failed to fetch shared workout:', err);
      setErrorMessage('Network error fetching workout. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Identify missing exercises that need to be added to user's library
  const missingExercises = React.useMemo(() => {
    if (!previewPayload) return [];
    const missing: { id: string; name: string; muscleGroup: any; equipment: string }[] = [];

    const existingNames = new Set(exercises.map((e) => e.name.toLowerCase()));
    const existingIds = new Set(exercises.map((e) => e.id));

    previewPayload.routines.forEach((r) => {
      (r.exercises || []).forEach((ex) => {
        if (!existingIds.has(ex.id) && !existingNames.has(ex.name.toLowerCase())) {
          missing.push(ex);
          existingNames.add(ex.name.toLowerCase());
        }
      });
    });

    return missing;
  }, [previewPayload, exercises]);

  const handleConfirmImport = async () => {
    if (!previewPayload) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1. Auto-register any missing custom exercises into user's library
    const exerciseIdMap: Record<string, string> = {};

    for (const r of previewPayload.routines) {
      for (const ex of r.exercises || []) {
        const found = exercises.find(
          (e) => e.id === ex.id || e.name.toLowerCase() === ex.name.toLowerCase()
        );
        if (found) {
          exerciseIdMap[ex.id] = found.id;
        } else {
          // Register missing exercise
          const createdEx = addExercise({
            workspaceId: activeWorkspace?.id || 'ws_default',
            name: ex.name,
            muscleGroup: ex.muscleGroup || 'Chest',
            equipment: ex.equipment || 'Barbell',
          });
          exerciseIdMap[ex.id] = createdEx.id;
        }
      }
    }

    // 2. Construct the new Split
    const newSplitId = `split_imported_${Date.now()}`;
    const newRoutines = previewPayload.routines.map((r, rIdx) => ({
      id: `rt_imported_${Date.now()}_${rIdx}`,
      name: r.name,
      exerciseIds: (r.exerciseIds || []).map((id) => exerciseIdMap[id] || id),
    }));

    const importedSplit: Split = {
      id: newSplitId,
      userId: activeUser.id,
      name: `${previewPayload.splitName} (Imported)`,
      description:
        previewPayload.description ||
        `Shared by ${previewPayload.authorName} (${new Date().toLocaleDateString()})`,
      routines: newRoutines,
      isActive: false,
    };

    // Save to user workspace
    addSplit(importedSplit);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 3. Prompt to set as active split
    Alert.alert(
      'Workout Imported! 🏋️',
      `"${importedSplit.name}" with ${newRoutines.length} routine(s) has been added to your workouts. Would you like to set it as your active split?`,
      [
        {
          text: 'Keep Current Split',
          style: 'cancel',
          onPress: () => {
            onImportSuccess?.(importedSplit);
            handleClose();
          },
        },
        {
          text: 'Set as Active',
          onPress: () => {
            updateSplit({ ...importedSplit, isActive: true });
            onImportSuccess?.(importedSplit);
            handleClose();
          },
        },
      ]
    );
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
        className="flex-1 bg-black/85 justify-end"
      >
        <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-6 max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-full bg-cyan-500/20 items-center justify-center">
                <Ionicons name="download-outline" size={16} color="#06B6D4" />
              </View>
              <View>
                <Text className="text-base font-black text-white">Import Workout / Split</Text>
                <Text className="text-[11px] text-zinc-400">
                  Enter a share code or paste from your friend
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Code Input Field */}
            <View className="mb-3">
              <Text className="text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Workout Share Code
              </Text>
              <View className="flex-row space-x-2">
                <TextInput
                  value={codeInput}
                  onChangeText={(val) => {
                    setCodeInput(val.toUpperCase());
                    setErrorMessage(null);
                  }}
                  placeholder="e.g. SPLIT-8492 or 8492"
                  placeholderTextColor="#71717A"
                  autoCapitalize="characters"
                  className="flex-1 bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl font-mono text-base font-bold tracking-widest text-center"
                />
                <TouchableOpacity
                  disabled={isLoading || !codeInput.trim()}
                  onPress={handleFetchWorkout}
                  className={`px-5 rounded-xl items-center justify-center ${
                    !codeInput.trim() || isLoading ? 'bg-zinc-800' : 'bg-accent-cyan'
                  }`}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#09090B" />
                  ) : (
                    <Text
                      className={`text-xs font-black ${
                        !codeInput.trim() ? 'text-zinc-500' : 'text-black'
                      }`}
                    >
                      Find
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl mb-4 flex-row items-center space-x-2">
                <Ionicons name="alert-circle" size={16} color="#FB7185" />
                <Text className="text-xs text-rose-300 flex-1 font-semibold">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Workout Preview Card */}
            {previewPayload && (
              <View className="bg-zinc-900/90 border-2 border-cyan-500/50 rounded-2xl p-4 mb-4 shadow-lg shadow-cyan-500/10">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-400/40">
                    <Text className="text-[9px] font-black text-cyan-400 uppercase">
                      {previewPayload.type === 'split' ? 'SPLIT FOUND' : 'ROUTINE FOUND'}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-zinc-400">
                    Shared by <Text className="font-bold text-white">{previewPayload.authorName}</Text>
                  </Text>
                </View>

                <Text className="text-lg font-black text-white mb-1">
                  {previewPayload.splitName}
                </Text>
                {previewPayload.description ? (
                  <Text className="text-xs text-zinc-400 mb-3">
                    {previewPayload.description}
                  </Text>
                ) : null}

                {/* Routines & Exercises Breakdown */}
                <View className="border-t border-zinc-800 pt-2.5 mb-3">
                  <Text className="text-[10px] font-bold text-zinc-500 uppercase mb-2">
                    Included Routines ({previewPayload.routines.length}):
                  </Text>
                  {previewPayload.routines.map((r, idx) => (
                    <View
                      key={r.id || idx}
                      className="bg-zinc-950/70 border border-zinc-800/80 p-2.5 rounded-xl mb-1.5"
                    >
                      <Text className="text-xs font-bold text-cyan-300">{r.name}</Text>
                      <Text className="text-[10px] text-zinc-400 mt-0.5">
                        {r.exercises?.length
                          ? r.exercises.map((e) => e.name).join(', ')
                          : `${r.exerciseIds.length} exercises`}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Missing Custom Exercises Notice */}
                {missingExercises.length > 0 && (
                  <View className="bg-emerald-950/30 border border-emerald-500/40 p-2.5 rounded-xl mb-3 flex-row items-center space-x-2">
                    <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                    <Text className="text-[11px] text-emerald-300 flex-1">
                      <Text className="font-bold">{missingExercises.length} custom exercise(s)</Text>{' '}
                      will be automatically added to your exercise library.
                    </Text>
                  </View>
                )}

                {/* Confirm Import Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmImport}
                  className="bg-accent-cyan py-3.5 rounded-xl items-center flex-row justify-center space-x-2 shadow-lg shadow-cyan-500/20 mt-1"
                >
                  <Ionicons name="download" size={16} color="#09090B" />
                  <Text className="text-black font-black text-sm">
                    Import to My Workouts
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!previewPayload && !isLoading && (
              <View className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-850 mt-2">
                <Text className="text-[11px] text-zinc-400 leading-relaxed text-center">
                  💡 Have a friend share their split code with you (e.g. <Text className="font-mono text-cyan-400">SPLIT-42</Text>) or scan their in-person QR code in the gym.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
