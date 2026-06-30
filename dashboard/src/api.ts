import type { DashboardData, DayData, FoodEntryInput, WeightEntryInput } from "./types";

const configuredBaseUrl = (import.meta.env.VITE_WORKER_API_URL as string | undefined) ?? "/api";
const apiBaseUrl = configuredBaseUrl.replace(/\/$/, "");

type ApiOptions = {
  token: string;
  method?: string;
  body?: unknown;
};

export async function getDashboard(token: string): Promise<DashboardData> {
  return apiRequest<DashboardData>("/dashboard", { token });
}

export async function getDay(token: string, date: string): Promise<DayData> {
  return apiRequest<DayData>(`/day?date=${encodeURIComponent(date)}`, { token });
}

export async function createFoodEntry(token: string, body: FoodEntryInput) {
  return apiRequest("/food-entry", { token, method: "POST", body });
}

export async function updateFoodEntry(token: string, id: string, body: Partial<FoodEntryInput>) {
  return apiRequest(`/food-entry/${id}`, { token, method: "PATCH", body });
}

export async function deleteFoodEntry(token: string, id: string) {
  return apiRequest(`/food-entry/${id}`, { token, method: "DELETE" });
}

export async function createWeightEntry(token: string, body: WeightEntryInput) {
  return apiRequest("/weight-entry", { token, method: "POST", body });
}

export async function updateWeightEntry(token: string, id: string, body: Partial<WeightEntryInput>) {
  return apiRequest(`/weight-entry/${id}`, { token, method: "PATCH", body });
}

export async function deleteWeightEntry(token: string, id: string) {
  return apiRequest(`/weight-entry/${id}`, { token, method: "DELETE" });
}

export async function deleteAllData(token: string, confirmation: string) {
  return apiRequest("/delete-all-data", { token, method: "POST", body: { confirmation } });
}

async function apiRequest<T>(path: string, options: ApiOptions): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${options.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
