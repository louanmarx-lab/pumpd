import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useUserWorkspace } from '../../context/UserWorkspaceContext';
import {
  saveWorkoutLogCloud,
  saveNutritionLogCloud,
  saveBodyMetricCloud,
  saveCoachProfileCloud,
  saveClientsCloud,
  saveSplitsCloud,
} from '../../services/firestoreService';

interface DataBackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DataBackupRestoreModal: React.FC<DataBackupRestoreModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    activeUser,
    workoutLogs,
    nutritionLogs,
    bodyMetrics,
    splits,
    coachProfile,
    clients,
    prescribedArchetypes,
    syncAllToCloud,
  } = useUserWorkspace();

  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [importJsonText, setImportJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate Backup JSON
  const backupPayload = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: {
        id: activeUser.id,
        displayName: activeUser.displayName,
        email: activeUser.email,
        macroTargets: activeUser.macroTargets,
      },
      coachProfile,
      clients,
      prescribedArchetypes,
      splits: splits.filter((s) => s.userId === activeUser.id),
      workoutLogs: workoutLogs.filter((l) => l.userId === activeUser.id),
      nutritionLogs: nutritionLogs.filter((n) => n.userId === activeUser.id),
      bodyMetrics: bodyMetrics.filter((m) => m.userId === activeUser.id),
    },
    null,
    2
  );

  const handleShareBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: `RIPPED Backup - ${activeUser.displayName}`,
        message: backupPayload,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleImportBackup = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Empty Input', 'Please paste valid JSON data to restore.');
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const parsed = JSON.parse(importJsonText.trim());

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure.');
      }

      let importedWorkoutsCount = 0;
      let importedMetricsCount = 0;
      let importedNutritionCount = 0;

      // 1. Restore Workouts to Cloud Firestore
      if (Array.isArray(parsed.workoutLogs)) {
        for (const log of parsed.workoutLogs) {
          if (log.id && log.exercises) {
            await saveWorkoutLogCloud(activeUser.id, {
              ...log,
              userId: activeUser.id,
            });
            importedWorkoutsCount++;
          }
        }
      }

      // 2. Restore Body Metrics
      if (Array.isArray(parsed.bodyMetrics)) {
        for (const metric of parsed.bodyMetrics) {
          if (metric.id && metric.weightKg) {
            await saveBodyMetricCloud(activeUser.id, {
              ...metric,
              userId: activeUser.id,
            });
            importedMetricsCount++;
          }
        }
      }

      // 3. Restore Nutrition Logs
      if (Array.isArray(parsed.nutritionLogs)) {
        for (const nLog of parsed.nutritionLogs) {
          if (nLog.date && Array.isArray(nLog.meals)) {
            await saveNutritionLogCloud(activeUser.id, {
              ...nLog,
              userId: activeUser.id,
            });
            importedNutritionCount++;
          }
        }
      }

      // 4. Restore Coach Profile & Clients
      if (parsed.coachProfile) {
        await saveCoachProfileCloud(activeUser.id, parsed.coachProfile);
      }
      if (Array.isArray(parsed.clients)) {
        await saveClientsCloud(activeUser.id, parsed.clients);
      }
      if (Array.isArray(parsed.splits)) {
        await saveSplitsCloud(activeUser.id, parsed.splits);
      }

      // Trigger full cloud and context sync
      await syncAllToCloud();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Restore Complete! 🎉',
        `Successfully restored:\n• ${importedWorkoutsCount} Workouts\n• ${importedMetricsCount} Weigh-Ins\n• ${importedNutritionCount} Nutrition Logs\n\nAll data is preserved and backed up to Cloud Firestore.`
      );
      setImportJsonText('');
      onClose();
    } catch (err: any) {
      console.warn('Import error:', err);
      Alert.alert(
        'Import Failed',
        'Could not parse backup JSON. Please ensure you copied the complete JSON text without missing brackets.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/85 justify-end"
      >
        <View className="bg-dark-card border-t border-dark-border rounded-t-3xl p-5 max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800">
            <View className="flex-row items-center space-x-2">
              <View className="w-8 h-8 rounded-xl bg-purple-500/20 items-center justify-center border border-purple-500/40">
                <Ionicons name="archive-outline" size={18} color="#A855F7" />
              </View>
              <View>
                <Text className="text-base font-bold text-white">Data Backup & Restore</Text>
                <Text className="text-[11px] text-zinc-400">Never lose your workouts across APK updates</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 bg-zinc-850 rounded-full items-center justify-center border border-zinc-750"
            >
              <Ionicons name="close" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* Mode Selector */}
          <View className="flex-row bg-zinc-900 p-1 rounded-xl my-4 border border-zinc-800">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('export');
              }}
              className={`flex-1 py-2 items-center rounded-lg ${
                mode === 'export' ? 'bg-accent-cyan' : ''
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  mode === 'export' ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Export JSON
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('import');
              }}
              className={`flex-1 py-2 items-center rounded-lg ${
                mode === 'import' ? 'bg-accent-cyan' : ''
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  mode === 'import' ? 'text-black' : 'text-zinc-400'
                }`}
              >
                Import JSON
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {mode === 'export' ? (
              <View>
                <Text className="text-xs text-zinc-300 mb-2 font-medium">
                  Export all your logs from this app to a shareable text file or clipboard.
                </Text>

                <View className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-4 max-h-48">
                  <ScrollView nestedScrollEnabled>
                    <Text className="text-[10px] text-zinc-400 font-mono">
                      {backupPayload}
                    </Text>
                  </ScrollView>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleShareBackup}
                  className="bg-accent-cyan p-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="share-outline" size={18} color="#09090B" />
                  <Text className="text-black font-extrabold text-sm">
                    Copy or Share Backup JSON
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-xs text-zinc-300 mb-2 font-medium">
                  Paste your backup JSON below to restore all previous workouts, weigh-ins, and nutrition logs into this APK build.
                </Text>

                <TextInput
                  multiline
                  value={importJsonText}
                  onChangeText={setImportJsonText}
                  placeholder='Paste JSON here: {"version":1, "workoutLogs":[...]}'
                  placeholderTextColor="#71717A"
                  className="bg-zinc-950 border border-zinc-800 text-white p-3 rounded-xl font-mono text-xs h-40 mb-4 text-top"
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleImportBackup}
                  disabled={isProcessing}
                  className="bg-accent-cyan p-3.5 rounded-xl flex-row items-center justify-center space-x-2 shadow-md shadow-cyan-500/20"
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#09090B" />
                  <Text className="text-black font-extrabold text-sm">
                    {isProcessing ? 'Restoring Data...' : 'Restore Data from JSON'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
export default DataBackupRestoreModal;
