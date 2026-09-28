import { Split, Exercise, Routine } from '../types';

export interface PresetSplitTemplate {
  id: string;
  name: string;
  tag: string;
  daysPerWeek: number;
  description: string;
  badgeColor: string;
  schedulePattern: string[]; // e.g., ['Upper Body', 'Lower Body', 'Rest', 'Push Day', 'Pull Day', 'Leg Day', 'Rest']
  routines: {
    name: string;
    description?: string;
    exerciseNames: string[];
  }[];
}

export const PRESET_SPLITS: PresetSplitTemplate[] = [
  {
    id: 'preset_ul_ppl',
    name: 'Upper / Lower / Rest / Push / Pull / Legs / Rest',
    tag: '5-Day Hybrid Peak Split',
    daysPerWeek: 5,
    badgeColor: '#06B6D4',
    description:
      'The ultimate hybrid split requested by lifters: Upper & Lower power days, followed by a mid-week rest, into a high-hypertrophy Push, Pull, Legs sequence and weekend rest.',
    schedulePattern: [
      'Upper Body Power',
      'Lower Body Power',
      'Rest Day',
      'Push Hypertrophy',
      'Pull Hypertrophy',
      'Leg Hypertrophy',
      'Rest Day',
    ],
    routines: [
      {
        name: 'Upper Body Power',
        description: 'Heavy compound upper body focus (chest, lats, delts, arms)',
        exerciseNames: [
          'Barbell Flat Bench Press',
          'Barbell Bent-Over Row',
          'Dumbbell Overhead Shoulder Press',
          'Pull-ups',
          'Barbell Standing Bicep Curl',
          'EZ-Bar Skull Crushers',
        ],
      },
      {
        name: 'Lower Body Power',
        description: 'Heavy compound quad and hamstring posterior chain power',
        exerciseNames: [
          'Barbell Back Squat',
          'Romanian Deadlift (RDL)',
          'Leg Press',
          'Standing Calf Raise',
          'Hanging Leg Raise',
        ],
      },
      {
        name: 'Push Hypertrophy',
        description: 'High volume chest, front/side delts, and triceps pump',
        exerciseNames: [
          'Incline Dumbbell Press',
          'Machine Shoulder Press',
          'Machine Side Raise',
          'Cable Crossover',
          'Cable Push Downs',
          'Machine Dips',
        ],
      },
      {
        name: 'Pull Hypertrophy',
        description: 'Back width, thickness, rear delts, and peak biceps pump',
        exerciseNames: [
          'Lat Pulldown',
          'Chest-Supported T-Bar Row',
          'Cable Rear Delt Crossovers',
          'Preacher Curl',
          'Hammer Preacher Curl',
        ],
      },
      {
        name: 'Leg Hypertrophy',
        description: 'Quad isolation, hamstring curls, and glute emphasis',
        exerciseNames: [
          'Machine Squat',
          'Bulgarian Split Squat',
          'Leg Extensions',
          'Seated Leg Curl',
          'Seated Calf Raise',
        ],
      },
    ],
  },
  {
    id: 'preset_hypertrophy_ppl',
    name: 'Ultimate Push / Pull / Legs (PPL)',
    tag: 'Science-Based Hypertrophy',
    daysPerWeek: 6,
    badgeColor: '#10B981',
    description:
      'Science-backed 6-day split alternating between A & B variations to target every muscle head through stretched-load mechanics and progressive overload.',
    schedulePattern: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B', 'Rest Day'],
    routines: [
      {
        name: 'Push A (Chest & Triceps Focus)',
        exerciseNames: [
          'Barbell Flat Bench Press',
          'Incline Dumbbell Press',
          'Machine Shoulder Press',
          'Cable Crossover',
          'Cable Push Downs',
        ],
      },
      {
        name: 'Pull A (Lat & Upper Back Focus)',
        exerciseNames: [
          'Pull-ups',
          'Chest-Supported T-Bar Row',
          'Face Pulls',
          'Preacher Curl',
          'Dumbbell Hammer Curls',
        ],
      },
      {
        name: 'Legs A (Quad & Calf Focus)',
        exerciseNames: [
          'Barbell Back Squat',
          'Machine Squat',
          'Leg Extensions',
          'Romanian Deadlift (RDL)',
          'Standing Calf Raise',
        ],
      },
      {
        name: 'Push B (Shoulder & Upper Chest Focus)',
        exerciseNames: [
          'Barbell Overhead Press (OHP)',
          'Incline Barbell Bench Press',
          'Machine Side Raise',
          'Machine Dips',
          'Overhead Cable Tricep Extension',
        ],
      },
      {
        name: 'Pull B (Back Thickness & Biceps Focus)',
        exerciseNames: [
          'Barbell Conventional Deadlift',
          'Seated Cable Row',
          'Cable Rear Delt Crossovers',
          'Barbell Hammer Curl',
          'Incline Dumbbell Bicep Curl',
        ],
      },
      {
        name: 'Legs B (Hamstrings & Glutes Focus)',
        exerciseNames: [
          'Dumbbell Romanian Deadlift',
          'Seated Leg Curl',
          'Leg Press',
          'Bulgarian Split Squat',
          'Seated Calf Raise',
        ],
      },
    ],
  },
  {
    id: 'preset_power_upper_lower',
    name: '4-Day Powerbuilding Upper / Lower',
    tag: 'Strength & Hypertrophy',
    daysPerWeek: 4,
    badgeColor: '#F59E0B',
    description:
      'Ideal for optimal muscle recovery with 3 rest days weekly. Alternates between high-tension mechanical work and high-volume metabolic fatigue sessions.',
    schedulePattern: ['Upper A', 'Lower A', 'Rest Day', 'Upper B', 'Lower B', 'Rest Day', 'Rest Day'],
    routines: [
      {
        name: 'Upper A (Heavy Power)',
        exerciseNames: [
          'Barbell Flat Bench Press',
          'Barbell Bent-Over Row',
          'Barbell Overhead Press (OHP)',
          'Pull-ups',
          'EZ-Bar Skull Crushers',
        ],
      },
      {
        name: 'Lower A (Quad Focus)',
        exerciseNames: [
          'Barbell Back Squat',
          'Leg Press',
          'Lying Leg Curl',
          'Standing Calf Raise',
          'Hanging Leg Raise',
        ],
      },
      {
        name: 'Upper B (Hypertrophy Focus)',
        exerciseNames: [
          'Incline Dumbbell Press',
          'Lat Pulldown',
          'Machine Side Raise',
          'Cable Rear Delt Crossovers',
          'Preacher Curl',
          'Cable Push Downs',
        ],
      },
      {
        name: 'Lower B (Posterior Chain Focus)',
        exerciseNames: [
          'Romanian Deadlift (RDL)',
          'Bulgarian Split Squat',
          'Leg Extensions',
          'Seated Leg Curl',
          'Seated Calf Raise',
        ],
      },
    ],
  },
  {
    id: 'preset_golden_era_split',
    name: 'Golden Era Antagonist Split',
    tag: 'Bodybuilding Classic',
    daysPerWeek: 6,
    badgeColor: '#EC4899',
    description:
      'The classic bodybuilding antagonist paired split (Chest/Back, Shoulders/Arms, Legs) that builds deep chest expansion and sleeve-ripping pumps.',
    schedulePattern: ['Chest & Back', 'Shoulders & Arms', 'Legs & Calves', 'Chest & Back', 'Shoulders & Arms', 'Legs & Calves', 'Rest Day'],
    routines: [
      {
        name: 'Chest & Back',
        exerciseNames: [
          'Barbell Flat Bench Press',
          'Incline Barbell Bench Press',
          'Cable Crossover',
          'Pull-ups',
          'Barbell Bent-Over Row',
          'Seated Cable Row',
        ],
      },
      {
        name: 'Shoulders & Arms',
        exerciseNames: [
          'Dumbbell Overhead Shoulder Press',
          'Lateral Raises',
          'Cable Rear Delt Crossovers',
          'Barbell Standing Bicep Curl',
          'Incline Dumbbell Bicep Curl',
          'EZ-Bar Skull Crushers',
          'Cable Push Downs',
        ],
      },
      {
        name: 'Legs & Calves',
        exerciseNames: [
          'Barbell Back Squat',
          'Leg Press',
          'Leg Extensions',
          'Romanian Deadlift (RDL)',
          'Standing Calf Raise',
          'Cable Kneeling Crunch',
        ],
      },
    ],
  },
  {
    id: 'preset_classic_bro_split',
    name: 'Classic 5-Day Bodypart Split',
    tag: 'Targeted Isolation',
    daysPerWeek: 5,
    badgeColor: '#8B5CF6',
    description:
      'The time-tested bodybuilding bodypart split: completely exhaust one muscle group per day with dedicated recovery for maximum local hypertrophy.',
    schedulePattern: ['Chest Day', 'Back Day', 'Shoulder Day', 'Leg Day', 'Arm Day', 'Rest Day', 'Rest Day'],
    routines: [
      {
        name: 'Monday: Chest Destruction',
        exerciseNames: [
          'Barbell Flat Bench Press',
          'Incline Dumbbell Press',
          'Chest-Supported Machine Press',
          'Cable Crossover',
          'Machine Dips',
        ],
      },
      {
        name: 'Tuesday: Back Thickness & Width',
        exerciseNames: [
          'Barbell Conventional Deadlift',
          'Lat Pulldown',
          'Barbell Bent-Over Row',
          'Chest-Supported T-Bar Row',
          'Straight-Arm Lat Pulldown (Cable Pullover)',
        ],
      },
      {
        name: 'Wednesday: 3D Shoulders & Traps',
        exerciseNames: [
          'Machine Shoulder Press',
          'Machine Side Raise',
          'Cable Lateral Raise',
          'Cable Rear Delt Crossovers',
          'Face Pulls',
        ],
      },
      {
        name: 'Thursday: Quads, Hams & Calves',
        exerciseNames: [
          'Barbell Back Squat',
          'Machine Squat',
          'Leg Extensions',
          'Seated Leg Curl',
          'Romanian Deadlift (RDL)',
          'Standing Calf Raise',
        ],
      },
      {
        name: 'Friday: Biceps & Triceps Blast',
        exerciseNames: [
          'EZ-Bar Preacher Curl',
          'Hammer Preacher Curl',
          'Barbell Hammer Curl',
          'Cable Push Downs',
          'Overhead Cable Tricep Extension',
          'EZ-Bar Skull Crushers',
        ],
      },
    ],
  },
];

