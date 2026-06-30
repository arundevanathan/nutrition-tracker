import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronLeft,
  Edit3,
  LineChart,
  List,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Utensils,
  Weight,
} from "lucide-react";
import {
  createFoodEntry,
  createWeightEntry,
  deleteAllData,
  deleteFoodEntry,
  deleteWeightEntry,
  getDashboard,
  getDay,
  updateFoodEntry,
  updateWeightEntry,
} from "./api";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase";
import type { DashboardData, DayData, EntryType, FoodEntry, FoodEntryInput, MealType, WeightEntryInput } from "./types";

type View = "today" | "trends" | "entries" | "settings";
type FoodFormState = {
  mode: "create" | "edit";
  entry?: FoodEntry;
  values: FoodEntryInput;
};

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack", "drink", "other"];
const entryTypes: EntryType[] = ["Core", "Junk", "Alcohol", "Eating Out"];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>("today");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<FoodFormState | null>(null);
  const [weightSaving, setWeightSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => (hasSupabaseConfig() ? getSupabaseClient() : null), []);
  const token = session?.access_token ?? null;
  const selectedDay = selectedDate ? dayData : null;

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setAuthLoading(false);
      return;
    }

    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    initializeSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();

    async function initializeSession() {
      const hashSession = sessionFromHash();

      if (hashSession) {
        const { data, error: setSessionError } = await supabase!.auth.setSession(hashSession);
        if (setSessionError) {
          setError(setSessionError.message);
        } else {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          setSession(data.session);
        }
        setAuthLoading(false);
        return;
      }

      const { data } = await supabase!.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!token) {
      setDashboard(null);
      setDayData(null);
      return;
    }
    void loadDashboard(token);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedDate) return;
    void loadDay(token, selectedDate);
  }, [token, selectedDate]);

  async function loadDashboard(accessToken = token) {
    if (!accessToken) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await getDashboard(accessToken);
      setDashboard(data);
      if (selectedDate) {
        const day = await getDay(accessToken, selectedDate);
        setDayData(day);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDay(accessToken: string, date: string) {
    setError(null);
    try {
      setDayData(await getDay(accessToken, date));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function signIn() {
    setError(null);
    if (!supabase) return;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (signInError) setError(signInError.message);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }

  async function saveFood(values: FoodEntryInput, entry?: FoodEntry) {
    if (!token) return;
    setError(null);
    try {
      if (entry) await updateFoodEntry(token, entry.id, values);
      else await createFoodEntry(token, values);
      setFoodForm(null);
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeFood(entry: FoodEntry) {
    if (!token || !window.confirm(`Delete ${entry.description}?`)) return;
    setError(null);
    try {
      await deleteFoodEntry(token, entry.id);
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveWeight(values: WeightEntryInput, existingId?: string) {
    if (!token) return;
    setWeightSaving(true);
    setError(null);
    try {
      if (existingId) await updateWeightEntry(token, existingId, values);
      else await createWeightEntry(token, values);
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWeightSaving(false);
    }
  }

  async function removeWeight(id: string) {
    if (!token || !window.confirm("Delete this weight entry?")) return;
    setWeightSaving(true);
    setError(null);
    try {
      await deleteWeightEntry(token, id);
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWeightSaving(false);
    }
  }

  async function removeAllData(confirmation: string) {
    if (!token) return;
    setError(null);
    try {
      await deleteAllData(token, confirmation);
      setSelectedDate(null);
      setDayData(null);
      await loadDashboard(token);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!hasSupabaseConfig()) {
    return <SetupMissing />;
  }

  if (authLoading) {
    return <ShellLoading />;
  }

  if (!session) {
    return <LoginScreen error={error} onSignIn={signIn} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Easy Calorie Tracker</p>
          <h1>{selectedDay ? formatFullDate(selectedDay.date) : titleForView(view)}</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => loadDashboard()} aria-label="Refresh dashboard">
          <RefreshCw size={19} className={refreshing ? "spin" : ""} />
        </button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="content">
        {!dashboard ? (
          <ShellLoading />
        ) : selectedDay ? (
          <DayDrilldown
            day={selectedDay}
            onBack={() => setSelectedDate(null)}
            onAddFood={() => setFoodForm(newFoodForm(selectedDay.date))}
            onEditFood={(entry) => setFoodForm(editFoodForm(entry))}
            onDeleteFood={removeFood}
            onSaveWeight={saveWeight}
            onDeleteWeight={removeWeight}
            weightSaving={weightSaving}
          />
        ) : view === "today" ? (
          <TodayView
            dashboard={dashboard}
            onSelectDate={setSelectedDate}
            onAddFood={() => setFoodForm(newFoodForm(dashboard.today.date))}
            onEditFood={(entry) => setFoodForm(editFoodForm(entry))}
            onDeleteFood={removeFood}
          />
        ) : view === "trends" ? (
          <TrendsView dashboard={dashboard} onSelectDate={setSelectedDate} />
        ) : view === "entries" ? (
          <EntriesView
            entries={dashboard.recent_food_entries}
            onSelectDate={setSelectedDate}
            onEditFood={(entry) => setFoodForm(editFoodForm(entry))}
            onDeleteFood={removeFood}
          />
        ) : (
          <SettingsView dashboard={dashboard} onSignOut={signOut} onDeleteAllData={removeAllData} />
        )}
      </main>

      {!selectedDay ? <BottomNav view={view} onChange={setView} /> : null}

      {foodForm ? (
        <FoodEntrySheet
          form={foodForm}
          onClose={() => setFoodForm(null)}
          onSave={(values) => saveFood(values, foodForm.entry)}
        />
      ) : null}
    </div>
  );
}

function TodayView({
  dashboard,
  onSelectDate,
  onAddFood,
  onEditFood,
  onDeleteFood,
}: {
  dashboard: DashboardData;
  onSelectDate: (date: string) => void;
  onAddFood: () => void;
  onEditFood: (entry: FoodEntry) => void;
  onDeleteFood: (entry: FoodEntry) => void;
}) {
  return (
    <>
      <SummaryGrid totals={dashboard.today.totals} />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Last 14 Days</h2>
            <p>{dashboard.last_14_days.averages.calories} kcal avg on logged days</p>
          </div>
        </div>
        <DayStrip days={dashboard.last_14_days.days} selectedDate={dashboard.today.date} onSelectDate={onSelectDate} />
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Today</h2>
            <p>{dashboard.today.food_entries.length} food entries</p>
          </div>
          <button className="primary-button compact" type="button" onClick={onAddFood}>
            <Plus size={17} /> Add
          </button>
        </div>
        <FoodList entries={dashboard.today.food_entries} onEdit={onEditFood} onDelete={onDeleteFood} emptyText="No food logged today." />
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Weight</h2>
            <p>{dashboard.today.latest_weight ? `${dashboard.today.latest_weight.weight_kg} kg latest` : "No weight logged yet"}</p>
          </div>
          <Weight size={19} />
        </div>
      </section>
    </>
  );
}

function DayDrilldown({
  day,
  onBack,
  onAddFood,
  onEditFood,
  onDeleteFood,
  onSaveWeight,
  onDeleteWeight,
  weightSaving,
}: {
  day: DayData;
  onBack: () => void;
  onAddFood: () => void;
  onEditFood: (entry: FoodEntry) => void;
  onDeleteFood: (entry: FoodEntry) => void;
  onSaveWeight: (values: WeightEntryInput, existingId?: string) => void;
  onDeleteWeight: (id: string) => void;
  weightSaving: boolean;
}) {
  return (
    <>
      <button className="text-button" type="button" onClick={onBack}>
        <ChevronLeft size={18} /> Back
      </button>
      <SummaryGrid totals={day.totals} />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Food Entries</h2>
            <p>{day.food_entries.length} entries</p>
          </div>
          <button className="primary-button compact" type="button" onClick={onAddFood}>
            <Plus size={17} /> Add
          </button>
        </div>
        <FoodList entries={day.food_entries} onEdit={onEditFood} onDelete={onDeleteFood} emptyText="No food entries for this day." />
      </section>
      <WeightPanel day={day} onSave={onSaveWeight} onDelete={onDeleteWeight} saving={weightSaving} />
    </>
  );
}

function TrendsView({ dashboard, onSelectDate }: { dashboard: DashboardData; onSelectDate: (date: string) => void }) {
  const insights = dashboard.insights;

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Logged-Day Average</h2>
            <p>{insights.days_logged} of 14 days logged</p>
          </div>
          <LineChart size={19} />
        </div>
        <MacroTable totals={dashboard.last_14_days.averages} />
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Trend</h2>
            <p>Tap any day to inspect entries</p>
          </div>
        </div>
        <DayStrip days={dashboard.last_14_days.days} selectedDate={dashboard.today.date} onSelectDate={onSelectDate} />
      </section>
      <section className="metric-list">
        <MetricRow label="Avg calories, last 7 logged days" value={`${insights.avg_calories_last_7_days} kcal`} />
        <MetricRow label="Previous 7 logged days" value={`${insights.avg_calories_previous_7_days} kcal`} />
        <MetricRow label="Protein trend" value={`${signed(insights.protein_trend_delta)}g`} />
        <MetricRow label="Weight change" value={insights.weight_delta === null ? "No trend yet" : `${signed(insights.weight_delta)} kg`} />
      </section>
    </>
  );
}

function EntriesView({
  entries,
  onSelectDate,
  onEditFood,
  onDeleteFood,
}: {
  entries: FoodEntry[];
  onSelectDate: (date: string) => void;
  onEditFood: (entry: FoodEntry) => void;
  onDeleteFood: (entry: FoodEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => entries.filter((entry) => entry.description.toLowerCase().includes(query.trim().toLowerCase())),
    [entries, query]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Recent Entries</h2>
          <p>{filtered.length} visible</p>
        </div>
      </div>
      <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods" />
      <FoodList
        entries={filtered}
        onEdit={onEditFood}
        onDelete={onDeleteFood}
        onDateClick={(date) => onSelectDate(date)}
        emptyText="No matching entries."
      />
    </section>
  );
}

function SettingsView({
  dashboard,
  onSignOut,
  onDeleteAllData,
}: {
  dashboard: DashboardData;
  onSignOut: () => void;
  onDeleteAllData: (confirmation: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");

  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Account</h2>
            <p>{dashboard.user.email}</p>
          </div>
        </div>
        <MetricRow label="Timezone" value={dashboard.user.timezone} />
        <button className="secondary-button full" type="button" onClick={onSignOut}>
          <LogOut size={17} /> Log out
        </button>
      </section>
      <section className="panel danger-panel">
        <div className="panel-header">
          <div>
            <h2>Delete Data</h2>
            <p>This cannot be undone.</p>
          </div>
        </div>
        <input
          className="search-input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Type DELETE ALL MY DATA"
        />
        <button
          className="danger-button full"
          type="button"
          disabled={confirmation !== "DELETE ALL MY DATA"}
          onClick={() => onDeleteAllData(confirmation)}
        >
          <Trash2 size={17} /> Delete all data
        </button>
      </section>
    </>
  );
}

function SummaryGrid({ totals }: { totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number } }) {
  return (
    <section className="summary-grid">
      <SummaryTile label="Calories" value={totals.calories.toLocaleString()} suffix="kcal" />
      <SummaryTile label="Protein" value={formatMacro(totals.protein_g)} suffix="g" />
      <SummaryTile label="Carbs" value={formatMacro(totals.carbs_g)} suffix="g" />
      <SummaryTile label="Fat" value={formatMacro(totals.fat_g)} suffix="g" />
    </section>
  );
}

function SummaryTile({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{suffix}</small>
    </div>
  );
}

function DayStrip({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: DashboardData["last_14_days"]["days"];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const maxCalories = Math.max(1, ...days.map((day) => day.calories));

  return (
    <div className="day-strip">
      {days.map((day) => (
        <button
          className={`day-bar ${day.date === selectedDate ? "selected" : ""}`}
          type="button"
          key={day.date}
          onClick={() => onSelectDate(day.date)}
        >
          <span className="bar-track">
            <span className="bar-fill" style={{ height: `${Math.max(6, (day.calories / maxCalories) * 100)}%` }} />
          </span>
          <span>{shortDay(day.date)}</span>
          <strong>{day.entries_count > 0 ? day.calories : "-"}</strong>
        </button>
      ))}
    </div>
  );
}

function FoodList({
  entries,
  onEdit,
  onDelete,
  onDateClick,
  emptyText,
}: {
  entries: FoodEntry[];
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
  onDateClick?: (date: string) => void;
  emptyText: string;
}) {
  if (entries.length === 0) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="food-list">
      {entries.map((entry) => (
        <article className="food-row" key={entry.id}>
          <div className="food-main">
            <button className="food-title" type="button" onClick={() => onDateClick?.(entry.consumption_date)}>
              {entry.description}
            </button>
            <span>
              {[entry.meal_type, entry.entry_type, formatTime(entry.consumption_time)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="food-macros">
            <strong>{entry.calories} kcal</strong>
            <span>
              P {formatMacro(entry.protein_g)} · C {formatMacro(entry.carbs_g)} · F {formatMacro(entry.fat_g)}
            </span>
          </div>
          <div className="row-actions">
            <button className="icon-button small" type="button" onClick={() => onEdit(entry)} aria-label="Edit food entry">
              <Edit3 size={16} />
            </button>
            <button className="icon-button small danger-icon" type="button" onClick={() => onDelete(entry)} aria-label="Delete food entry">
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function WeightPanel({
  day,
  onSave,
  onDelete,
  saving,
}: {
  day: DayData;
  onSave: (values: WeightEntryInput, existingId?: string) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [weight, setWeight] = useState(day.weight_entry?.weight_kg.toString() ?? "");
  const [note, setNote] = useState(day.weight_entry?.note ?? "");

  useEffect(() => {
    setWeight(day.weight_entry?.weight_kg.toString() ?? "");
    setNote(day.weight_entry?.note ?? "");
  }, [day]);

  const weightNumber = Number(weight);
  const canSave = Number.isFinite(weightNumber) && weightNumber > 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Weight</h2>
          <p>{day.weight_entry ? "Saved for this date" : "No weight on this date"}</p>
        </div>
        <Weight size={19} />
      </div>
      <div className="form-grid two">
        <label>
          Weight kg
          <input value={weight} onChange={(event) => setWeight(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Note
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          disabled={!canSave || saving}
          onClick={() => onSave({ date: day.date, weight_kg: weightNumber, note: note || null }, day.weight_entry?.id)}
        >
          <Check size={17} /> Save weight
        </button>
        {day.weight_entry ? (
          <button className="secondary-button danger-text" type="button" disabled={saving} onClick={() => onDelete(day.weight_entry!.id)}>
            <Trash2 size={17} /> Delete
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FoodEntrySheet({ form, onClose, onSave }: { form: FoodFormState; onClose: () => void; onSave: (values: FoodEntryInput) => void }) {
  const [values, setValues] = useState(form.values);
  const canSave = values.description.trim() && values.consumption_date && Number.isFinite(values.calories) && values.calories >= 0;

  function setField<K extends keyof FoodEntryInput>(key: K, value: FoodEntryInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="sheet" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => event.preventDefault()}>
        <div className="panel-header">
          <div>
            <h2>{form.mode === "edit" ? "Edit Food" : "Add Food"}</h2>
            <p>{values.consumption_date}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">
            x
          </button>
        </div>
        <label>
          Description
          <input value={values.description} onChange={(event) => setField("description", event.target.value)} />
        </label>
        <div className="form-grid two">
          <label>
            Date
            <input type="date" value={values.consumption_date} onChange={(event) => setField("consumption_date", event.target.value)} />
          </label>
          <label>
            Time
            <input value={values.consumption_time ?? ""} onChange={(event) => setField("consumption_time", event.target.value || null)} placeholder="HH:MM" />
          </label>
        </div>
        <div className="form-grid two">
          <label>
            Meal
            <select value={values.meal_type ?? ""} onChange={(event) => setField("meal_type", (event.target.value || null) as MealType | null)}>
              <option value="">Unset</option>
              {mealTypes.map((meal) => (
                <option value={meal} key={meal}>
                  {capitalize(meal)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={values.entry_type} onChange={(event) => setField("entry_type", event.target.value as EntryType)}>
              {entryTypes.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid four">
          <NumberField label="Calories" value={values.calories} onChange={(value) => setField("calories", value)} />
          <NumberField label="Protein" value={values.protein_g} onChange={(value) => setField("protein_g", value)} />
          <NumberField label="Carbs" value={values.carbs_g} onChange={(value) => setField("carbs_g", value)} />
          <NumberField label="Fat" value={values.fat_g} onChange={(value) => setField("fat_g", value)} />
        </div>
        <label>
          Notes
          <textarea value={values.notes ?? ""} onChange={(event) => setField("notes", event.target.value || null)} />
        </label>
        <button className="primary-button full" type="button" disabled={!canSave} onClick={() => onSave(values)}>
          <Check size={17} /> Save
        </button>
      </form>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input value={String(value)} inputMode="decimal" onChange={(event) => onChange(Number(event.target.value || 0))} />
    </label>
  );
}

function MacroTable({ totals }: { totals: Omit<DashboardData["today"]["totals"], "date"> }) {
  return (
    <div className="macro-table">
      <MetricRow label="Calories" value={`${totals.calories} kcal`} />
      <MetricRow label="Protein" value={`${formatMacro(totals.protein_g)}g`} />
      <MetricRow label="Carbs" value={`${formatMacro(totals.carbs_g)}g`} />
      <MetricRow label="Fat" value={`${formatMacro(totals.fat_g)}g`} />
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BottomNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const items: Array<{ view: View; label: string; icon: typeof Utensils }> = [
    { view: "today", label: "Today", icon: Utensils },
    { view: "trends", label: "Trends", icon: Activity },
    { view: "entries", label: "Entries", icon: List },
    { view: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button className={view === item.view ? "active" : ""} type="button" onClick={() => onChange(item.view)} key={item.view}>
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function LoginScreen({ error, onSignIn }: { error: string | null; onSignIn: () => void }) {
  return (
    <main className="login-screen">
      <div className="login-panel">
        <div className="brand-mark">
          <Utensils size={28} />
        </div>
        <h1>Easy Calorie Tracker</h1>
        <p>Calories and macros, pulled from your ChatGPT logs into a dashboard you can actually inspect.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <button className="primary-button full" type="button" onClick={onSignIn}>
          Sign in with Google
        </button>
      </div>
    </main>
  );
}

function SetupMissing() {
  return (
    <main className="login-screen">
      <div className="login-panel">
        <h1>Dashboard Setup</h1>
        <p>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for this Pages project.</p>
      </div>
    </main>
  );
}

function ShellLoading() {
  return (
    <main className="login-screen">
      <div className="loading-dot" />
    </main>
  );
}

function titleForView(view: View): string {
  if (view === "today") return "Today";
  if (view === "trends") return "Trends";
  if (view === "entries") return "Entries";
  return "Settings";
}

function newFoodForm(date: string): FoodFormState {
  return {
    mode: "create",
    values: {
      description: "",
      consumption_date: date,
      consumption_time: null,
      meal_type: null,
      entry_type: "Core",
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      confidence: null,
      notes: null,
    },
  };
}

function editFoodForm(entry: FoodEntry): FoodFormState {
  return {
    mode: "edit",
    entry,
    values: {
      description: entry.description,
      consumption_date: entry.consumption_date,
      consumption_time: entry.consumption_time,
      meal_type: entry.meal_type,
      entry_type: entry.entry_type,
      calories: entry.calories,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
      confidence: entry.confidence,
      notes: entry.notes,
    },
  };
}

function formatMacro(value: number): string {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function formatTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function shortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function signed(value: number): string {
  return value > 0 ? `+${formatMacro(value)}` : formatMacro(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function sessionFromHash(): { access_token: string; refresh_token: string } | null {
  if (!window.location.hash.startsWith("#")) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}
