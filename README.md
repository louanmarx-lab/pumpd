# DuoFit – Gym & Macro Tracker (Expo / React Native + Firebase)

DuoFit is a modern, offline-first mobile application built with **Expo SDK (React Native)**, **TypeScript**, **NativeWind (Tailwind CSS)**, and **Firebase (Cloud Firestore + Auth)**.

Designed specifically for workout partners sharing a single physical device during training sessions, DuoFit features instant header user switching, live training tracking with tactile haptic feedback, real-time benchmark calculations (Brzycki 1RM estimates, previous session history, rep PRs), fast macro logging, and progress analytics.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Development Server
```bash
npm start
# or
npx expo start
```

Press `i` for iOS Simulator, `a` for Android Emulator, or `w` for Web.

---

## ✨ Features & Architecture

### 1. Dual-User Workspace Switching
- **Instant Top Bar Switcher**: Header component (`HeaderSwitcher`) allows training partners on a shared physical device to switch active personas instantly.
- All live workout logs, set histories, PR badges, target macros, and analytics instantly re-contextualize to the selected user.
- **Auto-Provisioned Demo Partner**: Includes pre-configured demo partner profile ("Jordan Smith") so partner switching can be tested offline immediately without needing two devices.

### 2. Live Training Session (`app/active-session.tsx`)
- **Keep-Awake Integration**: Keeps device screen active during workout sessions (`expo-keep-awake`).
- **Benchmark References**: Displayed on each exercise card:
  1. *Previous Session Stats*: Exact weights, reps, and sets completed on the last logged workout date.
  2. *Rep PR at Weight*: Max reps achieved at the current weight input.
  3. *Estimated 1RM*: Calculated via Brzycki formula: `1RM = Weight * (1 + Reps / 30)`.
- **Set Entry Rows**: Set badges with color-coded type pickers (`Normal`, `Warmup`, `Drop`, `Failure`), weight input, reps input, and set completion checkboxes with **Haptic Feedback** (`expo-haptics`).

### 3. Quick-Entry Nutrition & Macro Tracker (`app/(tabs)/nutrition/index.tsx`)
- Visual progress bars for consumed vs. target **Calories**, **Protein**, **Carbs**, and **Fats**.
- **Fast Entry Modal**: Rapid entry for Meal Label, Calories, Protein, Carbs, and Fats.
- Swipeable daily meal logs and date switcher (inspect/backfill previous days).

### 4. Progress Analytics Hub (`app/(tabs)/analytics/index.tsx`)
- **1-Rep Max Trends**: Line charts tracking 1RM progression over time for major benchmark lifts (Bench Press, Squat, Deadlift, Overhead Press).
- **7-Day Muscle Volume Chart**: Aggregates working sets (`Normal`, `Drop`, `Failure`) per muscle group across a rolling 7-day window.
- **Body Weight Tracker**: Weigh-in history log and modal.

### 5. Offline-First Firebase Configuration (`src/config/firebase.ts`)
- Configured with `initializeFirestore(app, { localCache: persistentLocalCache() })` for zero-latency local caching during gym workouts.

---

## 🎨 UI/UX Design System
Designed based on `uiux-designer` recommendations for a dark gym aesthetic:
- **Background**: `#09090B` (Dark Obsidian)
- **Cards**: `#18181B` / `#27272A`
- **Primary Accent**: `#FF6B35` (Energetic Flame Orange)
- **Success Accent**: `#10B981` (Emerald Green)
- **Touch Targets**: ≥44px height for touch inputs.
