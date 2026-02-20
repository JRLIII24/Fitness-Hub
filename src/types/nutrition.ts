export interface FoodItem {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  serving_size_g: number | null;
  serving_description: string | null;
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: string | null;
}

export interface FoodLogEntry {
  id: string;
  user_id: string;
  food_item_id: string;
  food_item?: FoodItem;
  logged_at: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
}

export interface NutritionGoals {
  id: string;
  user_id: string;
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  effective_from: string;
}

export interface DailyNutritionSummary {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entries: FoodLogEntry[];
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
