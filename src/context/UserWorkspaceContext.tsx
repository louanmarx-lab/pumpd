import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  Workspace,
  Exercise,
  Split,
  WorkoutLog,
  NutritionLog,
  BodyMetric,
  MacroTargets,
  Meal,
  DayOfWeek,
  DaySchedule,
} from '../types';
import { DEFAULT_EXERCISES } from '../utils/fitness';

interface UserWorkspaceContextType {
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  activeUser: UserProfile;
  activeWorkspace: Workspace;
  exercises: Exercise[];
  splits: Split[];
  workoutLogs: WorkoutLog[];
  nutritionLogs: NutritionLog[];
  bodyMetrics: BodyMetric[];
  
  weeklySchedule: DaySchedule[];
  updateDaySchedule: (
    day: DayOfWeek,
    routineId: string,
    routineName: string,
    exerciseIds?: string[]
  ) => void;
  shiftSplitSchedule: (fromDay: DayOfWeek) => void;
  
  // Actions
  switchActiveUser: (userId: string) => void;
  addExercise: (exercise: Omit<Exercise, 'id'>) => Exercise;
  addSplit: (split: Omit<Split, 'id'>) => Split;
  updateSplit: (split: Split) => void;
  deleteSplit: (splitId: string) => void;
  saveWorkoutLog: (log: Omit<WorkoutLog, 'id'>) => WorkoutLog;
  deleteWorkoutLog: (logId: string) => void;
  saveNutritionMeal: (date: string, meal: Omit<Meal, 'id'>) => void;
  deleteNutritionMeal: (date: string, mealId: string) => void;
  updateMacroTargets: (targets: MacroTargets) => void;
  updateUserName: (userId: string, newDisplayName: string) => void;
  addBodyMetric: (
    weightKg: number,
    bodyFatPercentage?: number,
    skeletalMuscleMassKg?: number,
    date?: string
  ) => void;
  deleteBodyMetric: (metricId: string) => void;
  linkPartnerUser: (partnerName: string, partnerEmail: string) => void;
}

// Initial Demo Accounts & Workspace
const initialCurrentUser: UserProfile = {
  id: 'user_alex',
  displayName: 'Alex Johnson',
  email: 'alex@pumpd.app',
  activeWorkspaceId: 'ws_pumpd_1',
  macroTargets: { calories: 2600, protein: 185, carbs: 275, fats: 80 },
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
};

const initialPartnerUser: UserProfile = {
  id: 'user_jordan',
  displayName: 'Jordan Smith',
  email: 'jordan@pumpd.app',
  activeWorkspaceId: 'ws_pumpd_1',
  macroTargets: { calories: 2300, protein: 160, carbs: 240, fats: 70 },
  createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
};

const initialWorkspace: Workspace = {
  id: 'ws_pumpd_1',
  name: 'Pumpd Training Duo',
  ownerId: 'user_alex',
  memberIds: ['user_alex', 'user_jordan'],
};