/**
 * Builds a concrete Split object from a template, mapping exercise names to IDs
 */
export function buildSplitFromPreset(
  preset: PresetSplitTemplate,
  userId: string,
  exercises: Exercise[],
  isActive: boolean = true
): Split {
  const nameToIdMap = new Map<string, string>();
  exercises.forEach((ex) => {
    nameToIdMap.set(ex.name.toLowerCase().trim(), ex.id);
  });

  const routines: Routine[] = preset.routines.map((r, idx) => {
    const exerciseIds: string[] = [];

    r.exerciseNames.forEach((exName) => {
      const matchId = nameToIdMap.get(exName.toLowerCase().trim());
      if (matchId) {
        exerciseIds.push(matchId);
      } else {
        // Fallback: find partial match
        const partial = exercises.find((e) =>
          e.name.toLowerCase().includes(exName.toLowerCase()) ||
          exName.toLowerCase().includes(e.name.toLowerCase())
        );
        if (partial) {
          exerciseIds.push(partial.id);
        }
      }
    });

    return {
      id: `r_${preset.id}_${idx + 1}_${Date.now().toString(36)}`,
      name: r.name,
      exerciseIds,
    };
  });

  return {
    id: `split_${preset.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    name: preset.name,
    description: preset.description,
    routines,
    isActive,
    isStarred: false,
  };
}

/**
 * Builds all standard preset splits for a given user, with one preset set active
 */
export function buildAllPresetSplits(
  userId: string,
  exercises: Exercise[],
  activePresetId: string = 'preset_classic_bro_split'
): Split[] {
  return PRESET_SPLITS.map((preset) =>
    buildSplitFromPreset(
      preset,
      userId,
      exercises,
      preset.id === activePresetId
    )
  );
}
