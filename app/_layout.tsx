import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UserWorkspaceProvider } from '../src/context/UserWorkspaceContext';
import '../global.css';

export default function RootLayout() {
  return (
    <UserWorkspaceProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#09090B' },
          headerTintColor: '#F4F4F5',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#09090B' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="active-session"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="create-split"
          options={{
            presentation: 'modal',
            title: 'Create Workout Split',
            headerStyle: { backgroundColor: '#18181B' },
          }}
        />
        <Stack.Screen
          name="add-exercise"
          options={{
            presentation: 'modal',
            title: 'Custom Exercise',
            headerStyle: { backgroundColor: '#18181B' },
          }}
        />
      </Stack>
    </UserWorkspaceProvider>
  );
}
