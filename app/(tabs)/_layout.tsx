import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HeaderSwitcher } from '../../components/HeaderSwitcher';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserWorkspace } from '../../src/context/UserWorkspaceContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { userRole } = useUserWorkspace();
  // Safe bottom padding for Samsung 3-button navigation, gesture pill, and iOS home bar
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#09090B',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#18181B',
        },
        headerTintColor: '#F4F4F5',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
        headerRight: () => (
          <View style={{ marginRight: 12 }}>
            <HeaderSwitcher />
          </View>
        ),
        tabBarStyle: {
          backgroundColor: '#18181B',
          borderTopColor: '#27272A',
          borderTopWidth: 1,
          height: 56 + safeBottom,
          paddingBottom: safeBottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#06B6D4',
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* ATHLETE TABS */}
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          headerTitle: 'Pumpd',
          href: userRole === 'athlete' ? '/workouts' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          headerTitle: 'Macro Tracker',
          href: userRole === 'athlete' ? '/nutrition' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          headerTitle: 'Progress & Benchmarks',
          href: userRole === 'athlete' ? '/analytics' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />

      {/* COACH CRM TABS */}
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          headerTitle: 'Client Roster',
          href: userRole === 'coach' ? '/clients' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          headerTitle: 'Program Library',
          href: userRole === 'coach' ? '/programs' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meal-plans"
        options={{
          title: 'Meals',
          headerTitle: 'Meal Plans & Diets',
          href: userRole === 'coach' ? '/meal-plans' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          headerTitle: 'Client Activity Feed',
          href: userRole === 'coach' ? '/activity' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} />,
        }}
      />

      {/* SHARED SETTINGS TAB */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: userRole === 'coach' ? 'Coach Profile & Business' : 'Profile & Mode',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
