import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useUserWorkspace } from '../../../src/context/UserWorkspaceContext';
import { formatDuration } from '../../../src/hooks/useWorkoutTimer';

export default function ActivityScreen() {
  const router = useRouter();
  const { clients, workoutLogs } = useUserWorkspace();

  // Filter logs for clients or all non-coach logs
  const totalClientsCount = clients.length;
  const clientIds = clients.map((c) => c.id);

  // Recent client sessions
  const clientLogs = workoutLogs
    .filter((log) => clientIds.includes(log.userId) || log.userId !== 'user_alex')
    .slice(0, 15);

  const handleLaunchSession = (clientId: string, clientName: string, routineTitle?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/active-session',
      params: {
        routineTitle: routineTitle || `${clientName}'s Training`,
        clientId,
        clientName,
      },
    });
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="bg-dark-card border-b border-dark-border px-4 py-3">
        <Text className="text-white font-extrabold text-base">Client Activity & Compliance</Text>
        <Text className="text-zinc-400 text-xs">Live training feed & athlete adherence</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Metric Summary Cards */}
        <View className="flex-row space-x-2.5 mb-4">
          <View className="flex-1 bg-dark-card border border-dark-border rounded-2xl p-3.5 shadow-md">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">Roster</Text>
              <Ionicons name="people" size={14} color="#06B6D4" />
            </View>
            <Text className="text-xl font-black text-white">{totalClientsCount}</Text>
            <Text className="text-[10px] text-cyan-400 font-semibold mt-0.5">Active Athletes</Text>
          </View>

          <View className="flex-1 bg-dark-card border border-dark-border rounded-2xl p-3.5 shadow-md">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">Compliance</Text>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            </View>
            <Text className="text-xl font-black text-emerald-400">92%</Text>
            <Text className="text-[10px] text-emerald-400 font-semibold mt-0.5">Weekly Target</Text>
          </View>

          <View className="flex-1 bg-dark-card border border-dark-border rounded-2xl p-3.5 shadow-md">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[10px] font-bold text-zinc-400 uppercase">Sessions</Text>
              <Ionicons name="barbell" size={14} color="#F59E0B" />
            </View>
            <Text className="text-xl font-black text-amber-400">{workoutLogs.length}</Text>
            <Text className="text-[10px] text-amber-400 font-semibold mt-0.5">Logged</Text>
          </View>
        </View>

        {/* Quick Launch Coaching Session Section */}
        <View className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md">
          <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
            <View className="flex-row items-center space-x-2">
              <Ionicons name="flash" size={16} color="#06B6D4" />
              <Text className="text-sm font-black text-white">Coach-as-Driver Quick Launch</Text>
            </View>
          </View>

          <Text className="text-xs text-zinc-400 mb-3 leading-relaxed">
            Start a live session for a client where you log sets and advance exercises hands-free on their behalf.
          </Text>

          {clients.length === 0 ? (
            <Text className="text-xs text-zinc-500 italic">Add clients to launch live sessions.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="space-x-2 pb-1">
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() =>
                    handleLaunchSession(c.id, c.name, c.assignedRoutineNames[0])
                  }
                  className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl items-center min-w-[120px]"
                >
                  <Text className="text-2xl mb-1">{c.avatarEmoji || '⚡'}</Text>
                  <Text className="text-xs font-bold text-white text-center" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text className="text-[9px] text-zinc-500 mb-2">
                    {c.assignedRoutineNames[0] || 'Custom Split'}
                  </Text>

                  <View className="bg-cyan-500/20 border border-cyan-400/50 px-2.5 py-1 rounded-lg">
                    <Text className="text-[10px] font-black text-cyan-300">Start Session</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Live Client Workout Feed */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
            Recent Client Workout Logs
          </Text>

          {clientLogs.length === 0 ? (
            <View className="bg-dark-card border border-dark-border rounded-2xl p-6 items-center">
              <Ionicons name="calendar-outline" size={32} color="#71717A" />
              <Text className="text-zinc-400 text-xs mt-2 text-center">
                No recent workout activity from clients yet. As clients log workouts or you coach live sessions, logs will appear here.
              </Text>
            </View>
          ) : (
            clientLogs.map((log) => {
              const matchedClient = clients.find((c) => c.id === log.userId);
              const athleteName = matchedClient ? matchedClient.name : 'Athlete';
              const avatar = matchedClient?.avatarEmoji || '💪';

              const completedSets = log.exercises.reduce(
                (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
                0
              );
              const totalVolume = log.exercises.reduce((acc, ex) => {
                return (
                  acc +
                  ex.sets
                    .filter((s) => s.isCompleted)
                    .reduce((sAcc, s) => sAcc + (s.weightKg || 0) * (s.reps || 0), 0)
                );
              }, 0);

              return (
                <View
                  key={log.id}
                  className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-3 shadow-md"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center space-x-2.5">
                      <Text className="text-2xl">{avatar}</Text>
                      <View>
                        <Text className="text-sm font-bold text-white">{athleteName}</Text>
                        <Text className="text-xs font-semibold text-accent-cyan">
                          {log.routineName}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-[10px] text-zinc-500 font-mono">{log.date}</Text>
                      {log.durationSeconds ? (
                        <Text className="text-[10px] text-zinc-400">
                          ⏱ {formatDuration(log.durationSeconds)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Summary Bar */}
                  <View className="flex-row items-center space-x-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 my-1">
                    <View className="flex-1 items-center">
                      <Text className="text-[9px] text-zinc-500 uppercase">Exercises</Text>
                      <Text className="text-xs font-bold text-zinc-200">
                        {log.exercises.length}
                      </Text>
                    </View>
                    <View className="w-px h-4 bg-zinc-800" />
                    <View className="flex-1 items-center">
                      <Text className="text-[9px] text-zinc-500 uppercase">Sets Done</Text>
                      <Text className="text-xs font-bold text-accent-emerald">
                        {completedSets}
                      </Text>
                    </View>
                    <View className="w-px h-4 bg-zinc-800" />
                    <View className="flex-1 items-center">
                      <Text className="text-[9px] text-zinc-500 uppercase">Volume</Text>
                      <Text className="text-xs font-bold text-amber-400">
                        {Math.round(totalVolume)} kg
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
