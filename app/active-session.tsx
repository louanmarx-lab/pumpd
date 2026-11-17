import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserWorkspace } from '../src/context/UserWorkspaceContext';
import { SetType, SetLog, LoggedExercise, Exercise, MuscleGroup } from '../src/types';
import { calculate1RM, getExerciseHistory } from '../src/utils/fitness';
import { useGymJam } from '../src/hooks/useGymJam';
import { TrainTogetherModal } from '../src/components/workouts/TrainTogetherModal';
import { GymJamLobbyModal } from '../src/components/GymJamLobbyModal';
import { WorkoutReceiptModal } from '../src/components/WorkoutReceiptModal';
import { WorkoutReceiptData, SessionExerciseTemplate } from '../src/types/gymjam';
import { useWorkoutTimer, formatDuration } from '../src/hooks/useWorkoutTimer';

import { formatLocalDate } from '../src/utils/localDate';
import {
  clearWorkoutDraft, completedWorkoutExercises, DraftSet, loadWorkoutDraft, parseSetReps, parseSetWeight,
  saveWorkoutDraft, WorkoutDraft, workoutDraftKey,
} from '../src/utils/workoutDraft';

const KG_PER_LB = 0.45359237;

const SET_TYPES: SetType[] = ['Normal', 'Warmup', 'Drop', 'Failure'];
const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Calves',
  'Abs',
];

export default function ActiveSessionScreen() {
  const { currentUser, activeUser, isAuthReady, isHydrated, managedClient } = useUserWorkspace();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const key = workoutDraftKey(currentUser.id, clientId || managedClient?.id || activeUser.id);
  const scope = useRef<string | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; draft: WorkoutDraft | null } | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    scope.current ??= key;
    if (scope.current !== key) return;
    void loadWorkoutDraft(key).then((draft) => {
      if (!cancelled) setLoaded({ key, draft });
    }).catch(() => {
      if (!cancelled) setLoaded({ key, draft: null });
    });
    return () => { cancelled = true; };
  }, [isHydrated, key]);

  if (isAuthReady && (!isHydrated || (scope.current && scope.current !== key))) return <Redirect href="/" />;
  if (!isHydrated || loaded?.key !== key) {
    return <View className="flex-1 items-center justify-center bg-dark-bg"><ActivityIndicator color="#06B6D4" /></View>;
  }
  return <ActiveSession draft={loaded.draft} draftKey={key} />;
}

