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
    recipe: '1.5 scoops whey protein, 1 medium banana, 300ml almond milk, 5g creatine',
  },
  {
    id: 'arch_chicken_rice',
    name: 'Chicken & Rice Bowl',
    emoji: '🍗',
    calories: 568,
    protein: 50,
    carbs: 65,
    fats: 12,
    recipe: '200g grilled chicken breast, 150g cooked jasmine rice, 100g steamed broccoli, 1 tsp olive oil',
  },
  {
    id: 'arch_eggs_toast',
    name: 'Eggs & Toast',
    emoji: '🍳',
    calories: 378,
    protein: 24,
    carbs: 30,
    fats: 18,
    recipe: '3 whole eggs scrambled, 2 slices whole wheat toast, 10g butter',
  },
  {
    id: 'arch_protein_bar',
    name: 'Protein Bar',
    emoji: '🍫',
    calories: 240,
    protein: 20,
    carbs: 22,
    fats: 8,
    recipe: '1 high-protein snack bar',
  },
];
