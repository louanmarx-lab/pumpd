import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUserWorkspace } from '../../src/context/UserWorkspaceContext';

/**
 * ClientDetailScreen has been completely retired in favor of direct
 * Athlete Mode ("Manage as Athlete") where the coach views the athlete's
 * real workout tabs, nutrition logs, and workout history directly.
 *
 * Any inbound navigation automatically activates the client's athlete session
 * and routes straight into the Workouts tab.
 */
export default function ClientDetailRedirectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { clients, startManagingClient } = useUserWorkspace();

  useEffect(() => {
    if (id) {
      const client = clients.find((c) => c.id === id);
      if (client) {
        startManagingClient(client);
      }
    }
    router.replace('/(tabs)/workouts');
  }, [id, clients]);

  return (
    <View className="flex-1 bg-dark-bg items-center justify-center">
      <ActivityIndicator size="large" color="#06B6D4" />
    </View>
  );
}