// Initial Demo Splits
const initialSplits: Split[] = [
  {
    id: 'split_1',
    userId: 'user_alex',
    name: 'Push / Pull / Legs (PPL)',
    isActive: true,
    routines: [
      { id: 'r_push', name: 'Push Day (Chest, Shoulders, Triceps)', exerciseIds: ['ex_1', 'ex_2', 'ex_13', 'ex_14', 'ex_18'] },
      { id: 'r_pull', name: 'Pull Day (Back & Biceps)', exerciseIds: ['ex_4', 'ex_5', 'ex_6', 'ex_16', 'ex_17'] },
      { id: 'r_legs', name: 'Leg Day (Quads, Hamstrings, Calves)', exerciseIds: ['ex_8', 'ex_9', 'ex_11', 'ex_12', 'ex_20'] },
    ],
  },
  {
    id: 'split_2',
    userId: 'user_jordan',
    name: 'Upper / Lower Hypertrophy',
    isActive: true,
    routines: [
      { id: 'r_upper', name: 'Upper Body A', exerciseIds: ['ex_1', 'ex_5', 'ex_13', 'ex_16', 'ex_18'] },
      { id: 'r_lower', name: 'Lower Body A', exerciseIds: ['ex_8', 'ex_11', 'ex_9', 'ex_20', 'ex_21'] },
    ],
  },
];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const initialAlexSchedule: DaySchedule[] = [
  { day: 'Monday', routineId: 'r_push', routineName: 'Push Day (Chest, Shoulders, Triceps)', exerciseIds: ['ex_1', 'ex_2', 'ex_13', 'ex_14', 'ex_18'] },
  { day: 'Tuesday', routineId: 'r_pull', routineName: 'Pull Day (Back & Biceps)', exerciseIds: ['ex_4', 'ex_5', 'ex_6', 'ex_16', 'ex_17'] },
  { day: 'Wednesday', routineId: 'r_pull', routineName: 'Pull & Core Focus', exerciseIds: ['ex_5', 'ex_6', 'ex_21', 'ex_22'] },
  { day: 'Thursday', routineId: 'r_legs', routineName: 'Leg Day (Quads, Hamstrings, Calves)', exerciseIds: ['ex_8', 'ex_9', 'ex_11', 'ex_12', 'ex_20'] },
  { day: 'Friday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Saturday', routineId: 'r_push', routineName: 'Push Hypertrophy', exerciseIds: ['ex_1', 'ex_3', 'ex_14', 'ex_18'] },
  { day: 'Sunday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
];

const initialJordanSchedule: DaySchedule[] = [
  { day: 'Monday', routineId: 'r_upper', routineName: 'Upper Body A', exerciseIds: ['ex_1', 'ex_5', 'ex_13', 'ex_16', 'ex_18'] },
  { day: 'Tuesday', routineId: 'r_lower', routineName: 'Lower Body A', exerciseIds: ['ex_8', 'ex_11', 'ex_9', 'ex_20', 'ex_21'] },
  { day: 'Wednesday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Thursday', routineId: 'r_upper', routineName: 'Upper Body B', exerciseIds: ['ex_2', 'ex_6', 'ex_14', 'ex_17', 'ex_19'] },
  { day: 'Friday', routineId: 'r_lower', routineName: 'Lower Body B', exerciseIds: ['ex_8', 'ex_12', 'ex_10', 'ex_20', 'ex_22'] },
  { day: 'Saturday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
  { day: 'Sunday', routineId: 'rest', routineName: 'Rest Day', exerciseIds: [] },
];

// Today and recent date helpers (YYYY-MM-DD)
const formatDate = (dateObj: Date) => dateObj.toISOString().split('T')[0];
const todayStr = formatDate(new Date());
const yesterdayStr = formatDate(new Date(Date.now() - 86400000));
const threeDaysAgoStr = formatDate(new Date(Date.now() - 3 * 86400000));
const fiveDaysAgoStr = formatDate(new Date(Date.now() - 5 * 86400000));

// Initial Workout Logs for benchmarks
const initialWorkoutLogs: WorkoutLog[] = [
  {
    id: 'log_alex_1',
    userId: 'user_alex',
    workspaceId: 'ws_pumpd_1',
    splitId: 'split_1',
    routineName: 'Push Day (Chest, Shoulders, Triceps)',
    date: yesterdayStr,
    timestamp: Date.now() - 86400000,
    durationSeconds: 3120, // 52 mins
    exercises: [
      {
        exerciseId: 'ex_1',
        exerciseName: 'Barbell Flat Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 60, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 85, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 90, reps: 6, isCompleted: true },
          { setNumber: 4, type: 'Failure', weightKg: 90, reps: 5, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_13',
        exerciseName: 'Dumbbell Overhead Shoulder Press',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 26, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 28, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Drop', weightKg: 22, reps: 12, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: 'log_alex_2',
    userId: 'user_alex',
    workspaceId: 'ws_pumpd_1',
    splitId: 'split_1',
    routineName: 'Leg Day (Quads, Hamstrings, Calves)',
    date: threeDaysAgoStr,
    timestamp: Date.now() - 3 * 86400000,
    durationSeconds: 2700, // 45 mins
    exercises: [
      {
        exerciseId: 'ex_8',
        exerciseName: 'Barbell Back Squat',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 80, reps: 8, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 110, reps: 6, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 120, reps: 5, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_11',
        exerciseName: 'Romanian Deadlift (RDL)',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 90, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 100, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: 'log_jordan_1',
    userId: 'user_jordan',
    workspaceId: 'ws_pumpd_1',
    splitId: 'split_2',
    routineName: 'Upper Body A',
    date: yesterdayStr,
    timestamp: Date.now() - 86400000,
    durationSeconds: 2400, // 40 mins
    exercises: [
      {
        exerciseId: 'ex_1',
        exerciseName: 'Barbell Flat Bench Press',
        sets: [
          { setNumber: 1, type: 'Warmup', weightKg: 40, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 65, reps: 8, isCompleted: true },
          { setNumber: 3, type: 'Normal', weightKg: 70, reps: 6, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_5',
        exerciseName: 'Lat Pulldown',
        sets: [
          { setNumber: 1, type: 'Normal', weightKg: 55, reps: 10, isCompleted: true },
          { setNumber: 2, type: 'Normal', weightKg: 60, reps: 8, isCompleted: true },
        ],
      },
    ],
  },
];

// Initial Nutrition Logs
const initialNutritionLogs: NutritionLog[] = [
  {
    id: 'nut_alex_today',
    userId: 'user_alex',
    date: todayStr,
    meals: [
      { id: 'm1', label: 'Oatmeal & Protein Shake', calories: 650, protein: 48, carbs: 75, fats: 14, timestamp: Date.now() - 14000000 },
      { id: 'm2', label: 'Chicken & Rice Bowl', calories: 750, protein: 55, carbs: 85, fats: 18, timestamp: Date.now() - 7000000 },
      { id: 'm3', label: 'Greek Yogurt & Almonds', calories: 350, protein: 30, carbs: 25, fats: 12, timestamp: Date.now() - 2000000 },
    ],
  },
  {
    id: 'nut_jordan_today',
    userId: 'user_jordan',
    date: todayStr,
    meals: [
      { id: 'jm1', label: 'Egg White Avocado Toast', calories: 520, protein: 32, carbs: 55, fats: 18, timestamp: Date.now() - 12000000 },
      { id: 'jm2', label: 'Turkey & Sweet Potato', calories: 680, protein: 48, carbs: 70, fats: 20, timestamp: Date.now() - 6000000 },
    ],
  },
];

// Initial Body Metrics
const initialBodyMetrics: BodyMetric[] = [
  { id: 'bm_a1', userId: 'user_alex', date: formatDate(new Date(Date.now() - 14 * 86400000)), weightKg: 82.5, bodyFatPercentage: 15.4, skeletalMuscleMassKg: 39.2 },
  { id: 'bm_a2', userId: 'user_alex', date: formatDate(new Date(Date.now() - 10 * 86400000)), weightKg: 82.2, bodyFatPercentage: 15.1, skeletalMuscleMassKg: 39.4 },
  { id: 'bm_a3', userId: 'user_alex', date: formatDate(new Date(Date.now() - 5 * 86400000)), weightKg: 82.0, bodyFatPercentage: 14.8, skeletalMuscleMassKg: 39.7 },
  { id: 'bm_a4', userId: 'user_alex', date: todayStr, weightKg: 81.8, bodyFatPercentage: 14.6, skeletalMuscleMassKg: 40.0 },
  { id: 'bm_j1', userId: 'user_jordan', date: formatDate(new Date(Date.now() - 14 * 86400000)), weightKg: 68.0, bodyFatPercentage: 22.2, skeletalMuscleMassKg: 28.0 },
  { id: 'bm_j2', userId: 'user_jordan', date: formatDate(new Date(Date.now() - 7 * 86400000)), weightKg: 67.8, bodyFatPercentage: 21.8, skeletalMuscleMassKg: 28.3 },
  { id: 'bm_j3', userId: 'user_jordan', date: todayStr, weightKg: 67.5, bodyFatPercentage: 21.5, skeletalMuscleMassKg: 28.5 },
];

const UserWorkspaceContext = createContext<UserWorkspaceContextType | undefined>(undefined);

export const UserWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialCurrentUser);
  const [partnerUser, setPartnerUser] = useState<UserProfile | null>(initialPartnerUser);
  const [activeUser, setActiveUser] = useState<UserProfile>(initialCurrentUser);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(initialWorkspace);

  const [exercises, setExercises] = useState<Exercise[]>(DEFAULT_EXERCISES);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(initialWorkoutLogs);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>(initialNutritionLogs);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>(initialBodyMetrics);

  const [userSchedules, setUserSchedules] = useState<Record<string, DaySchedule[]>>({
    user_alex: initialAlexSchedule,
    user_jordan: initialJordanSchedule,
  });

  const activeWeeklySchedule = userSchedules[activeUser.id] || initialAlexSchedule;

  const updateDaySchedule = (
    day: DayOfWeek,
    routineId: string,
    routineName: string,
    exerciseIds: string[] = []
  ) => {
    setUserSchedules((prev) => {
      const current = prev[activeUser.id] || initialAlexSchedule;
      const updated = current.map((item) =>
        item.day === day
          ? { ...item, routineId, routineName, exerciseIds }
          : item
      );
      return { ...prev, [activeUser.id]: updated };
    });
  };

  const shiftSplitSchedule = (fromDay: DayOfWeek) => {
    setUserSchedules((prev) => {
      const current = prev[activeUser.id] || initialAlexSchedule;
      const fromIdx = DAYS_OF_WEEK.indexOf(fromDay);
      if (fromIdx === -1) return prev;

      const updated = [...current];
      const routinesToShift = updated.slice(fromIdx).map((item) => ({
        routineId: item.routineId,
        routineName: item.routineName,
        exerciseIds: item.exerciseIds,
      }));

      // Set fromDay to rest
      updated[fromIdx] = {
        ...updated[fromIdx],
        routineId: 'rest',
        routineName: 'Rest Day',
        exerciseIds: [],
      };

      // Shift subsequent routines forward by 1 day
      for (let i = fromIdx + 1; i < DAYS_OF_WEEK.length; i++) {
        const shiftedItem = routinesToShift[i - (fromIdx + 1)];
        updated[i] = {
          ...updated[i],
          routineId: shiftedItem.routineId,
          routineName: shiftedItem.routineName,
          exerciseIds: shiftedItem.exerciseIds,
        };
      }

      return { ...prev, [activeUser.id]: updated };
    });
  };

  const switchActiveUser = (userId: string) => {
    if (userId === currentUser.id) {
      setActiveUser(currentUser);
    } else if (partnerUser && userId === partnerUser.id) {
      setActiveUser(partnerUser);
    }
  };

  const addExercise = (newEx: Omit<Exercise, 'id'>): Exercise => {
    const exercise: Exercise = {
      ...newEx,
      id: `ex_custom_${Date.now()}`,
    };
    setExercises((prev) => [exercise, ...prev]);
    return exercise;
  };

  const addSplit = (newSplit: Omit<Split, 'id'>): Split => {
    const split: Split = {
      ...newSplit,
      id: `split_${Date.now()}`,
    };
    setSplits((prev) => {
      // If setting this split to active, deactivate other splits for activeUser
      const updated = split.isActive
        ? prev.map((s) => (s.userId === split.userId ? { ...s, isActive: false } : s))
        : [...prev];
      return [split, ...updated];
    });
    return split;
  };

  const updateSplit = (updatedSplit: Split) => {
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id === updatedSplit.id) return updatedSplit;
        if (updatedSplit.isActive && s.userId === updatedSplit.userId) {
          return { ...s, isActive: false };
        }
        return s;
      })
    );
  };

  const deleteSplit = (splitId: string) => {
    setSplits((prev) => prev.filter((s) => s.id !== splitId));
  };

  const saveWorkoutLog = (newLog: Omit<WorkoutLog, 'id'>): WorkoutLog => {
    const log: WorkoutLog = {
      ...newLog,
      id: `log_${Date.now()}`,
    };
    setWorkoutLogs((prev) => [log, ...prev]);
    return log;
  };

  const deleteWorkoutLog = (logId: string) => {
    setWorkoutLogs((prev) => prev.filter((l) => l.id !== logId));
  };

  const saveNutritionMeal = (date: string, mealData: Omit<Meal, 'id'>) => {
    const meal: Meal = {
      ...mealData,
      id: `meal_${Date.now()}`,
      timestamp: Date.now(),
    };

    setNutritionLogs((prev) => {
      const existingLogIndex = prev.findIndex(
        (l) => l.userId === activeUser.id && l.date === date
      );

      if (existingLogIndex >= 0) {
        const updated = [...prev];
        const currentLog = updated[existingLogIndex];
        updated[existingLogIndex] = {
          ...currentLog,
          meals: [...currentLog.meals, meal],
        };
        return updated;
      } else {
        const newLog: NutritionLog = {
          id: `nut_${activeUser.id}_${date}`,
          userId: activeUser.id,
          date,
          meals: [meal],
        };
        return [newLog, ...prev];
      }
    });
  };

  const deleteNutritionMeal = (date: string, mealId: string) => {
    setNutritionLogs((prev) =>
      prev.map((l) => {
        if (l.userId === activeUser.id && l.date === date) {
          return {
            ...l,
            meals: l.meals.filter((m) => m.id !== mealId),
          };
        }
        return l;
      })
    );
  };

  const updateMacroTargets = (newTargets: MacroTargets) => {
    const updatedUser = { ...activeUser, macroTargets: newTargets };
    setActiveUser(updatedUser);
    if (activeUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
    } else if (partnerUser && activeUser.id === partnerUser.id) {
      setPartnerUser(updatedUser);
    }
  };

  const updateUserName = (userId: string, newDisplayName: string) => {
    const trimmed = newDisplayName.trim();
    if (!trimmed) return;
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, displayName: trimmed }));
    }
    if (partnerUser && partnerUser.id === userId) {
      setPartnerUser((prev) => (prev ? { ...prev, displayName: trimmed } : null));
    }
    if (activeUser.id === userId) {
      setActiveUser((prev) => ({ ...prev, displayName: trimmed }));
    }
  };

  const addBodyMetric = (
    weightKg: number,
    bodyFatPercentage?: number,
    skeletalMuscleMassKg?: number,
    date: string = todayStr
  ) => {
    const metric: BodyMetric = {
      id: `bm_${Date.now()}`,
      userId: activeUser.id,
      date,
      weightKg,
      bodyFatPercentage,
      skeletalMuscleMassKg,
    };
    setBodyMetrics((prev) => [metric, ...prev]);
  };

  const deleteBodyMetric = (metricId: string) => {
    setBodyMetrics((prev) => prev.filter((m) => m.id !== metricId));
  };

  const linkPartnerUser = (partnerName: string, partnerEmail: string) => {
    const newPartner: UserProfile = {
      id: `user_partner_${Date.now()}`,
      displayName: partnerName,
      email: partnerEmail,
      activeWorkspaceId: activeWorkspace.id,
      macroTargets: { calories: 2200, protein: 150, carbs: 220, fats: 65 },
      createdAt: Date.now(),
    };
    setPartnerUser(newPartner);
    setActiveWorkspace((prev) => ({
      ...prev,
      memberIds: [...prev.memberIds, newPartner.id],
    }));
  };

  return (
    <UserWorkspaceContext.Provider
      value={{
        currentUser,
        partnerUser,
        activeUser,
        activeWorkspace,
        exercises,
        splits,
        workoutLogs,
        nutritionLogs,
        bodyMetrics,
        weeklySchedule: activeWeeklySchedule,
        updateDaySchedule,
        shiftSplitSchedule,
        switchActiveUser,
        addExercise,
        addSplit,
        updateSplit,
        deleteSplit,
        saveWorkoutLog,
        deleteWorkoutLog,
        saveNutritionMeal,
        deleteNutritionMeal,
        updateMacroTargets,
        updateUserName,
        addBodyMetric,
        deleteBodyMetric,
        linkPartnerUser,
      }}
    >
      {children}
    </UserWorkspaceContext.Provider>
  );
};

export const useUserWorkspace = () => {
  const context = useContext(UserWorkspaceContext);
  if (!context) {
    throw new Error('useUserWorkspace must be used within a UserWorkspaceProvider');
  }
  return context;
};
