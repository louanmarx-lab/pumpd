import 'react-native-get-random-values';
import React from 'react';
import { Stack } from 'expo-router';
export { ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { UserWorkspaceProvider } from '../src/context/UserWorkspaceContext';
import '../global.css';

// Cap system accessibility font scaling globally at 1.15x so small screens don't suffer text overlap or container blowouts
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.15;

if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.15;

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
          name="client-detail/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </UserWorkspaceProvider>
  );
}
