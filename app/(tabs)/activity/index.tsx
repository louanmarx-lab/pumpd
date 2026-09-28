import React from 'react';
import { Redirect } from 'expo-router';
import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';

export default function ActivityScreen() {
  const { userRole } = useUserWorkspace();
  if (userRole === 'coach') {
    return <Redirect href="/(tabs)/clients" />;
  }
  return <Redirect href="/(tabs)/workouts" />;
}
