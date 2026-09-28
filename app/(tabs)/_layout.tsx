import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HeaderBackToRosterButton } from '../../src/components/coach/HeaderBackToRosterButton';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserWorkspace } from '../../src/context/UserWorkspaceContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { userRole, managedClient, isViewingPersonalProfile, accountType } = useUserWorkspace();
  // Safe bottom padding for Samsung 3-button navigation, gesture pill, and iOS home bar
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);

  const isManagingClient = managedClient !== null;
  const isCoachAccount = accountType === 'coach';

  // Strict deck switching:
  // When an athlete, managing a client, or coach in personal workout mode -> 4 Athlete tabs.
  // When coach is on Coach Hub -> 4 Coach tabs.
  const isAthleteDeck = userRole === 'athlete' || isManagingClient || isViewingPersonalProfile;
  const showAthleteTabs = isAthleteDeck;
  const showCoachTabs = isCoachAccount && !isAthleteDeck;

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
          fontSize: 17,
        },
        headerTitleAlign: 'center',
        headerLeft: () => <HeaderBackToRosterButton />,
        tabBarStyle: {
          backgroundColor: '#18181B',
          borderTopColor: '#27272A',
          borderTopWidth: 1,
          height: 56 + safeBottom,
          paddingBottom: safeBottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: isManagingClient ? '#F59E0B' : '#06B6D4',
        tabBarInactiveTintColor: '#71717A',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* ATHLETE TABS (Only 4 tabs visible when on athlete deck) */}
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          headerTitle: isManagingClient && managedClient
            ? `${managedClient.name.split(' ')[0]}'s Workouts`
            : isViewingPersonalProfile
            ? 'My Workouts'
            : 'Ripped',
          href: showAthleteTabs ? '/workouts' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          headerTitle: isManagingClient && managedClient
            ? `${managedClient.name.split(' ')[0]}'s Nutrition`
            : isViewingPersonalProfile
            ? 'My Nutrition'
            : 'Macro Tracker',
          href: showAthleteTabs ? '/nutrition' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="nutrition-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          headerTitle: isManagingClient && managedClient
            ? `${managedClient.name.split(' ')[0]}'s Progress`
            : isViewingPersonalProfile
            ? 'My Progress'
            : 'Progress',
          href: showAthleteTabs ? '/analytics' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />

      {/* COACH CRM TABS (Only visible when on Coach deck) */}
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          headerTitle: 'Clients',
          href: showCoachTabs ? '/clients' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          headerTitle: 'Programs',
          href: showCoachTabs ? '/programs' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meal-plans"
        options={{
          title: 'Meals',
          headerTitle: 'Meal Plans',
          href: showCoachTabs ? '/meal-plans' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
        }}
      />

      {/* SHARED SETTINGS TAB (Tab 4 on both decks) */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
