export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink" | "other";
export type EntryType = "Core" | "Junk" | "Alcohol" | "Eating Out";
export type Confidence = "high" | "medium" | "low";

export type NutritionTotals = {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  junk_calories: number;
  alcohol_calories: number;
  eating_out_calories: number;
  entries_count: number;
};

export type FoodEntry = {
  id: string;
  logged_at: string;
  consumption_date: string;
  consumption_time: string | null;
  meal_type: MealType | null;
  entry_type: EntryType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence | null;
  source: string;
  notes: string | null;
};

export type WeightEntry = {
  id: string;
  date: string;
  weight_kg: number;
  note: string | null;
};

export type UserProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  timezone: string;
};

export type DashboardData = {
  user: UserProfile;
  today: {
    date: string;
    totals: NutritionTotals;
    food_entries: FoodEntry[];
    latest_weight: WeightEntry | null;
  };
  yesterday: {
    date: string;
    totals: NutritionTotals;
    food_entries: FoodEntry[];
  };
  last_14_days: {
    start_date: string;
    end_date: string;
    days: NutritionTotals[];
    averages: Omit<NutritionTotals, "date">;
  };
  recent_food_entries: FoodEntry[];
  recent_weight_entries: WeightEntry[];
  insights: {
    days_logged: number;
    highest_calorie_day: NutritionTotals | null;
    lowest_calorie_day: NutritionTotals | null;
    logged_days_last_7_days: number;
    logged_days_previous_7_days: number;
    avg_calories_last_7_days: number;
    avg_calories_previous_7_days: number;
    calorie_trend_delta: number;
    avg_protein_last_7_days: number;
    avg_protein_previous_7_days: number;
    protein_trend_delta: number;
    weight_latest: WeightEntry | null;
    weight_previous: WeightEntry | null;
    weight_delta: number | null;
  };
};

export type DayData = {
  user: UserProfile;
  date: string;
  totals: NutritionTotals;
  food_entries: FoodEntry[];
  weight_entry: WeightEntry | null;
};

export type FoodEntryInput = {
  description: string;
  consumption_date: string;
  consumption_time?: string | null;
  meal_type?: MealType | null;
  entry_type: EntryType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: Confidence | null;
  notes?: string | null;
};

export type WeightEntryInput = {
  date: string;
  weight_kg: number;
  note?: string | null;
};
