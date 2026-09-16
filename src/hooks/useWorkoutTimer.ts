import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StoredTimerData,
  UseWorkoutTimerOptions,
  UseWorkoutTimerReturn,
} from '../types/workoutTimer';

const DEFAULT_STORAGE_KEY = '@pumpd_active_workout_timer';

/**
 * Format total seconds into a readable string: HH:MM:SS or MM:SS
 */
export const formatDuration = (totalSec?: number): string => {
  const safeSec = Math.max(0, Math.floor(totalSec || 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
};

/**
 * Background-Resilient Workout Timer Hook (Timestamp-Delta Pattern)
 *
 * Rather than incrementing an integer counter each second (which pauses when the device locks
 * or the app is backgrounded due to OS JavaScript event loop suspension), this hook computes
 * elapsed time on demand from an absolute start timestamp:
 *
 * elapsedSeconds = accumulatedTime + Math.floor((Date.now() - startTime) / 1000)
 */
export function useWorkoutTimer(
  options: UseWorkoutTimerOptions = {}
): UseWorkoutTimerReturn {
  const {
    autoStart = true,
    storageKey = DEFAULT_STORAGE_KEY,
    initialAccumulatedTime = 0,
  } = options;

  // 1. Core state structure
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedTime, setAccumulatedTime] = useState<number>(initialAccumulatedTime);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(initialAccumulatedTime);

  // Synchronized refs to avoid stale closures in interval & AppState listeners
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(initialAccumulatedTime);
  const isRunningRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  /**
   * Pure delta calculator:
   * elapsedSeconds = accumulatedTime + Math.floor((Date.now() - startTime) / 1000)
   */
  const computeCurrentElapsed = useCallback(
    (
      currentStartTime: number | null,
      currentAccumulated: number,
      currentlyRunning: boolean
    ): number => {
      if (!currentlyRunning || currentStartTime === null) {
        return currentAccumulated;
      }
      const delta = Math.max(0, Math.floor((Date.now() - currentStartTime) / 1000));
      return currentAccumulated + delta;
    },
    []
  );

  /**
   * Persist timer data to AsyncStorage
   */
  const persistTimer = useCallback(
    async (data: StoredTimerData) => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      } catch (err) {
        console.warn('Failed to persist workout timer state:', err);
      }
    },
    [storageKey]
  );

  /**
   * Clear timer data from storage
   */
  const removePersistedTimer = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (err) {
      console.warn('Failed to clear workout timer from storage:', err);
    }
  }, [storageKey]);

  /**
   * 3. Interval management:
   * Run 1s interval only while in foreground (AppState === 'active') to keep UI updated
   */
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    intervalRef.current = setInterval(() => {
      if (isRunningRef.current && startTimeRef.current !== null) {
        const current = computeCurrentElapsed(
          startTimeRef.current,
          accumulatedTimeRef.current,
          true
        );
        setElapsedSeconds(current);
      }
    }, 1000);
  }, [stopInterval, computeCurrentElapsed]);

  /**
   * 4. Pause / Resume handling
   */
  const pause = useCallback(() => {
    if (!isRunningRef.current) return;

    stopInterval();

    // Freeze the delta into accumulatedTime
    const delta = startTimeRef.current
      ? Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000))
      : 0;
    const newAccumulated = accumulatedTimeRef.current + delta;

    startTimeRef.current = null;
    accumulatedTimeRef.current = newAccumulated;
    isRunningRef.current = false;

    setStartTime(null);
    setAccumulatedTime(newAccumulated);
    setIsRunning(false);
    setElapsedSeconds(newAccumulated);

    persistTimer({
      startTime: null,
      accumulatedTime: newAccumulated,
      isRunning: false,
      lastUpdated: Date.now(),
    });
  }, [stopInterval, persistTimer]);

  const resume = useCallback(() => {
    if (isRunningRef.current) return;

    const now = Date.now();
    startTimeRef.current = now;
    isRunningRef.current = true;

    setStartTime(now);
    setIsRunning(true);

    // Immediate UI re-render on resume
    const current = computeCurrentElapsed(now, accumulatedTimeRef.current, true);
    setElapsedSeconds(current);

    if (AppState.currentState === 'active') {
      startInterval();
    }

    persistTimer({
      startTime: now,
      accumulatedTime: accumulatedTimeRef.current,
      isRunning: true,
      lastUpdated: now,
    });
  }, [computeCurrentElapsed, startInterval, persistTimer]);

  const start = useCallback(() => {
    if (isRunningRef.current) return;
    resume();
  }, [resume]);

  const togglePauseResume = useCallback(() => {
    if (isRunningRef.current) {
      pause();
    } else {
      resume();
    }
  }, [pause, resume]);

  const reset = useCallback(() => {
    stopInterval();
    startTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    isRunningRef.current = false;

    setStartTime(null);
    setAccumulatedTime(0);
    setIsRunning(false);
    setElapsedSeconds(0);

    removePersistedTimer();
  }, [stopInterval, removePersistedTimer]);

  const stop = useCallback((): number => {
    stopInterval();

    const finalElapsed = computeCurrentElapsed(
      startTimeRef.current,
      accumulatedTimeRef.current,
      isRunningRef.current
    );

    startTimeRef.current = null;
    accumulatedTimeRef.current = finalElapsed;
    isRunningRef.current = false;

    setStartTime(null);
    setAccumulatedTime(finalElapsed);
    setIsRunning(false);
    setElapsedSeconds(finalElapsed);

    removePersistedTimer();
    return finalElapsed;
  }, [stopInterval, computeCurrentElapsed, removePersistedTimer]);

  /**
   * 2. Lifecycle & Foreground Sync (AppState)
   * Recalculates elapsed time from timestamp when returning from background
   */
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const prevAppState = appStateRef.current;
        appStateRef.current = nextAppState;

        if (
          (prevAppState === 'background' || prevAppState === 'inactive') &&
          nextAppState === 'active'
        ) {
          // Returning to foreground: immediate recalculation from wall-clock timestamp
          if (isRunningRef.current && startTimeRef.current !== null) {
            const syncedSeconds = computeCurrentElapsed(
              startTimeRef.current,
              accumulatedTimeRef.current,
              true
            );
            // Force immediate UI re-render so displayed timer matches wall-clock time
            setElapsedSeconds(syncedSeconds);
            startInterval();
          }
        } else if (
          nextAppState === 'background' ||
          nextAppState === 'inactive'
        ) {
          // Transitioning to background: clear interval to conserve battery
          stopInterval();

          // Persist current state
          if (isRunningRef.current) {
            persistTimer({
              startTime: startTimeRef.current,
              accumulatedTime: accumulatedTimeRef.current,
              isRunning: true,
              lastUpdated: Date.now(),
            });
          }
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [computeCurrentElapsed, startInterval, stopInterval, persistTimer]);

  /**
   * 5. Persistence Across App Termination:
   * Restore state on initial mount; if isRunning === true, calculate difference from Date.now()
   */
  useEffect(() => {
    let isMounted = true;

    const hydrateTimer = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!isMounted) return;

        if (stored) {
          const parsed = JSON.parse(stored) as StoredTimerData;
          if (parsed && typeof parsed === 'object') {
            const storedStart =
              typeof parsed.startTime === 'number' ? parsed.startTime : null;
            const storedAcc =
              typeof parsed.accumulatedTime === 'number'
                ? parsed.accumulatedTime
                : 0;
            const storedRunning = Boolean(parsed.isRunning);

            let initialSeconds = storedAcc;
            if (storedRunning && storedStart !== null) {
              const delta = Math.max(
                0,
                Math.floor((Date.now() - storedStart) / 1000)
              );
              initialSeconds = storedAcc + delta;
            }

            startTimeRef.current = storedStart;
            accumulatedTimeRef.current = storedAcc;
            isRunningRef.current = storedRunning;

            setStartTime(storedStart);
            setAccumulatedTime(storedAcc);
            setIsRunning(storedRunning);
            setElapsedSeconds(initialSeconds);

            if (storedRunning && AppState.currentState === 'active') {
              startInterval();
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Error reading stored workout timer:', err);
      }

      // If no stored timer and autoStart is enabled, initialize fresh session
      if (autoStart && !startTimeRef.current && isMounted) {
        const now = Date.now();
        startTimeRef.current = now;
        accumulatedTimeRef.current = initialAccumulatedTime;
        isRunningRef.current = true;

        setStartTime(now);
        setAccumulatedTime(initialAccumulatedTime);
        setIsRunning(true);
        setElapsedSeconds(initialAccumulatedTime);

        persistTimer({
          startTime: now,
          accumulatedTime: initialAccumulatedTime,
          isRunning: true,
          lastUpdated: now,
        });

        if (AppState.currentState === 'active') {
          startInterval();
        }
      }
    };

    hydrateTimer();

    return () => {
      isMounted = false;
      stopInterval();
    };
  }, [storageKey, autoStart, initialAccumulatedTime, startInterval, stopInterval, persistTimer]);

  return {
    startTime,
    accumulatedTime,
    isRunning,
    elapsedSeconds,
    formattedDuration: formatDuration(elapsedSeconds),
    start,
    pause,
    resume,
    togglePauseResume,
    reset,
    stop,
    formatDuration,
  };
}

export default useWorkoutTimer;
