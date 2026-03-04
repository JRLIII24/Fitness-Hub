export interface FoodEstimationItem {
  name: string;
  estimated_grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "high" | "medium" | "low";
}

export interface FoodEstimation {
  items: FoodEstimationItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  meal_description: string;
}
