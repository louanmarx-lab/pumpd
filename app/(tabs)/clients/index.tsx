import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientRosterView } from '../../../src/components/coach/ClientRosterView';
import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';

export default function ClientsScreen() {
  const router = useRouter();
  const { userRole, managedClient, isViewingPersonalProfile } = useUserWorkspace();

  useEffect(() => {
    if (userRole === 'athlete' && !managedClient && !isViewingPersonalProfile) {
      router.replace('/(tabs)/workouts');
    }
  }, [userRole, managedClient, isViewingPersonalProfile]);

  return (
    <View className="flex-1 bg-dark-bg">
      <ClientRosterView />
    </View>
  );
}
