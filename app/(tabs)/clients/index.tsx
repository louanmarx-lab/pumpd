import React from 'react';
import { View } from 'react-native';
import { ClientRosterView } from '../../../src/components/coach/ClientRosterView';

export default function ClientsScreen() {
  return (
    <View className="flex-1 bg-dark-bg">
      <ClientRosterView />
    </View>
  );
}