function ActiveSession({ draft, draftKey }: { draft: WorkoutDraft | null; draftKey: string }) {
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    splitId?: string;
    routineId?: string;
    routineName?: string;
    routineTitle?: string;
    exerciseIds?: string;
    clientId?: string;
    clientName?: string;
    startedAt?: string;
    joinRoomPin?: string;
    togetherMode?: 'phone' | 'separate';
  }>();

  const {
    currentUser,
    activeUser: workspaceLifter,
    partnerUser,
    managedClient,
    linkPartnerUser,
    activeWorkspace,
    userRole,
    coachProfile,
    linkedCoach,
    clients,
    exercises,
    workoutLogs,
    saveWorkoutLog,
    logClientWorkout,
    addExercise,
  } = useUserWorkspace();
  const [activeUser] = useState(workspaceLifter);
  const sessionSplitId = draft?.splitId ?? params.splitId;
  const sessionRoutineId = draft?.routineId ?? params.routineId;

  const activeClient = params.clientId ? clients.find((c) => c.id === params.clientId) : null;
  const routineTitle =
    params.routineTitle ||
    params.routineName ||
    (params.clientName
      ? `${params.clientName}'s Training`
      : activeClient
      ? `${activeClient.name}'s Training`
      : 'Gym Workout Session');
  const [initialIds] = useState<string[]>(() => {
    if (draft) return draft.exerciseIds;
    try {
      const parsed = JSON.parse(params.exerciseIds || '[]');
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
    } catch { return []; }
  });

  const insets = useSafeAreaInsets();

  const [sessionExerciseIds, setSessionExerciseIds] = useState<string[]>(initialIds);
  const [currentRoutineTitle, setCurrentRoutineTitle] = useState<string>(draft?.title || routineTitle);
  const canAddLocalBuddy = !params.clientId && !managedClient && activeUser.id === currentUser.id;
  const [buddyId, setBuddyId] = useState(draft?.buddy?.id);
  const localBuddy = canAddLocalBuddy && buddyId === partnerUser?.id ? partnerUser : null;
  const [showLocalBuddy, setShowLocalBuddy] = useState(false);
  const [buddyName, setBuddyName] = useState('');
  const [buddyError, setBuddyError] = useState('');
  const [isAddingBuddy, setIsAddingBuddy] = useState(false);
  const addingBuddy = useRef(false);
  const [viewingLifterId, setViewingLifterId] = useState<string>(activeUser.id);
  const [partnerBenchmarks, setPartnerBenchmarks] = useState<
    Record<
      string,
      {
        bestWorkingSet?: { weightKg: number; reps: number; date?: string };
        maxRepsAtWeight: number;
        estimated1RM: number;
      }
    >
  >({});

  // Helper to build initial exercises for a specific user using their own benchmark history
  const buildInitialExercisesForUser = (
    userId: string,
    ids: string[] = sessionExerciseIds,
    templateExercises?: SessionExerciseTemplate[]
  ): LoggedExercise[] => {
    // When coaching a client, prioritize client's workout logs to populate ghosted weights & reps
    const targetClientId = params.clientId;
    const targetLinkedUserId = activeClient?.linkedUserId;
    const clientLogs = targetClientId
      ? workoutLogs.filter(
          (l) =>
            l.userId === targetClientId ||
            (targetLinkedUserId && l.userId === targetLinkedUserId)
        )
      : [];
    const userLogs =
      clientLogs.length > 0
        ? clientLogs
        : workoutLogs.filter((l) => l.userId === userId);

    return ids.map((id) => {
      const exDef = exercises.find((e) => e.id === id);
      const history = getExerciseHistory(userLogs, id);

      let defaultSets: SetLog[] = [];

      // If a synchronized session template is provided, match its exact set structure
      if (templateExercises && templateExercises.length > 0) {
        const tpl = templateExercises.find((t) => t.exerciseId === id);
        if (tpl && tpl.sets && tpl.sets.length > 0) {
          defaultSets = tpl.sets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type || 'Normal',
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
        }
      }

      // If no template matched, initialize using history, guaranteeing minimum 3 sets
      if (defaultSets.length === 0) {
        if (history.previousSessionSets && history.previousSessionSets.length >= 3) {
          defaultSets = history.previousSessionSets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type,
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
        } else if (history.previousSessionSets && history.previousSessionSets.length > 0) {
          defaultSets = history.previousSessionSets.map((s, idx) => ({
            setNumber: idx + 1,
            type: s.type,
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          }));
          while (defaultSets.length < 3) {
            defaultSets.push({
              setNumber: defaultSets.length + 1,
              type: 'Normal',
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            });
          }
        } else {
          defaultSets = [
            { setNumber: 1, type: 'Warmup', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 2, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 3, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
          ];
        }
      }

      return {
        exerciseId: id,
        exerciseName: exDef ? exDef.name : 'Exercise',
        sets: defaultSets,
      };
    });
  };

  // Independent workout session state per user: { [userId]: LoggedExercise[] }
  const [userExercisesMap, setUserExercisesMap] = useState<Record<string, LoggedExercise[]>>(() => ({
    [activeUser.id]: draft?.exercises ?? buildInitialExercisesForUser(activeUser.id, initialIds),
    ...(draft?.buddy && localBuddy ? { [localBuddy.id]: draft.buddy.exercises } : {}),
  }));
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [expandedBests, setExpandedBests] = useState<Record<string, boolean>>({});
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);

  // Add Exercise & Create Custom Exercise state
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showCreateExerciseModal, setShowCreateExerciseModal] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState<MuscleGroup>('Chest');
  const [newExEquipment, setNewExEquipment] = useState('Barbell');

  const [sessionStartedAt] = useState(() => draft?.startedAt || Number(params.startedAt) || Date.now());
  const [isFinishing, setIsFinishing] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [setNotice, setSetNotice] = useState<string | null>(null);
  const closed = useRef(false);
  const finishInProgress = useRef(false);
  const draftWrites = useRef(Promise.resolve());
  const draftRevision = useRef(0);
  const [draftSaveState, setDraftSaveState] = useState<'saving' | 'saved' | 'error'>('saving');
  const workoutTimer = useWorkoutTimer({
    autoStart: true,
    initialAccumulatedTime: draft?.elapsedSeconds || 0,
    sessionId: sessionStartedAt,
    storageKey: `${draftKey}_timer_${sessionStartedAt}`,
  });
  const secondsElapsed = workoutTimer.elapsedSeconds;
  const isTimerRunning = workoutTimer.isRunning;
  const { togglePauseResume: toggleWorkoutTimer, stop: stopWorkoutTimer, pause: pauseWorkoutTimer } = workoutTimer;

  const persistDraft = (elapsedSeconds: number) => {
    if (closed.current) return draftWrites.current;
    const snapshot: WorkoutDraft = {
      startedAt: sessionStartedAt,
      title: currentRoutineTitle,
      splitId: sessionSplitId,
      routineId: sessionRoutineId,
      exerciseIds: sessionExerciseIds,
      lifterId: activeUser.id,
      exercises: userExercisesMap[activeUser.id] || [],
      elapsedSeconds,
      buddy: localBuddy ? { id: localBuddy.id, exercises: userExercisesMap[localBuddy.id] || [] } : undefined,
    };
    const revision = ++draftRevision.current;
    setDraftSaveState('saving');
    draftWrites.current = draftWrites.current.catch(() => {}).then(() => saveWorkoutDraft(draftKey, snapshot));
    void draftWrites.current.then(() => {
      if (revision === draftRevision.current) setDraftSaveState('saved');
    }, () => {
      if (revision === draftRevision.current) setDraftSaveState('error');
    });
    return draftWrites.current;
  };

  useEffect(() => {
    void persistDraft(secondsElapsed).catch(() => {});
  }, [sessionExerciseIds, currentRoutineTitle, userExercisesMap, isTimerRunning, localBuddy?.id]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/workouts');
  };

  const exitWithDraft = async (discard: boolean) => {
    try {
      if (discard) {
        closed.current = true;
        await draftWrites.current.catch(() => {});
        await clearWorkoutDraft(draftKey);
        stopWorkoutTimer();
      } else {
        pauseWorkoutTimer();
        await persistDraft(secondsElapsed);
      }
      leave();
    } catch {
      closed.current = false;
      setSetNotice('Could not save the workout. Please try again before leaving.');
    }
  };

  const handleExitWorkout = () => {
    if (!finishInProgress.current) setShowExit(true);
  };

  const weightUnit = activeUser.weightUnit || 'kg';
  const fromKg = (kg: number) => weightUnit === 'lbs' ? Number((kg / KG_PER_LB).toFixed(2)) : kg;

  // Gym Jam P2P State & Handlers
  const [showGymJamLobby, setShowGymJamLobby] = useState(false);
  const [showTogether, setShowTogether] = useState(false);
  const openedTogether = useRef(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);
  const [partnerLatestSet, setPartnerLatestSet] = useState<{
    exerciseName?: string;
    setIndex: number;
    weight: number;
    reps: number;
    rpe?: number;
  } | null>(null);

  // Workout Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receipts, setReceipts] = useState<WorkoutReceiptData[]>([]);
  const handleFinishWorkoutRef = useRef<((isRemote?: boolean, remoteName?: string) => void) | null>(null);

  const gymJam = useGymJam({
    currentUserId: activeUser.id,
    currentUserName: activeUser.displayName,
    userRole,
    onSyncSessionReceived: (msg) => {
      // Synchronize routine title and exercises if guest
      if (msg.routineName) {
        setCurrentRoutineTitle(msg.routineName);
      }
      if (msg.exerciseIds && msg.exerciseIds.length > 0) {
        setSessionExerciseIds(msg.exerciseIds);
        setUserExercisesMap((prev) => {
          const next = { ...prev };
          const guestExercises = buildInitialExercisesForUser(
            activeUser.id,
            msg.exerciseIds,
            msg.sessionExercises
          );
          next[activeUser.id] = guestExercises;

          // Partner is host: mirror exact template sets for host
          const hostId = gymJam.partnerUserId || 'host';
          next[hostId] = guestExercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: ex.sets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          }));
          return next;
        });
      }
    },
    onPartnerLoggedSet: (msg) => {
      const exDef = exercises.find((e) => e.id === msg.exerciseId);
      setPartnerLatestSet({
        exerciseName: exDef ? exDef.name : undefined,
        setIndex: msg.setIndex,
        weight: msg.weight,
        reps: msg.reps,
        rpe: msg.rpe,
      });
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const partnerList = next[msg.userId] ? [...next[msg.userId]] : buildInitialExercisesForUser(msg.userId, sessionExerciseIds);
        const exIdx = partnerList.findIndex((e) => e.exerciseId === msg.exerciseId);
        if (exIdx !== -1) {
          const ex = { ...partnerList[exIdx] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: msg.weight,
              reps: msg.reps,
              rpe: msg.rpe,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            weightKg: msg.weight,
            reps: msg.reps,
            rpe: msg.rpe,
            isCompleted: true,
          };
          ex.sets = sets;
          partnerList[exIdx] = ex;
          next[msg.userId] = partnerList;
        }
        return next;
      });
    },
    onCoachLoggedSet: (msg) => {
      // Remote-control logging from coach: client screen updates instantly with zero typing!
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const myExercises = next[activeUser.id] ? [...next[activeUser.id]] : buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
        const exIdx = myExercises.findIndex((e) => e.exerciseId === msg.exerciseId);
        if (exIdx !== -1) {
          const ex = { ...myExercises[exIdx] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: msg.weight,
              reps: msg.reps,
              rpe: msg.rpe,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            weightKg: msg.weight,
            reps: msg.reps,
            rpe: msg.rpe,
            isCompleted: true,
          };
          ex.sets = sets;
          myExercises[exIdx] = ex;
          next[activeUser.id] = myExercises;
        }
        return next;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onExerciseAdded: (msg) => {
      const exDef = exercises.find((e) => e.id === msg.exerciseId);
      if (exDef) {
        handleAddExerciseToSession(exDef, false);
      }
    },
    onExerciseSwapped: (msg) => {
      const newDef = exercises.find((e) => e.id === msg.newExerciseId);
      if (newDef) {
        setSessionExerciseIds((prev) => {
          const next = [...prev];
          if (next[msg.exerciseIndex] !== undefined) {
            next[msg.exerciseIndex] = newDef.id;
          }
          return next;
        });
        setUserExercisesMap((prev) => {
          const nextMap = { ...prev };
          Object.keys(nextMap).forEach((uId) => {
            const list = [...nextMap[uId]];
            if (list[msg.exerciseIndex]) {
              const prevSets = list[msg.exerciseIndex].sets;
              list[msg.exerciseIndex] = {
                exerciseId: newDef.id,
                exerciseName: newDef.name,
                sets: prevSets.map((s, idx) => ({
                  setNumber: idx + 1,
                  type: s.type,
                  weightKg: 0,
                  reps: 0,
                  isCompleted: false,
                })),
              };
              nextMap[uId] = list;
            }
          });
          return nextMap;
        });
      }
    },
    onAdvanceExercise: (msg) => {
      setActiveExerciseIndex(msg.exerciseIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onTurnSet: (msg) => {
      if (msg.lastCompletedSet) {
        const exDef = exercises.find((e) => e.id === msg.lastCompletedSet?.exerciseId);
        setPartnerLatestSet({
          exerciseName: exDef ? exDef.name : undefined,
          setIndex: msg.lastCompletedSet.setIndex,
          weight: msg.lastCompletedSet.weight,
          reps: msg.lastCompletedSet.reps,
          rpe: msg.lastCompletedSet.rpe,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onTimerSync: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    onBenchmarksSynced: (msg) => {
      if (msg.benchmarks) {
        setPartnerBenchmarks((prev) => ({ ...prev, ...msg.benchmarks }));
      }
    },
    onLifterSetUpdated: (msg) => {
      let completedExName: string | undefined;
      let completedWeight = 0;
      let completedReps = 0;
      let completedRpe: number | undefined;

      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const userList = next[msg.targetUserId]
          ? [...next[msg.targetUserId]]
          : buildInitialExercisesForUser(msg.targetUserId, sessionExerciseIds);
        if (userList[msg.exerciseIndex]) {
          const ex = { ...userList[msg.exerciseIndex] };
          const sets = [...ex.sets];
          while (sets.length <= msg.setIndex) {
            sets.push({
              setNumber: sets.length + 1,
              type: 'Normal',
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            });
          }
          sets[msg.setIndex] = {
            ...sets[msg.setIndex],
            [msg.field]: msg.value,
          };
          ex.sets = sets.map((s, i) => ({ ...s, setNumber: i + 1 }));
          userList[msg.exerciseIndex] = ex;
          next[msg.targetUserId] = userList;

          if (msg.field === 'isCompleted' && msg.value === true) {
            completedExName = ex.exerciseName;
            completedWeight = sets[msg.setIndex].weightKg;
            completedReps = sets[msg.setIndex].reps;
            completedRpe = sets[msg.setIndex].rpe;
          }
        }
        return next;
      });

      if (msg.field === 'isCompleted' && msg.value === true) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (completedExName) {
          setPartnerLatestSet({
            exerciseName: completedExName,
            setIndex: msg.setIndex,
            weight: completedWeight,
            reps: completedReps,
            rpe: completedRpe,
          });
        }
      }
    },
    onLifterSetAdded: (msg) => {
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const lifterIds = Array.from(
          new Set([
            activeUser.id,
            ...Object.keys(prev),
            ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
          ])
        );
        lifterIds.forEach((uId) => {
          const userList = next[uId]
            ? [...next[uId]]
            : buildInitialExercisesForUser(uId, sessionExerciseIds);
          if (userList[msg.exerciseIndex]) {
            const ex = { ...userList[msg.exerciseIndex] };
            const lastSet = ex.sets[ex.sets.length - 1];
            const newSet: SetLog = {
              setNumber: ex.sets.length + 1,
              type: msg.newSet?.type || 'Normal',
              weightKg: uId === msg.targetUserId ? (msg.newSet?.weightKg || 0) : (lastSet?.weightKg || 0),
              reps: uId === msg.targetUserId ? (msg.newSet?.reps || 0) : (lastSet?.reps || 0),
              isCompleted: false,
            };
            ex.sets = [...ex.sets, newSet].map((s, idx) => ({ ...s, setNumber: idx + 1 }));
            userList[msg.exerciseIndex] = ex;
            next[uId] = userList;
          }
        });
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onLifterSetRemoved: (msg) => {
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        const lifterIds = Array.from(
          new Set([
            activeUser.id,
            ...Object.keys(prev),
            ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
          ])
        );
        lifterIds.forEach((uId) => {
          const userList = next[uId]
            ? [...next[uId]]
            : buildInitialExercisesForUser(uId, sessionExerciseIds);
          if (userList[msg.exerciseIndex] && userList[msg.exerciseIndex].sets.length > 1) {
            const ex = { ...userList[msg.exerciseIndex] };
            const filtered = ex.sets.filter((_, idx) => idx !== msg.setIndex);
            ex.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
            userList[msg.exerciseIndex] = ex;
            next[uId] = userList;
          }
        });
        return next;
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onSessionExercisesSynced: (syncedMap) => {
      if (!syncedMap || Object.keys(syncedMap).length === 0) return;
      setUserExercisesMap((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        Object.entries(syncedMap).forEach(([lifterId, incomingExercises]) => {
          if (!Array.isArray(incomingExercises) || incomingExercises.length === 0) return;
          // For partner or other lifters, always adopt the newest synced exercises directly
          if (lifterId !== activeUser.id) {
            next[lifterId] = incomingExercises as LoggedExercise[];
            hasChanges = true;
          } else {
            // For own exercises: update completed sets from remote coach/partner while preserving active inputs
            const myCurrent = next[activeUser.id];
            if (!myCurrent || myCurrent.length === 0) {
              next[activeUser.id] = incomingExercises as LoggedExercise[];
              hasChanges = true;
            } else {
              const merged = myCurrent.map((curEx, exIdx) => {
                const incomingEx = (incomingExercises as LoggedExercise[])[exIdx];
                if (!incomingEx) return curEx;
                return {
                  ...curEx,
                  sets: curEx.sets.map((curSet, sIdx) => {
                    const incomingSet = incomingEx.sets?.[sIdx];
                    if (!incomingSet) return curSet;
                    if (incomingSet.isCompleted && !curSet.isCompleted) {
                      hasChanges = true;
                      return { ...curSet, ...incomingSet };
                    }
                    return curSet;
                  }),
                };
              });
              if (hasChanges) {
                next[activeUser.id] = merged;
              }
            }
          }
        });
        return hasChanges ? next : prev;
      });
    },
    onWorkoutFinished: (msg) => {
      if (msg.finishedByUserId !== activeUser.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleFinishWorkoutRef.current?.(true, msg.finishedByUserName);
      }
    },
  });

  // Auto-connect seamlessly if launched with joinRoomPin (from the direct Join Buddy modal)
  const hasAutoJoinedRef = useRef(false);
  useEffect(() => {
    if (!localBuddy && !draft && params.joinRoomPin && !hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      gymJam.joinRoom(params.joinRoomPin);
    }
  }, [params.joinRoomPin, gymJam.joinRoom, localBuddy]);

  // Lifters currently participating in this workout session
  const sessionLifters = useMemo(() => {
    const list: { id: string; name: string }[] = [
      { id: activeUser.id, name: activeUser.displayName },
    ];
    if (localBuddy) list.push({ id: localBuddy.id, name: localBuddy.displayName });
    if (
      gymJam.connectionStatus === 'connected' &&
      gymJam.partnerUserId &&
      gymJam.partnerUserId !== activeUser.id
    ) {
      list.push({
        id: gymJam.partnerUserId,
        name: gymJam.partnerName || 'Partner',
      });
    }
    // Deduplicate by ID to ensure distinct lifters
    const seen = new Set<string>();
    return list.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [
    activeUser.id,
    activeUser.displayName,
    localBuddy,
    gymJam.connectionStatus,
    gymJam.partnerUserId,
    gymJam.partnerName,
  ]);

  // Benchmark Handshake: When connected to Jam, broadcast own benchmarks for session exercises
  useEffect(() => {
    if (gymJam.connectionStatus === 'connected') {
      const myLogs = workoutLogs.filter((l) => l.userId === activeUser.id);
      const myBenchmarks: Record<string, any> = {};
      sessionExerciseIds.forEach((exId) => {
        const hist = getExerciseHistory(myLogs, exId);
        myBenchmarks[exId] = {
          bestWorkingSet: hist.bestWorkingSet,
          maxRepsAtWeight: hist.maxRepsAtWeight,
          estimated1RM: hist.estimated1RM,
        };
      });
      gymJam.broadcastSyncBenchmarks(myBenchmarks);
    }
  }, [gymJam.connectionStatus, sessionExerciseIds, workoutLogs, activeUser.id]);

  // When partner joins, initialize partner's exercise sets to match active user's structure 100%
  useEffect(() => {
    if (
      gymJam.connectionStatus === 'connected' &&
      gymJam.partnerUserId &&
      gymJam.partnerUserId !== activeUser.id
    ) {
      const pId = gymJam.partnerUserId;
      setUserExercisesMap((prev) => {
        if (!prev[pId]) {
          const myExercises =
            prev[activeUser.id] ||
            buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
          const partnerExercises: LoggedExercise[] = myExercises.map((myEx) => ({
            exerciseId: myEx.exerciseId,
            exerciseName: myEx.exerciseName,
            sets: myEx.sets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          }));
          return {
            ...prev,
            [pId]: partnerExercises,
          };
        }
        return prev;
      });
    }
  }, [gymJam.connectionStatus, gymJam.partnerUserId, sessionExerciseIds, activeUser.id]);

  const showAddBuddy = canAddLocalBuddy && !localBuddy && !params.joinRoomPin
    && !gymJam.roomPin && gymJam.connectionStatus !== 'connected' && gymJam.connectionStatus !== 'connecting';

  useEffect(() => {
    if (openedTogether.current || !params.togetherMode) return;
    openedTogether.current = true;
    if (localBuddy || params.joinRoomPin) return;
    if (params.togetherMode === 'phone' && showAddBuddy) setShowLocalBuddy(true);
    else if (params.togetherMode === 'separate') setShowGymJamLobby(true);
  }, [params.togetherMode, showAddBuddy, localBuddy, params.joinRoomPin]);

  const handleAddLocalBuddy = async () => {
    if (!showAddBuddy || addingBuddy.current || (!partnerUser && !buddyName.trim())) return;
    addingBuddy.current = true;
    setIsAddingBuddy(true);
    setBuddyError('');
    try {
      const buddy = partnerUser || await linkPartnerUser(buddyName);
      const template = (userExercisesMap[activeUser.id] || []).map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map(({ setNumber, type }) => ({
          setNumber, type, weightKg: 0, reps: 0, isCompleted: false,
        })),
      }));
      setUserExercisesMap((previous) => ({ ...previous, [buddy.id]: template }));
      setBuddyId(buddy.id);
      setViewingLifterId(buddy.id);
      setSetNotice(null);
      setShowLocalBuddy(false);
    } catch {
      setBuddyError('Could not save your buddy profile. Try again.');
    } finally {
      addingBuddy.current = false;
      setIsAddingBuddy(false);
    }
  };

  // Get current viewed lifter's exercises & name (Independent Viewing: Herman viewing Lou-an does not switch Lou-an's phone!)
  const currentSessionExercises: LoggedExercise[] =
    userExercisesMap[viewingLifterId] || buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds);

  const viewingLifterName =
    sessionLifters.find((l) => l.id === viewingLifterId)?.name ||
    (viewingLifterId === activeUser.id ? activeUser.displayName : gymJam.partnerName || 'Lifter');

  const getCompletedCountForUser = (userId: string): number => {
    const list = userExercisesMap[userId] || [];
    return list.reduce((acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length, 0);
  };

  // Two-Way Live Set Mutators: updates viewingLifterId locally AND broadcasts over Jam to partner phone
  const handleUpdateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof SetLog,
    value: any,
    input?: string,
  ) => {
    let nextMapForSync: Record<string, LoggedExercise[]> | null = null;
    setUserExercisesMap((prev) => {
      const currentList = prev[viewingLifterId]
        ? [...prev[viewingLifterId]]
        : [...buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds)];
      const ex = { ...currentList[exIndex] };
      const sets = [...ex.sets];
      const set: DraftSet = { ...sets[setIndex], [field]: value };
      if (field === 'weightKg') set.weightInput = input;
      if (field === 'reps') set.repsInput = input;
      if ((field === 'weightKg' || field === 'reps') && input !== undefined) set.isCompleted = false;
      sets[setIndex] = set;
      ex.sets = sets;
      currentList[exIndex] = ex;
      const next = { ...prev, [viewingLifterId]: currentList };
      nextMapForSync = next;
      return next;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastUpdateLifterSet(viewingLifterId, exIndex, setIndex, field as string, value);
      if (nextMapForSync) {
        gymJam.syncSessionExercises(nextMapForSync);
      }
    }
  };

  const handleToggleComplete = (exIndex: number, setIndex: number) => {
    const currentEx = currentSessionExercises[exIndex];
    const currentSet = currentEx?.sets[setIndex];
    if (!currentEx || !currentSet) return;

    const set: DraftSet = currentSet;
    if (!set.isCompleted) {
      const weight = set.weightInput ?? (set.weightKg > 0 ? String(fromKg(set.weightKg)) : '');
      const reps = set.repsInput ?? String(set.reps);
      if (parseSetWeight(weight) === null || parseSetReps(reps) === null) {
        setSetNotice(`${currentEx.exerciseName}, set ${setIndex + 1}: enter weight and at least one rep. Use 0 for bodyweight.`);
        return;
      }
    }
    setSetNotice(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleUpdateSet(exIndex, setIndex, 'isCompleted', !set.isCompleted);
  };

  const handleAdvanceExercise = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= currentSessionExercises.length) return;
    Haptics.selectionAsync();
    setActiveExerciseIndex(targetIndex);
    const targetEx = currentSessionExercises[targetIndex];
    if (gymJam.connectionStatus === 'connected' && targetEx) {
      gymJam.broadcastAdvanceExercise(targetIndex, targetEx.exerciseId, targetEx.exerciseName);
    }
  };

  const handleAddSet = (exIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // In Co-Op, add set across all lifters so set counts and numbers remain 100% mirrored
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = localBuddy ? [viewingLifterId] : Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const list = nextMap[uId]
          ? [...nextMap[uId]]
          : [...buildInitialExercisesForUser(uId, sessionExerciseIds)];
        if (list[exIndex]) {
          const targetEx = { ...list[exIndex] };
          const newSet: SetLog = {
            setNumber: targetEx.sets.length + 1,
            type: 'Normal',
            weightKg: 0,
            reps: 0,
            isCompleted: false,
          };
          targetEx.sets = [...targetEx.sets, newSet].map((s, idx) => ({ ...s, setNumber: idx + 1 }));
          list[exIndex] = targetEx;
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastAddLifterSet(viewingLifterId, exIndex, {
        setNumber: 0,
        type: 'Normal',
        weightKg: 0,
        reps: 0,
        isCompleted: false,
      });
    }
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentList =
      userExercisesMap[viewingLifterId] || buildInitialExercisesForUser(viewingLifterId, sessionExerciseIds);
    if (currentList[exIndex]?.sets.length <= 1) return;

    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = localBuddy ? [viewingLifterId] : Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const list = nextMap[uId]
          ? [...nextMap[uId]]
          : [...buildInitialExercisesForUser(uId, sessionExerciseIds)];
        if (list[exIndex] && list[exIndex].sets.length > 1) {
          const targetEx = { ...list[exIndex] };
          const filtered = targetEx.sets.filter((_, idx) => idx !== setIndex);
          targetEx.sets = filtered.map((s, i) => ({ ...s, setNumber: i + 1 }));
          list[exIndex] = targetEx;
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });

    if (gymJam.connectionStatus === 'connected') {
      gymJam.broadcastRemoveLifterSet(viewingLifterId, exIndex, setIndex);
    }
  };

  const handleSwapExercise = (newEx: Exercise) => {
    if (swapTargetIndex === null) return;
    const oldEx = currentSessionExercises[swapTargetIndex];
    if (gymJam.connectionStatus === 'connected' && oldEx) {
      gymJam.broadcastSwapExercise(swapTargetIndex, oldEx.exerciseId, newEx.id, newEx.name);
    }
    setSessionExerciseIds((prev) => {
      const next = [...prev];
      if (next[swapTargetIndex] !== undefined) {
        next[swapTargetIndex] = newEx.id;
      }
      return next;
    });
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      Object.keys(nextMap).forEach((uId) => {
        const list = [...nextMap[uId]];
        if (list[swapTargetIndex]) {
          const prevSets = list[swapTargetIndex].sets;
          list[swapTargetIndex] = {
            exerciseId: newEx.id,
            exerciseName: newEx.name,
            sets: prevSets.map((s, idx) => ({
              setNumber: idx + 1,
              type: s.type,
              weightKg: 0,
              reps: 0,
              isCompleted: false,
            })),
          };
          nextMap[uId] = list;
        }
      });
      return nextMap;
    });
    setShowSwapModal(false);
    setSwapTargetIndex(null);
  };

  const handleAddExerciseToSession = (ex: Exercise, broadcast: boolean = true) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (broadcast && gymJam.connectionStatus === 'connected') {
      gymJam.broadcastAddExercise(ex.id, ex.name);
    }
    setSessionExerciseIds((prev) => [...prev, ex.id]);
    setUserExercisesMap((prev) => {
      const nextMap = { ...prev };
      const lifterIds = Array.from(
        new Set([
          activeUser.id,
          ...Object.keys(prev),
          ...(gymJam.partnerUserId ? [gymJam.partnerUserId] : []),
        ])
      );
      lifterIds.forEach((uId) => {
        const currentList = nextMap[uId]
          ? [...nextMap[uId]]
          : buildInitialExercisesForUser(uId);
        const newLoggedEx: LoggedExercise = {
          exerciseId: ex.id,
          exerciseName: ex.name,
          sets: [
            { setNumber: 1, type: 'Warmup', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 2, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
            { setNumber: 3, type: 'Normal', weightKg: 0, reps: 0, isCompleted: false },
          ],
        };
        nextMap[uId] = [...currentList, newLoggedEx];
      });
      return nextMap;
    });
    setShowAddExerciseModal(false);
    setExerciseSearchQuery('');
  };

  const handleCreateAndAddExercise = () => {
    if (!newExName.trim()) {
      Alert.alert('Required', 'Please enter an exercise name.');
      return;
    }
    const created = addExercise({
      workspaceId: activeWorkspace.id,
      name: newExName.trim(),
      muscleGroup: newExMuscle,
      equipment: newExEquipment.trim() || 'Custom',
    });
    setNewExName('');
    setNewExEquipment('Barbell');
    setShowCreateExerciseModal(false);

    if (swapTargetIndex !== null) {
      handleSwapExercise(created);
    } else {
      handleAddExerciseToSession(created);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFinishWorkout = async (isRemoteTriggered = false, remoteFinishedByName?: string) => {
    if (finishInProgress.current || closed.current) return;
    const completedExercises = completedWorkoutExercises(userExercisesMap[activeUser.id] || []);
    const buddyExercises = localBuddy ? completedWorkoutExercises(userExercisesMap[localBuddy.id] || []) : [];
    if (!completedExercises.length && !buddyExercises.length) {
      if (!isRemoteTriggered) setSetNotice('Complete at least one set before finishing.');
      return;
    }

    finishInProgress.current = true;
    setIsFinishing(true);
    setSetNotice(null);
    const todayDate = formatLocalDate();
    pauseWorkoutTimer();
    const finalDurationSeconds = secondsElapsed;
    const logId = `log_session_${sessionStartedAt}_${activeUser.id}`;
    const log = {
      userId: params.clientId ? (activeClient?.linkedUserId || params.clientId) : activeUser.id,
      workspaceId: activeWorkspace.id,
      splitId: sessionSplitId || 'split_custom',
      routineId: sessionRoutineId,
      routineName: currentRoutineTitle,
      date: todayDate,
      timestamp: Date.now(),
      durationSeconds: finalDurationSeconds,
      exercises: completedExercises,
    };
    const buddyLog = localBuddy && buddyExercises.length ? {
      ...log,
      id: `log_session_${sessionStartedAt}_${localBuddy.id}`,
      userId: localBuddy.id,
      exercises: buddyExercises,
    } : undefined;
    try {
      if (params.clientId) await logClientWorkout(params.clientId, log, logId);
      else if (completedExercises.length) await saveWorkoutLog(log, logId, buddyLog);
      else if (buddyLog) await saveWorkoutLog(buddyLog, buddyLog.id);
    } catch {
      setSetNotice('Could not save this workout. Your draft is still available. Try finishing again.');
      finishInProgress.current = false;
      setIsFinishing(false);
      return;
    }

    closed.current = true;
    await draftWrites.current.catch(() => {});
    await clearWorkoutDraft(draftKey).catch(() => {});
    stopWorkoutTimer();
    if (!isRemoteTriggered && gymJam.connectionStatus === 'connected') {
      gymJam.broadcastFinishWorkout(activeUser.id, activeUser.displayName);
    }
    const buildReceipt = (athleteName: string, loggedExercises: LoggedExercise[], isBuddy = false): WorkoutReceiptData => {
      let totalVolume = 0;
      let totalSets = 0;
      let totalReps = 0;
      let bestLift: WorkoutReceiptData['bestLift'] = null;
      let highest1RM = 0;

      const exercisesSummary: WorkoutReceiptData['exercisesSummary'] = [];

      loggedExercises.forEach((ex) => {
        const completedSets = ex.sets.filter((s) => s.isCompleted);
        if (completedSets.length > 0) {
          let topWeight = 0;
          let topReps = 0;
          completedSets.forEach((s) => {
            totalVolume += (s.weightKg || 0) * (s.reps || 0);
            totalSets += 1;
            totalReps += s.reps || 0;

            const est1RM = calculate1RM(s.weightKg, s.reps);
            if (est1RM > highest1RM) {
              highest1RM = est1RM;
              bestLift = {
                exerciseName: ex.exerciseName,
                weightKg: s.weightKg,
                reps: s.reps,
              };
            }

            if (s.weightKg > topWeight || (s.weightKg === topWeight && s.reps > topReps)) {
              topWeight = s.weightKg;
              topReps = s.reps;
            }
          });

          exercisesSummary.push({
            exerciseName: ex.exerciseName,
            completedSetsCount: completedSets.length,
            topSetWeight: topWeight,
            topSetReps: topReps,
          });
        }
      });

      return {
        id: `RIP-${Math.floor(100000 + Math.random() * 900000)}`,
        date: todayDate,
        athleteName,
        routineName: currentRoutineTitle,
        durationSeconds: finalDurationSeconds,
        totalVolumeKg: Math.round(totalVolume),
        totalSets,
        totalReps,
        bestLift,
        gymJamBuddy:
          !isBuddy && (gymJam.partnerName || remoteFinishedByName)
            ? {
                name: remoteFinishedByName || gymJam.partnerName || 'Workout Buddy',
                roomPin: gymJam.roomPin || '',
              }
            : null,
        coachAttribution:
          !isBuddy && userRole === 'coach'
            ? {
                name: coachProfile.name,
                businessName: coachProfile.businessName,
                instagramHandle: coachProfile.instagramHandle,
              }
            : !isBuddy && linkedCoach
            ? {
                name: linkedCoach.name,
                businessName: linkedCoach.businessName,
                instagramHandle: linkedCoach.instagramHandle,
              }
            : null,
        exercisesSummary,
      };
    };
    setReceipts([
      ...(completedExercises.length ? [
        buildReceipt(params.clientName || activeClient?.name || activeUser.displayName, completedExercises),
      ] : []),
      ...(localBuddy && buddyLog ? [buildReceipt(localBuddy.displayName, buddyExercises, true)] : []),
    ]);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowReceiptModal(true);
    setIsFinishing(false);
  };

  handleFinishWorkoutRef.current = handleFinishWorkout;

  return (
    <View
      className="flex-1 bg-dark-bg"
      style={{
        paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 32 : 0),
        paddingBottom: insets.bottom,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header Bar */}
        <View className="bg-dark-card border-b border-dark-border px-3 py-2 flex-row flex-wrap items-center justify-between gap-y-2 shadow-md">
          {/* Left: Close button and Routine Title */}
          <View className="flex-row items-center space-x-2 w-full">
            <TouchableOpacity onPress={handleExitWorkout} accessibilityRole="button" accessibilityLabel="Leave workout" className="w-12 h-12 items-center justify-center">
              <Ionicons name="close" size={24} color="#A1A1AA" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">
                {currentRoutineTitle}
              </Text>
            </View>
          </View>

          {/* Right: Jam + Timer Stack, and Finish Button */}
          <View className="flex-row items-center justify-between w-full gap-3">
            {/* Jam & Timer Stack (Timer directly under Jam) */}
            <View className="items-end justify-center">
              {/* Total Workout Timer Badge directly under Jam */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleWorkoutTimer();
                }}
                accessibilityRole="button"
                accessibilityLabel={isTimerRunning ? 'Pause workout timer' : 'Resume workout timer'}
                className={`min-h-[48px] flex-row items-center px-3 py-2 rounded-lg border ${
                  isTimerRunning
                    ? 'bg-cyan-950/50 border-cyan-500/40'
                    : 'bg-amber-950/50 border-amber-500/50'
                }`}
              >
                <Ionicons
                  name={isTimerRunning ? 'stopwatch-outline' : 'play'}
                  size={11}
                  color={isTimerRunning ? '#06B6D4' : '#F59E0B'}
                />
                <Text
                  className={`text-xs font-bold font-mono ml-1 ${
                    isTimerRunning ? 'text-accent-cyan' : 'text-amber-400'
                  }`}
                >
                  {formatDuration(secondsElapsed)}
                </Text>
                {!isTimerRunning && (
                  <Text className="text-xs font-extrabold text-amber-400 ml-1">PAUSED</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Finish Workout Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { void handleFinishWorkout(); }}
              disabled={isFinishing}
              className="bg-accent-cyan min-h-[48px] px-3.5 py-3 rounded-xl flex-row items-center space-x-1 shadow-md shadow-cyan-500/20"
            >
              <Ionicons name="checkmark-done" size={16} color="#09090B" />
              <Text className="text-black font-extrabold text-xs">Finish</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!localBuddy && !params.joinRoomPin && (
          <TouchableOpacity accessibilityRole="button"
            onPress={() => {
              if (gymJam.roomPin || gymJam.connectionStatus === 'connected' || gymJam.connectionStatus === 'connecting') setShowGymJamLobby(true);
              else setShowTogether(true);
            }}
            className="flex-row items-center gap-2 px-4 min-h-[48px] py-3 border-b border-zinc-700">
            <Ionicons name="people-outline" size={20} color="#67E8F9" />
            <Text className="text-base font-bold text-cyan-300 flex-1">
              {gymJam.connectionStatus === 'connected' ? `Training with ${gymJam.partnerName || 'your friend'}` : gymJam.connectionStatus === 'connecting' ? 'Connecting…' : gymJam.roomPin ? 'Invite your friend' : 'Train together'}
            </Text>
          </TouchableOpacity>
        )}

        <View className="bg-cyan-950 border-b border-cyan-800 px-4 py-3">
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" className="text-base font-bold text-white">Logging for {viewingLifterName}</Text>
          <Text accessibilityLiveRegion="polite" className="text-sm text-cyan-200 mt-1">
            {draftSaveState === 'saving' ? 'Saving draft…' : draftSaveState === 'error' ? 'Draft could not be saved. Keep this workout open and try again.' : 'Draft saved on this phone'}
          </Text>
          {draftSaveState === 'error' && <TouchableOpacity accessibilityRole="button" onPress={() => { void persistDraft(secondsElapsed).catch(() => {}); }} className="min-h-[48px] justify-center">
            <Text className="text-base font-bold text-cyan-200">Retry saving draft</Text>
          </TouchableOpacity>}
          {localBuddy?.id === viewingLifterId && <Text className="text-sm text-zinc-200 mt-1">{localBuddy.displayName} · Account not linked. Share their workout after finishing.</Text>}
        </View>

        {/* WORKOUT PARTNERS / LIFTER SWITCHER BAR (Gym Jam Shared Excel View) */}
        {sessionLifters.length > 1 && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2.5">
            <View className="flex-row flex-wrap items-center justify-between gap-2 mb-2">
              <View className="flex-row items-center space-x-1.5">
                <Text className="text-sm">🏋️</Text>
                <Text className="text-xs font-black tracking-wider text-zinc-300 uppercase">
                  {localBuddy ? 'Share this phone' : 'Training together'}
                </Text>
              </View>
              <Text className="text-xs text-zinc-400 font-medium">
                Tap a name to log their sets
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {sessionLifters.map((lifter) => {
                const isViewing = viewingLifterId === lifter.id;
                const completedSets = getCompletedCountForUser(lifter.id);

                return (
                  <TouchableOpacity
                    key={lifter.id}
                    style={{ flexGrow: 1, flexBasis: 125 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Log sets for ${lifter.name}`}
                    accessibilityState={{ selected: isViewing }}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setViewingLifterId(lifter.id);
                      setSetNotice(null);
                    }}
                    className={`flex-row items-center px-3 py-3 min-h-[48px] rounded-xl border ${
                      isViewing
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-zinc-850 border-zinc-750'
                    }`}
                  >
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                        isViewing ? 'bg-cyan-400' : 'bg-zinc-700'
                      }`}
                    >
                      <Ionicons
                        name="person"
                        size={13}
                        color={isViewing ? '#09090B' : '#A1A1AA'}
                      />
                    </View>
                    <View>
                      <View className="flex-row items-center space-x-1.5">
                        <Text
                          className={`text-xs font-black ${
                            isViewing ? 'text-white' : 'text-zinc-300'
                          }`}
                        >
                          {lifter.name}
                        </Text>
                      </View>
                      <Text
                        className={`text-xs font-bold ${
                          isViewing ? 'text-cyan-300 font-mono' : 'text-zinc-400'
                        }`}
                      >
                        {completedSets} {completedSets === 1 ? 'set' : 'sets'}
                      </Text>
                    </View>

                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Coach-as-Driver Session Bar */}
        {(userRole === 'coach' || params.clientName || params.clientId) && (
          <View className="bg-cyan-950/80 border-b border-cyan-500/40 px-3 py-2 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1.5 flex-1">
              <View className="w-2 h-2 rounded-full bg-cyan-400" />
              <Text className="text-xs font-black text-cyan-300" numberOfLines={1}>
                COACH DRIVER: {params.clientName || gymJam.partnerName || 'Remote Athlete'}
              </Text>
            </View>
          </View>
        )}

        {/* Gym Jam Live Feed Toast Notification */}
        {gymJam.liveToasts.length > 0 && (
          <View className="px-3 pt-2">
            {gymJam.liveToasts.map((toast) => (
              <View
                key={toast.id}
                className="bg-cyan-950/95 border border-cyan-500/60 rounded-xl px-3 py-2 mb-1.5 flex-row items-center space-x-2 shadow-lg"
              >
                <Ionicons name="flash" size={13} color="#06B6D4" />
                <Text className="text-xs font-bold text-white flex-1">{toast.message}</Text>
                <Text className="text-xs text-cyan-400 font-mono">LIVE</Text>
              </View>
            ))}
          </View>
        )}

        {/* Partner Latest Set Badge */}
        {gymJam.connectionStatus === 'connected' && partnerLatestSet && (
          <View className="bg-zinc-900 border-b border-zinc-800 px-3 py-2">
            <View className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 flex-row items-center justify-between">
              <View className="flex-row items-center space-x-1.5">
                <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                <Text className="text-xs font-medium text-zinc-300">
                  {gymJam.partnerName || 'Partner'} logged Set {partnerLatestSet.setIndex + 1}:{' '}
                  <Text className="font-bold text-emerald-400">
                    {partnerLatestSet.weight}kg × {partnerLatestSet.reps}
                  </Text>
                  {partnerLatestSet.rpe ? ` @ RPE ${partnerLatestSet.rpe}` : ''}
                </Text>
              </View>
              <Text className="text-xs font-mono text-zinc-400">SYNCED</Text>
            </View>
          </View>
        )}

        {setNotice && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="bg-amber-950 text-amber-200 px-4 py-3 text-sm">
            {setNotice}
          </Text>
        )}
        {/* Scrollable Exercise Cards */}
        <ScrollView className="flex-1 px-3 py-4" showsVerticalScrollIndicator={false}>
          {currentSessionExercises.map((exItem, exIdx) => {
            const firstSetWeight = exItem.sets[0]?.weightKg || 0;

            const lifterLogs = workoutLogs.filter((log) => log.userId === viewingLifterId);
            const history = getExerciseHistory(lifterLogs, exItem.exerciseId, firstSetWeight);
            const remoteBenchmarks = viewingLifterId === gymJam.partnerUserId
              ? partnerBenchmarks[exItem.exerciseId]
              : undefined;
            const benchmarks = remoteBenchmarks || history;
            const benchmarkBestWorkingSet = benchmarks.bestWorkingSet;
            const benchmarkRepPR = benchmarks.maxRepsAtWeight;
            const benchmarkEst1RM = benchmarks.estimated1RM;

            return (
              <View
                key={`${exItem.exerciseId}_${exIdx}`}
                className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4 shadow-md"
              >
                {/* Exercise Title & Swap Button */}
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2.5">
                  <View className="flex-1 pr-2">
                    <Text className="text-lg font-bold text-white">{exItem.exerciseName}</Text>
                  </View>
                  <View className="flex-row items-center space-x-1.5">
                    <TouchableOpacity
                      onPress={() => {
                        setSwapTargetIndex(exIdx);
                        setShowSwapModal(true);
                      }}
                      className="bg-zinc-800 border border-zinc-700 px-2.5 min-h-[48px] py-2 rounded-lg flex-row items-center space-x-1"
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#A1A1AA" />
                      <Text className="text-xs text-zinc-300 font-medium">Swap</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: Boolean(expandedBests[exItem.exerciseId]) }}
                  accessibilityLabel={`Personal bests for ${exItem.exerciseName}`}
                  onPress={() => setExpandedBests((previous) => ({ ...previous, [exItem.exerciseId]: !previous[exItem.exerciseId] }))}
                  className="min-h-[48px] flex-row items-center gap-2 mb-2">
                  <Text className="text-sm font-semibold text-zinc-300">Personal bests</Text>
                  <Ionicons name={expandedBests[exItem.exerciseId] ? 'chevron-up' : 'chevron-down'} size={16} color="#D4D4D8" />
                </TouchableOpacity>
                {expandedBests[exItem.exerciseId] && (<>
                {/* Historical Benchmarks Card */}
                <View className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 mb-4">
                  <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Personal bests · {viewingLifterName}
                  </Text>
                  <View className="flex-row justify-between items-center">
                    {/* Best Working Set (Not 1RM) */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-xs text-zinc-400 font-medium">Best Set (&gt;1 rep)</Text>
                      {benchmarkBestWorkingSet ? (
                        <View>
                          <Text className="text-xs font-bold text-accent-cyan">
                            {fromKg(benchmarkBestWorkingSet.weightKg)} {weightUnit} × {benchmarkBestWorkingSet.reps}
                          </Text>
                          {benchmarkBestWorkingSet.date ? (
                            <Text className="text-xs text-zinc-400">
                              {benchmarkBestWorkingSet.date}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text className="text-xs text-zinc-400 italic">No history</Text>
                      )}
                    </View>

                    {/* Max Reps at Weight */}
                    <View className="flex-1 mr-2 border-r border-zinc-800 pr-2">
                      <Text className="text-xs text-zinc-400 font-medium">Rep PR ({fromKg(firstSetWeight)} {weightUnit})</Text>
                      <Text className="text-xs font-bold text-accent-emerald">
                        {benchmarkRepPR > 0 ? `${benchmarkRepPR} Reps` : '—'}
                      </Text>
                    </View>

                    {/* Estimated 1RM */}
                    <View className="flex-1">
                      <Text className="text-xs text-zinc-400 font-medium">Est. 1RM</Text>
                      <Text className="text-xs font-bold text-accent-orange">
                        {benchmarkEst1RM > 0 ? `${fromKg(benchmarkEst1RM)} ${weightUnit}` : '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                </>)}

                {localBuddy?.id === viewingLifterId && !history.previousSessionSets.length && (
                  <Text className="text-xs text-zinc-400 mb-3">
                    No previous sets for {localBuddy.displayName} on this phone. Before your next workout, open Workout history, select their name, and import a workout code shared from their app.
                  </Text>
                )}

                {/* Sets Header */}
                <View className="flex-row items-center px-1 mb-2">
                  <Text className="w-8 text-xs font-bold text-zinc-400 text-center">SET</Text>
                  <Text className="w-20 text-xs font-bold text-zinc-400 text-center">TYPE</Text>
                  <Text className="flex-1 text-xs font-bold text-zinc-400 text-center">{weightUnit.toUpperCase()}</Text>
                  <Text className="flex-1 text-xs font-bold text-zinc-400 text-center">REPS</Text>
                  <Text className="w-12 text-xs font-bold text-zinc-400 text-center">DONE</Text>
                </View>

                {/* Set Entry Rows */}
                {exItem.sets.map((set: DraftSet, setIdx) => {
                  const preceding = exItem.sets.slice(0, setIdx).reverse().find((entry) => entry.isCompleted);
                  const lastSessionSet = history.previousSessionSets[setIdx];
                  const previous = lastSessionSet || preceding;
                  const label = `${exItem.exerciseName}, set ${setIdx + 1}`;

                  return (
                    <View key={setIdx} className="mb-2">
                      <View className={`flex-row items-center py-1 px-1 rounded-xl border ${
                        set.isCompleted
                          ? 'bg-emerald-950/20 border-emerald-900/40'
                          : 'bg-zinc-900/60 border-zinc-800/60'
                      }`}
                    >
                      {/* Set Number */}
                      <Text className="w-8 text-center text-xs font-bold text-white">{setIdx + 1}</Text>

                      {/* Set Type Selector */}
                      <TouchableOpacity
                        onPress={() => {
                          const currentTypeIdx = SET_TYPES.indexOf(set.type);
                          const nextType = SET_TYPES[(currentTypeIdx + 1) % SET_TYPES.length];
                          handleUpdateSet(exIdx, setIdx, 'type', nextType);
                        }}
                        className={`w-20 min-h-[48px] py-2 px-1 rounded-lg items-center justify-center border ${
                          set.type === 'Warmup'
                            ? 'bg-amber-950/40 border-amber-500/50'
                            : set.type === 'Drop'
                            ? 'bg-purple-950/40 border-purple-500/50'
                            : set.type === 'Failure'
                            ? 'bg-red-950/40 border-red-500/50'
                            : 'bg-zinc-800 border-zinc-700'
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            set.type === 'Warmup'
                              ? 'text-amber-400'
                              : set.type === 'Drop'
                              ? 'text-purple-300'
                              : set.type === 'Failure'
                              ? 'text-red-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {set.type}
                        </Text>
                      </TouchableOpacity>

                      {/* Weight Input */}
                      <View className="flex-1 mx-1">
                        <TextInput
                          keyboardType="decimal-pad"
                          accessibilityLabel={`${label}, weight in ${weightUnit}`}
                          editable={!set.isCompleted}
                          value={set.weightInput ?? (set.weightKg > 0 || set.isCompleted ? String(fromKg(set.weightKg)) : '')}
                          placeholder="—"
                          placeholderTextColor="#71717A"
                          onChangeText={(text) => {
                            const value = parseSetWeight(text) ?? 0;
                            handleUpdateSet(exIdx, setIdx, 'weightKg', weightUnit === 'lbs' ? value * KG_PER_LB : value, text);
                          }}
                          className="bg-zinc-950 border border-zinc-800 text-white text-center min-h-[48px] py-2 px-1 rounded-lg font-bold text-base"
                        />
                      </View>

                      {/* Reps Input */}
                      <View className="flex-1 mx-1">
                        <TextInput
                          keyboardType="number-pad"
                          accessibilityLabel={`${label}, reps`}
                          editable={!set.isCompleted}
                          value={set.repsInput ?? (set.reps > 0 ? String(set.reps) : '')}
                          placeholder="—"
                          placeholderTextColor="#71717A"
                          onChangeText={(text) => handleUpdateSet(exIdx, setIdx, 'reps', parseSetReps(text) ?? 0, text)}
                          className="bg-zinc-950 border border-zinc-800 text-white text-center min-h-[48px] py-2 px-2 rounded-lg font-bold text-base"
                        />
                      </View>

                      {/* Checkbox Trigger with Haptics */}
                      <TouchableOpacity
                        onPress={() => handleToggleComplete(exIdx, setIdx)}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Complete ${label}`}
                        accessibilityState={{ checked: Boolean(set.isCompleted) }}
                        className={`w-12 h-12 rounded-lg items-center justify-center border ${
                          set.isCompleted
                            ? 'bg-accent-emerald border-accent-emerald'
                            : 'bg-zinc-800 border-zinc-700'
                        }`}
                      >
                        <Ionicons
                          name={set.isCompleted ? 'checkmark-sharp' : 'square-outline'}
                          size={22}
                          color={set.isCompleted ? '#FFFFFF' : '#A1A1AA'}
                        />
                      </TouchableOpacity>
                      </View>
                      <View className="flex-row flex-wrap justify-end gap-2">
                        {!set.isCompleted && previous && (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Use ${fromKg(previous.weightKg)} ${weightUnit} and ${previous.reps} reps for ${label}`}
                            onPress={() => {
                              handleUpdateSet(exIdx, setIdx, 'weightKg', previous.weightKg, String(fromKg(previous.weightKg)));
                              handleUpdateSet(exIdx, setIdx, 'reps', previous.reps, String(previous.reps));
                              setSetNotice(null);
                            }}
                            className="min-h-[48px] px-2 justify-center flex-shrink"
                          >
                            <Text className="text-xs font-semibold text-cyan-300">
                              {lastSessionSet ? 'Last time' : 'Earlier set'} · {fromKg(previous.weightKg)} {weightUnit} × {previous.reps} · Use these values
                            </Text>
                          </TouchableOpacity>
                        )}
                        {exItem.sets.length > 1 && (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${label}`}
                            onPress={() => handleRemoveSet(exIdx, setIdx)}
                            className="min-h-[44px] px-2 flex-row items-center gap-1"
                          >
                            <Ionicons name="trash-outline" size={14} color="#A1A1AA" />
                            <Text className="text-xs text-zinc-400">Remove</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Add Set Button */}
                <TouchableOpacity
                  onPress={() => handleAddSet(exIdx)}
                  className="bg-zinc-900 border border-dashed border-cyan-500/50 py-2.5 rounded-xl items-center flex-row justify-center space-x-1 mt-1"
                >
                  <Ionicons name="add" size={16} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Add Working Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Add Exercise to Workout Session Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setExerciseSearchQuery('');
              setShowAddExerciseModal(true);
            }}
            className="bg-accent-cyan p-4 rounded-2xl mb-8 flex-row items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25"
          >
            <Ionicons name="add-circle" size={22} color="#09090B" />
            <Text className="text-black font-extrabold text-base">+ Add Exercise to Workout</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={showExit} transparent animationType="fade" onRequestClose={() => setShowExit(false)}>
          <View className="flex-1 bg-black/80 justify-center px-5">
            <View className="bg-dark-card border border-zinc-800 rounded-2xl p-5 gap-3">
              <Text className="text-lg font-bold text-white">Leave workout?</Text>
              <Text className="text-sm text-zinc-300">You can resume this workout from Workouts.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => { setShowExit(false); void exitWithDraft(false); }} className="bg-accent-cyan p-3 rounded-xl items-center">
                <Text className="text-black font-bold">Save and exit</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowExit(false)} className="bg-zinc-800 p-3 rounded-xl items-center">
                <Text className="text-white font-bold">Keep training</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => { setShowExit(false); void exitWithDraft(true); }} className="p-3 items-center">
                <Text className="text-rose-400 font-bold">Discard workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Swap Exercise Modal */}
        {showSwapModal && (
          <Modal visible={showSwapModal} transparent animationType="slide">
            <View className="flex-1 bg-black/80 justify-end">
              <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                  <Text className="text-lg font-bold text-white">Swap Exercise</Text>
                  <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Create New Exercise Shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    setShowSwapModal(false);
                    setShowCreateExerciseModal(true);
                  }}
                  className="bg-cyan-500/15 border border-dashed border-cyan-500/60 p-3 rounded-xl mb-3 flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="add-circle" size={18} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Create Brand New Exercise</Text>
                </TouchableOpacity>

                {/* Search Bar */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex-row items-center space-x-2 mb-3">
                  <Ionicons name="search-outline" size={16} color="#71717A" />
                  <TextInput
                    value={exerciseSearchQuery}
                    onChangeText={setExerciseSearchQuery}
                    placeholder="Search exercise to swap with..."
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-xs font-medium"
                  />
                  {exerciseSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#71717A" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView className="mb-4">
                  {exercises
                    .filter(
                      (ex) =>
                        !exerciseSearchQuery.trim() ||
                        ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                        ex.muscleGroup.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                    )
                    .map((ex) => (
                      <TouchableOpacity
                        key={ex.id}
                        onPress={() => handleSwapExercise(ex)}
                        className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 flex-row items-center justify-between"
                      >
                        <View>
                          <Text className="text-sm font-bold text-white">{ex.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {ex.muscleGroup} • {ex.equipment}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#06B6D4" />
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Add Exercise to Workout Modal */}
        {showAddExerciseModal && (
          <Modal visible={showAddExerciseModal} transparent animationType="slide">
            <View className="flex-1 bg-black/80 justify-end">
              <View className="bg-dark-card border-t border-zinc-800 rounded-t-3xl p-5 max-h-[85%]">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                  <Text className="text-lg font-bold text-white">Add Exercise to Workout</Text>
                  <TouchableOpacity onPress={() => setShowAddExerciseModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Create New Exercise Shortcut */}
                <TouchableOpacity
                  onPress={() => {
                    setShowAddExerciseModal(false);
                    setSwapTargetIndex(null);
                    setShowCreateExerciseModal(true);
                  }}
                  className="bg-cyan-500/15 border border-dashed border-cyan-500/60 p-3 rounded-xl mb-3 flex-row items-center justify-center space-x-2"
                >
                  <Ionicons name="add-circle" size={18} color="#06B6D4" />
                  <Text className="text-xs font-bold text-cyan-400">+ Create Brand New Exercise</Text>
                </TouchableOpacity>

                {/* Search Bar */}
                <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex-row items-center space-x-2 mb-3">
                  <Ionicons name="search-outline" size={16} color="#71717A" />
                  <TextInput
                    value={exerciseSearchQuery}
                    onChangeText={setExerciseSearchQuery}
                    placeholder="Search exercises by name..."
                    placeholderTextColor="#71717A"
                    className="flex-1 text-white text-xs font-medium"
                  />
                  {exerciseSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#71717A" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView className="mb-4">
                  {exercises
                    .filter(
                      (ex) =>
                        !exerciseSearchQuery.trim() ||
                        ex.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) ||
                        ex.muscleGroup.toLowerCase().includes(exerciseSearchQuery.toLowerCase())
                    )
                    .map((ex) => (
                      <TouchableOpacity
                        key={ex.id}
                        onPress={() => handleAddExerciseToSession(ex)}
                        className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl mb-2 flex-row items-center justify-between"
                      >
                        <View>
                          <Text className="text-sm font-bold text-white">{ex.name}</Text>
                          <Text className="text-xs text-zinc-400">
                            {ex.muscleGroup} • {ex.equipment}
                          </Text>
                        </View>
                        <View className="bg-cyan-500/20 border border-cyan-500/60 px-3 py-1.5 rounded-lg">
                          <Text className="text-xs font-bold text-cyan-400">+ Add</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Create Custom Exercise Modal */}
        {showCreateExerciseModal && (
          <Modal visible={showCreateExerciseModal} transparent animationType="slide">
            <View className="flex-1 bg-black/85 justify-center px-4">
              <View className="bg-dark-card border border-zinc-800 p-5 rounded-2xl">
                <View className="flex-row items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                  <Text className="text-lg font-bold text-white">Create New Exercise</Text>
                  <TouchableOpacity onPress={() => setShowCreateExerciseModal(false)}>
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                <Text className="text-xs text-zinc-400 mb-1">Exercise Name</Text>
                <TextInput
                  value={newExName}
                  onChangeText={setNewExName}
                  placeholder="e.g. Incline Smith Machine Press"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-4 font-bold"
                />

                <Text className="text-xs text-zinc-400 mb-1">Primary Muscle Group</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {MUSCLE_GROUPS.map((mg) => (
                    <TouchableOpacity
                      key={mg}
                      onPress={() => setNewExMuscle(mg)}
                      className={`px-3 py-1.5 rounded-lg mr-2 border ${
                        newExMuscle === mg
                          ? 'bg-accent-cyan border-cyan-400'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          newExMuscle === mg ? 'text-black font-bold' : 'text-white'
                        }`}
                      >
                        {mg}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text className="text-xs text-zinc-400 mb-1">Equipment</Text>
                <TextInput
                  value={newExEquipment}
                  onChangeText={setNewExEquipment}
                  placeholder="e.g. Dumbbell / Cable / Machine"
                  placeholderTextColor="#71717A"
                  className="bg-zinc-900 border border-zinc-800 text-white p-3 rounded-xl mb-6"
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleCreateAndAddExercise}
                  className="bg-accent-cyan p-4 rounded-xl items-center shadow-lg shadow-cyan-500/20"
                >
                  <Text className="text-black font-extrabold text-base">Save & Add to Workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        <Modal
          visible={showLocalBuddy}
          transparent
          animationType="fade"
          onRequestClose={() => { if (!isAddingBuddy) setShowLocalBuddy(false); }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/80 justify-center px-5">
            <View className="bg-dark-card border border-zinc-800 rounded-2xl p-5 gap-3">
              <Text className="text-lg font-bold text-white">
                {partnerUser ? `Train with ${partnerUser.displayName}` : 'Add a workout buddy'}
              </Text>
              <Text className="text-sm text-zinc-300">
                Tap each name to log their sets. Your buddy’s workouts stay on this phone and are listed separately in Workout history. Their account is not linked. Import their previous workouts from Workout history before training to see their last weights.
              </Text>
              {!partnerUser && (
                <TextInput
                  accessibilityLabel="Buddy name"
                  placeholder="Buddy’s name"
                  placeholderTextColor="#A1A1AA"
                  value={buddyName}
                  onChangeText={setBuddyName}
                  autoCapitalize="words"
                  maxLength={40}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white"
                />
              )}
              {!!buddyError && <Text accessibilityRole="alert" className="text-sm text-rose-300">{buddyError}</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                disabled={isAddingBuddy || (!partnerUser && !buddyName.trim())}
                onPress={() => { void handleAddLocalBuddy(); }}
                className={`p-3 rounded-xl items-center ${isAddingBuddy || (!partnerUser && !buddyName.trim()) ? 'bg-zinc-700' : 'bg-accent-cyan'}`}
              >
                <Text className="text-black font-bold">{isAddingBuddy ? 'Saving…' : 'Start sharing this phone'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={isAddingBuddy} onPress={() => setShowLocalBuddy(false)} className="p-3 items-center">
                <Text className="text-white font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <TrainTogetherModal visible={showTogether} onClose={() => setShowTogether(false)}
          canSharePhone={showAddBuddy}
          onSharePhone={() => { setShowTogether(false); setBuddyError(''); setShowLocalBuddy(true); }}
          onSeparatePhones={() => { setShowTogether(false); setShowGymJamLobby(true); }} />

        {/* Gym Jam Lobby Modal */}
        {showGymJamLobby && !localBuddy && (
          <GymJamLobbyModal
            visible={showGymJamLobby}
            onClose={() => setShowGymJamLobby(false)}
            connectionStatus={gymJam.connectionStatus}
            roomPin={gymJam.roomPin}
            role={gymJam.role}
            partnerName={gymJam.partnerName}
            isWebRTC={gymJam.isWebRTC}
            onSimulatePartner={() => gymJam.simulatePartnerJoin('Jordan (Partner)')}
            onHostSession={() => {
              const myCurrentExercises =
                userExercisesMap[activeUser.id] ||
                buildInitialExercisesForUser(activeUser.id, sessionExerciseIds);
              const template: SessionExerciseTemplate[] = myCurrentExercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.exerciseName,
                sets: ex.sets.map((s) => ({
                  setNumber: s.setNumber,
                  type: s.type,
                  weightKg: s.weightKg,
                  reps: s.reps,
                })),
              }));

              gymJam.hostRoom({
                routineName: currentRoutineTitle,
                exerciseIds: sessionExerciseIds,
                sessionExercisesTemplate: template,
              });
            }}
            onJoinSession={async (pin) => {
              return await gymJam.joinRoom(pin);
            }}
            onDisconnect={() => gymJam.disconnect()}
            onStartSession={() => setShowGymJamLobby(false)}
          />
        )}


        {/* Aesthetic Shareable Workout Receipt Modal */}
        {showReceiptModal && (
          <WorkoutReceiptModal
            visible={showReceiptModal}
            receiptData={receipts[0] || null}
            alternateReceipt={receipts[1]}
            onClose={() => {
              if (gymJam.connectionStatus === 'connected') {
                gymJam.disconnect();
              }
              setShowReceiptModal(false);
              leave();
            }}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
