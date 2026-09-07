import type { MealArchetype } from '../types/gymjam';

export const DEFAULT_ARCHETYPES: MealArchetype[] = [
  {
    id: 'arch_shake',
    name: 'Post-Workout Shake',
    emoji: '🥤',
    calories: 307,
    protein: 40,
    carbs: 30,
    fats: 3,
  },
  {
    id: 'arch_chicken_rice',
    name: 'Chicken & Rice Bowl',
    emoji: '🍗',
    calories: 568,
    protein: 50,
    carbs: 65,
    fats: 12,
  },
  {
    id: 'arch_eggs_toast',
    name: 'Eggs & Toast',
    emoji: '🍳',
    calories: 378,
    protein: 24,
    carbs: 30,
    fats: 18,
  },
  {
    id: 'arch_protein_bar',
    name: 'Protein Bar',
    emoji: '🍫',
    calories: 240,
    protein: 20,
    carbs: 22,
    fats: 8,
  },
];
