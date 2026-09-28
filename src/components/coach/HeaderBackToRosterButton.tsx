import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUserWorkspace } from '../../context/UserWorkspaceContext';

/**
 * Compact Top Header Navigation Pill
 * Replaces the full-width screen banner with an integrated native-style back chip.
 * Takes 0 screen height from the body.
 */
export const HeaderBackToRosterButton: React.FC = () => {
  const router = useRouter();
  const {
    managedClient,
    stopManagingClient,
    isViewingPersonalProfile,
    exitPersonalAthleteMode,
    accountType,
    userRole,
    setUserRole,
  } = useUserWorkspace();

  // Show the back button whenever a coach is viewing athlete-style screens
  const isCoachAccount = accountType === 'coach';
  const isOnAthleteTabs = managedClient !== null || isViewingPersonalProfile || (isCoachAccount && userRole === 'athlete');

  if (!isOnAthleteTabs) {
    return null;
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (managedClient) {
      stopManagingClient();
    }
    exitPersonalAthleteMode();
    setUserRole('coach');
    router.replace('/(tabs)/clients' as any);
  };

  const isClientMode = Boolean(managedClient);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      style={{ marginLeft: 12 }}
      className={`flex-row items-center space-x-1 px-2.5 py-1.5 rounded-full border ${
        isClientMode
          ? 'bg-amber-500/15 border-amber-500/40'
          : 'bg-cyan-500/15 border-cyan-500/40'
      }`}
    >
      <Ionicons
        name="chevron-back"
        size={14}
        color={isClientMode ? '#F59E0B' : '#06B6D4'}
      />
      <Text
        className={`text-xs font-black tracking-wide ${
          isClientMode ? 'text-amber-400' : 'text-cyan-400'
        }`}
      >
        Clients
      </Text>
    </TouchableOpacity>
  );
};
