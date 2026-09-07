import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  JamConnectionStatus,
  JamRole,
  JamMessage,
  LogSetMessage,
  SyncSessionMessage,
  AddExerciseMessage,
  ReorderExerciseMessage,
  StartTimerMessage,
  JamLiveToast,
} from '../types/gymjam';

const JAM_STORAGE_KEY = '@pumpd_active_jam_session';
const PEERJS_HOST = '0.peerjs.com';
const PEERJS_PORT = 443;
const PEER_PREFIX = 'pumpd-jam-';

export interface UseGymJamProps {
  currentUserId: string;
  currentUserName: string;
  onSyncSessionReceived?: (msg: SyncSessionMessage) => void;
  onPartnerLoggedSet?: (msg: LogSetMessage) => void;
  onExerciseAdded?: (msg: AddExerciseMessage) => void;
  onExerciseReordered?: (msg: ReorderExerciseMessage) => void;
  onTimerSync?: (msg: StartTimerMessage) => void;
}

export function useGymJam({
  currentUserId,
  currentUserName,
  onSyncSessionReceived,
  onPartnerLoggedSet,
  onExerciseAdded,
  onExerciseReordered,
  onTimerSync,
}: UseGymJamProps) {
  const [connectionStatus, setConnectionStatus] = useState<JamConnectionStatus>('disconnected');
  const [roomPin, setRoomPin] = useState<string | null>(null);
  const [role, setRole] = useState<JamRole | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [liveToasts, setLiveToasts] = useState<JamLiveToast[]>([]);

  const peerRef = useRef<any>(null);
  const activeConnRef = useRef<any>(null);

  // Keep references to latest callbacks to avoid stale closures
  const callbacksRef = useRef({
    onSyncSessionReceived,
    onPartnerLoggedSet,
    onExerciseAdded,
    onExerciseReordered,
    onTimerSync,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSyncSessionReceived,
      onPartnerLoggedSet,
      onExerciseAdded,
      onExerciseReordered,
      onTimerSync,
    };
  }, [
    onSyncSessionReceived,
    onPartnerLoggedSet,
    onExerciseAdded,
    onExerciseReordered,
    onTimerSync,
  ]);

  // Helper to add toast notification
  const addToast = useCallback((message: string, userName: string) => {
    const toast: JamLiveToast = {
      id: `toast_${Date.now()}_${Math.random()}`,
      message,
      userName,
      timestamp: Date.now(),
    };
    setLiveToasts((prev) => [toast, ...prev].slice(0, 3));

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      setLiveToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4500);
  }, []);

  // Handle incoming messages
  const handleIncomingData = useCallback(
    (data: any) => {
      if (!data || typeof data !== 'object') return;
      const msg = data as JamMessage;

      switch (msg.type) {
        case 'SYNC_SESSION': {
          setPartnerName(msg.hostUserName);
          setPartnerUserId(msg.hostUserId);
          addToast(`Connected with host ${msg.hostUserName}`, msg.hostUserName);
          callbacksRef.current.onSyncSessionReceived?.(msg);
          break;
        }

        case 'LOG_SET': {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          addToast(
            `${msg.userName} logged Set ${msg.setIndex + 1}: ${msg.weight}kg × ${msg.reps}`,
            msg.userName
          );
          callbacksRef.current.onPartnerLoggedSet?.(msg);
          break;
        }

        case 'ADD_EXERCISE': {
          addToast(`${msg.exerciseName} added to workout`, 'Gym Jam');
          callbacksRef.current.onExerciseAdded?.(msg);
          break;
        }

        case 'REORDER_EXERCISE': {
          callbacksRef.current.onExerciseReordered?.(msg);
          break;
        }

        case 'START_TIMER': {
          addToast(`Rest timer synced (${msg.durationSeconds}s)`, msg.initiatedBy);
          callbacksRef.current.onTimerSync?.(msg);
          break;
        }

        default:
          break;
      }
    },
    [addToast]
  );

  // Setup connection handlers
  const attachConnectionHandlers = useCallback(
    (conn: any, isHost: boolean, initialSyncData?: { routineName: string; exerciseIds: string[] }) => {
      activeConnRef.current = conn;

      conn.on('open', () => {
        setConnectionStatus('connected');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (isHost && initialSyncData) {
          const syncMsg: SyncSessionMessage = {
            type: 'SYNC_SESSION',
            routineName: initialSyncData.routineName,
            exerciseIds: initialSyncData.exerciseIds,
            hostUserId: currentUserId,
            hostUserName: currentUserName,
            timestamp: Date.now(),
          };
          conn.send(syncMsg);
        }
      });

      conn.on('data', (data: any) => {
        handleIncomingData(data);
      });

      conn.on('close', () => {
        setConnectionStatus('disconnected');
        setPartnerName(null);
        addToast('Gym Jam partner disconnected', 'System');
      });

      conn.on('error', (err: any) => {
        console.warn('Gym Jam connection error:', err);
        setConnectionStatus('error');
      });
    },
    [currentUserId, currentUserName, handleIncomingData, addToast]
  );

  // Host a new session: generates PIN JAM-XXXX and creates Peer
  const hostRoom = useCallback(
    async (initialSyncData: { routineName: string; exerciseIds: string[] }) => {
      try {
        disconnect();

        // 4 random digits
        const pinNumber = Math.floor(1000 + Math.random() * 9000);
        const pin = `JAM-${pinNumber}`;
        const peerId = `${PEER_PREFIX}${pinNumber}`;

        setRoomPin(pin);
        setRole('host');
        setConnectionStatus('connecting');

        // Dynamically require peerjs
        const { Peer } = require('peerjs');

        const peer = new Peer(peerId, {
          host: PEERJS_HOST,
          port: PEERJS_PORT,
          path: '/',
          secure: true,
          debug: 1,
        });

        peerRef.current = peer;

        peer.on('open', (id: string) => {
          setConnectionStatus('connecting'); // Waiting for guest
        });

        peer.on('connection', (conn: any) => {
          attachConnectionHandlers(conn, true, initialSyncData);
        });

        peer.on('error', (err: any) => {
          console.warn('Peer error in host:', err);
          if (err?.type === 'unavailable-id') {
            // Retry with new PIN if ID was taken
            hostRoom(initialSyncData);
          } else {
            setConnectionStatus('error');
          }
        });

        // Persist session to AsyncStorage
        await AsyncStorage.setItem(
          JAM_STORAGE_KEY,
          JSON.stringify({
            roomPin: pin,
            role: 'host',
            timestamp: Date.now(),
          })
        );

        return pin;
      } catch (err) {
        console.warn('Failed to initialize host PeerJS:', err);
        setConnectionStatus('error');
        return null;
      }
    },
    [attachConnectionHandlers]
  );

  // Join an existing room via PIN
  const joinRoom = useCallback(
    async (rawPin: string) => {
      try {
        disconnect();

        const cleanPin = rawPin.trim().toUpperCase();
        const pinDigits = cleanPin.replace(/[^0-9]/g, '');
        if (!pinDigits || pinDigits.length !== 4) {
          throw new Error('Please enter a valid 4-digit room code.');
        }

        const normalizedPin = `JAM-${pinDigits}`;
        const targetPeerId = `${PEER_PREFIX}${pinDigits}`;
        const guestPeerId = `${PEER_PREFIX}${pinDigits}-guest-${Date.now().toString().slice(-4)}`;

        setRoomPin(normalizedPin);
        setRole('guest');
        setConnectionStatus('connecting');

        const { Peer } = require('peerjs');

        const peer = new Peer(guestPeerId, {
          host: PEERJS_HOST,
          port: PEERJS_PORT,
          path: '/',
          secure: true,
          debug: 1,
        });

        peerRef.current = peer;

        peer.on('open', () => {
          const conn = peer.connect(targetPeerId, {
            reliable: true,
            metadata: {
              guestUserId: currentUserId,
              guestUserName: currentUserName,
            },
          });
          attachConnectionHandlers(conn, false);
        });

        peer.on('error', (err: any) => {
          console.warn('Peer error in guest:', err);
          setConnectionStatus('error');
        });

        await AsyncStorage.setItem(
          JAM_STORAGE_KEY,
          JSON.stringify({
            roomPin: normalizedPin,
            role: 'guest',
            timestamp: Date.now(),
          })
        );

        return true;
      } catch (err: any) {
        console.warn('Failed to join Gym Jam room:', err);
        setConnectionStatus('error');
        return false;
      }
    },
    [currentUserId, currentUserName, attachConnectionHandlers]
  );

  // Broadcast any message to partner
  const broadcastMessage = useCallback((msg: JamMessage) => {
    if (activeConnRef.current && activeConnRef.current.open) {
      try {
        activeConnRef.current.send(msg);
      } catch (err) {
        console.warn('Failed to send message over data channel:', err);
      }
    }
  }, []);

  // Broadcast set log
  const broadcastLogSet = useCallback(
    (exerciseId: string, setIndex: number, weight: number, reps: number) => {
      const msg: LogSetMessage = {
        type: 'LOG_SET',
        userId: currentUserId,
        userName: currentUserName,
        exerciseId,
        setIndex,
        weight,
        reps,
        timestamp: Date.now(),
      };
      broadcastMessage(msg);
    },
    [currentUserId, currentUserName, broadcastMessage]
  );

  // Broadcast synchronized rest timer
  const broadcastStartTimer = useCallback(
    (durationSeconds: number) => {
      const msg: StartTimerMessage = {
        type: 'START_TIMER',
        durationSeconds,
        initiatedBy: currentUserName,
        timestamp: Date.now(),
      };
      broadcastMessage(msg);
    },
    [currentUserName, broadcastMessage]
  );

  // Broadcast add exercise
  const broadcastAddExercise = useCallback(
    (exerciseId: string, exerciseName: string) => {
      const msg: AddExerciseMessage = {
        type: 'ADD_EXERCISE',
        exerciseId,
        exerciseName,
        userId: currentUserId,
        timestamp: Date.now(),
      };
      broadcastMessage(msg);
    },
    [currentUserId, broadcastMessage]
  );

  // Disconnect & cleanup
  const disconnect = useCallback(() => {
    try {
      if (activeConnRef.current) {
        activeConnRef.current.close();
        activeConnRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    } catch (err) {
      console.warn('Error during peer cleanup:', err);
    }
    setConnectionStatus('disconnected');
    setRoomPin(null);
    setRole(null);
    setPartnerName(null);
    setPartnerUserId(null);
    AsyncStorage.removeItem(JAM_STORAGE_KEY).catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connectionStatus,
    roomPin,
    role,
    partnerName,
    partnerUserId,
    liveToasts,
    hostRoom,
    joinRoom,
    broadcastMessage,
    broadcastLogSet,
    broadcastStartTimer,
    broadcastAddExercise,
    disconnect,
  };
}
