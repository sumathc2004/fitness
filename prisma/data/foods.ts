// Starter food library (reference data). Values are common published approximations per the stated serving;
// admins and trainers can edit or add foods in the app. They are estimates, not lab-measured values.
export interface SeedFood {
  name: string;
  category: string;
  cuisine?: string;
  servings: Array<{ label: string; grams?: number; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; isDefault?: boolean }>;
}

const s = (label: string, grams: number | undefined, calories: number, proteinG: number, carbsG: number, fatG: number, fiberG: number, isDefault = true) => ({
  label, grams, calories, proteinG, carbsG, fatG, fiberG, isDefault,
});

export const FOODS: SeedFood[] = [
  // Staples & grains
  { name: 'White rice, cooked', category: 'Grains', cuisine: 'Indian', servings: [s('1 cup (158 g)', 158, 205, 4.3, 44.5, 0.4, 0.6), s('100 g', 100, 130, 2.7, 28, 0.3, 0.4, false)] },
  { name: 'Roti / chapati (whole wheat)', category: 'Grains', cuisine: 'Indian', servings: [s('1 medium (40 g)', 40, 104, 3.2, 18.5, 2, 2.5)] },
  { name: 'Oats, dry', category: 'Grains', servings: [s('40 g', 40, 152, 5.3, 27, 2.6, 4), s('100 g', 100, 379, 13, 67, 6.5, 10, false)] },
  { name: 'Idli', category: 'Grains', cuisine: 'Indian', servings: [s('1 piece (40 g)', 40, 58, 2, 12, 0.4, 0.7)] },
  { name: 'Dosa, plain', category: 'Grains', cuisine: 'Indian', servings: [s('1 medium (90 g)', 90, 168, 3.9, 29, 3.7, 1)] },
  { name: 'Sweet potato, baked', category: 'Vegetables', servings: [s('1 medium (114 g)', 114, 103, 2.3, 24, 0.2, 3.8)] },
  // Protein
  { name: 'Egg, whole, boiled', category: 'Protein', servings: [s('1 large (50 g)', 50, 78, 6.3, 0.6, 5.3, 0)] },
  { name: 'Egg white, boiled', category: 'Protein', servings: [s('1 large (33 g)', 33, 17, 3.6, 0.2, 0.1, 0)] },
  { name: 'Chicken breast, cooked', category: 'Protein', servings: [s('100 g', 100, 165, 31, 0, 3.6, 0), s('150 g', 150, 248, 46.5, 0, 5.4, 0, false)] },
  { name: 'Fish (rohu), cooked', category: 'Protein', cuisine: 'Indian', servings: [s('100 g', 100, 128, 21, 0, 4.4, 0)] },
  { name: 'Paneer', category: 'Protein', cuisine: 'Indian', servings: [s('100 g', 100, 265, 18, 1.2, 20.8, 0), s('50 g', 50, 133, 9, 0.6, 10.4, 0, false)] },
  { name: 'Tofu, firm', category: 'Protein', servings: [s('100 g', 100, 76, 8, 1.9, 4.8, 0.3)] },
  { name: 'Whey protein powder', category: 'Supplements', servings: [s('1 scoop (30 g)', 30, 120, 24, 3, 1.5, 0)] },
  // Pulses
  { name: 'Dal (toor), cooked', category: 'Pulses', cuisine: 'Indian', servings: [s('1 cup (200 g)', 200, 205, 11.5, 35, 1.5, 8)] },
  { name: 'Chickpeas (chana), cooked', category: 'Pulses', cuisine: 'Indian', servings: [s('1 cup (164 g)', 164, 269, 14.5, 45, 4.2, 12.5)] },
  // Dairy
  { name: 'Milk, whole', category: 'Dairy', servings: [s('1 cup (240 ml)', 240, 149, 7.7, 11.7, 8, 0)] },
  { name: 'Curd / dahi, plain', category: 'Dairy', cuisine: 'Indian', servings: [s('100 g', 100, 61, 3.5, 4.7, 3.3, 0), s('1 bowl (150 g)', 150, 92, 5.3, 7, 5, 0, false)] },
  // Fruit, veg, nuts
  { name: 'Banana', category: 'Fruit', servings: [s('1 medium (118 g)', 118, 105, 1.3, 27, 0.4, 3.1)] },
  { name: 'Apple', category: 'Fruit', servings: [s('1 medium (182 g)', 182, 95, 0.5, 25, 0.3, 4.4)] },
  { name: 'Spinach, cooked', category: 'Vegetables', servings: [s('1 cup (180 g)', 180, 41, 5.3, 6.8, 0.5, 4.3)] },
  { name: 'Broccoli, cooked', category: 'Vegetables', servings: [s('1 cup (156 g)', 156, 55, 3.7, 11, 0.6, 5.1)] },
  { name: 'Almonds', category: 'Nuts & seeds', servings: [s('28 g (about 23)', 28, 164, 6, 6, 14, 3.5)] },
  { name: 'Peanuts', category: 'Nuts & seeds', servings: [s('28 g', 28, 161, 7.3, 4.6, 14, 2.4)] },
  { name: 'Peanut butter', category: 'Nuts & seeds', servings: [s('1 tbsp (16 g)', 16, 94, 3.6, 3.2, 8, 1)] },
  // Fats
  { name: 'Ghee', category: 'Fats & oils', cuisine: 'Indian', servings: [s('1 tsp (5 g)', 5, 45, 0, 0, 5, 0)] },
  { name: 'Olive oil', category: 'Fats & oils', servings: [s('1 tbsp (14 g)', 14, 119, 0, 0, 13.5, 0)] },
];
