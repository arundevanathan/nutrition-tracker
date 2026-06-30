import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Check,
  Edit3,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  createFoodEntry,
  deleteFoodEntry,
  getDashboard,
  getDay,
  updateFoodEntry,
} from "./api";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase";
import type { DashboardData, DayData, EntryType, FoodEntry, FoodEntryInput, MealType } from "./types";
import logoUrl from "./assets/logo.png";

type FoodFormState = {
  mode: "create" | "edit";
  entry?: FoodEntry;
  values: FoodEntryInput;
};

const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack", "drink", "other"];
const entryTypes: EntryType[] = ["Core", "Junk", "Alcohol", "Eating Out"];
const contactEmail = "arun.devanathan@gmail.com";

export default function App() {
  const publicPage = publicPageForPath(window.location.pathname);

  if (publicPage === "privacy") {
    return <PrivacyPage />;
  }

  if (publicPage === "terms") {
    return <TermsPage />;
  }

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<FoodFormState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => (hasSupabaseConfig() ? getSupabaseClient() : null), []);
  const token = session?.access_token ?? null;
  const selectedDay = selectedDate && selectedDate !== dashboard?.today.date && dayData?.date === selectedDate ? dayData : null;

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
    if (!token || !selectedDate || selectedDate === dashboard?.today.date) return;
    void loadDay(token, selectedDate);
  }, [token, selectedDate, dashboard?.today.date]);

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

  async function removeFood(entry: FoodEntry): Promise<boolean> {
    if (!token || !window.confirm(`Delete ${entry.description}?`)) return false;
    setError(null);
    try {
      await deleteFoodEntry(token, entry.id);
      await loadDashboard(token);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
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
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="Easy Calorie Tracker logo" />
          <div>
            <p className="eyebrow">Easy Calorie Tracker</p>
            <h1>{dashboard?.user.display_name ? `${firstName(dashboard.user.display_name)}'s Dashboard` : "Your Dashboard"}</h1>
            <p className="header-email">{dashboard?.user.email ?? session.user.email}</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="header-action" type="button" onClick={() => loadDashboard()} aria-label="Refresh" title="Refresh">
            <RefreshCw size={19} className={refreshing ? "spin" : ""} />
          </button>
          <button className="header-action" type="button" onClick={signOut} aria-label="Log out" title="Log out">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="content">
        {!dashboard ? (
          <ShellLoading />
        ) : (
          <DashboardView
            dashboard={dashboard}
            selectedDate={selectedDate ?? dashboard.today.date}
            selectedDay={selectedDay}
            onSelectDate={(date) => setSelectedDate(date)}
            onAddFood={(date) => setFoodForm(newFoodForm(date))}
            onEditFood={(entry) => setFoodForm(editFoodForm(entry))}
          />
        )}
      </main>

      {foodForm ? (
        <FoodEntrySheet
          form={foodForm}
          onClose={() => setFoodForm(null)}
          onSave={(values) => saveFood(values, foodForm.entry)}
          onDelete={
            foodForm.entry
              ? async () => {
                  if (await removeFood(foodForm.entry!)) setFoodForm(null);
                }
              : undefined
          }
        />
      ) : null}
      <AppFooter />
    </div>
  );
}

function DashboardView({
  dashboard,
  selectedDate,
  selectedDay,
  onSelectDate,
  onAddFood,
  onEditFood,
}: {
  dashboard: DashboardData;
  selectedDate: string;
  selectedDay: DayData | null;
  onSelectDate: (date: string) => void;
  onAddFood: (date: string) => void;
  onEditFood: (entry: FoodEntry) => void;
}) {
  const trendDays = smartTrendDays(dashboard.last_14_days.days);
  const average = rollingAverage(dashboard.last_14_days.days);
  const selectedEntries = selectedDate === dashboard.today.date ? dashboard.today.food_entries : selectedDay?.food_entries ?? [];
  const selectedIsLoading = selectedDate !== dashboard.today.date && !selectedDay;

  return (
    <div className="dashboard-grid">
      <div className="left-column">
        <MetricSummary totals={dashboard.today.totals} average={average} />
        <section className="analytics-grid">
          <section className="panel card daily-calories-card">
            <div className="panel-header">
              <h2>Daily Calories</h2>
            </div>
            <DailyCaloriesChart days={trendDays} selectedDate={selectedDate} todayDate={dashboard.today.date} onSelectDate={onSelectDate} />
          </section>
          <ProteinTrendCard days={trendDays} todayDate={dashboard.today.date} />
          <WeightTrendCard dashboard={dashboard} />
        </section>
      </div>

      <aside className="right-column">
        <section className="panel card food-card">
          <div className="panel-header">
            <h2>{foodCardTitle(selectedDate, dashboard.today.date)}</h2>
            <button className="add-button" type="button" onClick={() => onAddFood(selectedDate)} aria-label="Add food" title="Add food">
              <Plus size={18} />
            </button>
          </div>
          <FoodList
            entries={selectedEntries}
            onEdit={onEditFood}
            emptyText={selectedIsLoading ? "Loading food entries..." : "No food logged for this day."}
          />
        </section>
      </aside>
    </div>
  );
}

function MetricSummary({
  totals,
  average,
}: {
  totals: DashboardData["today"]["totals"];
  average: { label: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };
}) {
  return (
    <section className="macro-grid" aria-label="Today summary">
      <article className="metric-card calorie-hero primary card">
        <div className="calorie-topline">
          <span className="metric-label">Today Calories</span>
          <strong className="metric-value">
            {totals.calories.toLocaleString()} <span className="metric-unit">kcal</span>
          </strong>
        </div>
        <div className="calorie-subline">
          <span className="metric-average">
            {average.label} <strong>{average.calories.toLocaleString()} kcal</strong>
          </span>
        </div>
      </article>
      <div className="macro-row">
        <CompactMetric label="Protein" value={formatMacro(totals.protein_g)} unit="g" averageLabel={average.label} averageValue={`${formatMacro(average.protein_g)}g`} />
        <CompactMetric label="Carbs" value={formatMacro(totals.carbs_g)} unit="g" averageLabel={average.label} averageValue={`${formatMacro(average.carbs_g)}g`} />
        <CompactMetric label="Fat" value={formatMacro(totals.fat_g)} unit="g" averageLabel={average.label} averageValue={`${formatMacro(average.fat_g)}g`} />
      </div>
    </section>
  );
}

function CompactMetric({
  label,
  value,
  unit,
  averageLabel,
  averageValue,
}: {
  label: string;
  value: string;
  unit: string;
  averageLabel: string;
  averageValue: string;
}) {
  return (
    <article className="metric-card compact-macro card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">
        {value}
        <span className="metric-unit">{unit}</span>
      </strong>
      <div className="metric-average">
        {averageLabel} <strong>{averageValue}</strong>
      </div>
    </article>
  );
}

function DailyCaloriesChart({
  days,
  selectedDate,
  todayDate,
  onSelectDate,
}: {
  days: DashboardData["last_14_days"]["days"];
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
}) {
  const loggedDays = days.filter((day) => day.entries_count > 0);
  const maxCalories = Math.max(1, ...loggedDays.map((day) => day.calories));

  return (
    <div className="chart-days" style={{ "--day-count": days.length } as CSSProperties}>
      {days.map((day) => {
        const hasLog = day.entries_count > 0;
        const selected = day.date === selectedDate;
        const today = day.date === todayDate;

        return (
          <button
            className={`day-bar ${selected ? "selected" : ""} ${today ? "today" : ""} ${hasLog ? "" : "empty"}`}
            type="button"
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            aria-label={`${shortDay(day.date)}: ${hasLog ? `${day.calories} calories logged` : "no food logged"}`}
          >
            <span className="bar-track">
              {hasLog ? <span className="bar-fill" style={{ height: `${Math.max(10, (day.calories / maxCalories) * 100)}%` }} /> : <span className="bar-empty-dot" />}
            </span>
            <span>{shortDay(day.date)}</span>
            <strong>{hasLog ? day.calories.toLocaleString() : "0"}</strong>
          </button>
        );
      })}
    </div>
  );
}

function ProteinTrendCard({ days, todayDate }: { days: DashboardData["last_14_days"]["days"]; todayDate: string }) {
  const maxProtein = Math.max(1, ...days.filter((day) => day.entries_count > 0).map((day) => day.protein_g));

  return (
    <article className="panel card">
      <div className="panel-header">
        <h2>Protein Trend</h2>
      </div>
      <div className="compact-chart">
        {days.map((day) => {
          const hasLog = day.entries_count > 0;
          return (
            <div className={`compact-row ${day.date === todayDate ? "today" : ""}`} key={day.date}>
              <span>{shortDay(day.date)}</span>
              <div className="compact-track">
                <span className="compact-fill" style={{ width: hasLog ? `${Math.max(5, (day.protein_g / maxProtein) * 100)}%` : "0%" }} />
              </div>
              <strong>{hasLog ? `${formatMacro(day.protein_g)}g` : ""}</strong>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function WeightTrendCard({ dashboard }: { dashboard: DashboardData }) {
  const entries = [...dashboard.recent_weight_entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-6);

  if (entries.length === 0) {
    return (
      <article className="panel card">
        <div className="panel-header">
          <h2>Weight Trend</h2>
        </div>
        <div className="empty-state">No weight logged yet.</div>
      </article>
    );
  }

  if (entries.length === 1) {
    return (
      <article className="panel card weight-latest-card">
        <div>
          <h2>Weight Trend</h2>
          <p className="muted">Latest entry</p>
        </div>
        <strong>{formatMacro(entries[0].weight_kg)} kg</strong>
      </article>
    );
  }

  const weights = entries.map((entry) => entry.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(0.1, max - min);
  const width = 520;
  const height = 124;
  const points = entries.map((entry, index) => {
    const x = entries.length === 1 ? width / 2 : (index / (entries.length - 1)) * width;
    const y = 14 + ((max - entry.weight_kg) / range) * (height - 28);
    return { x, y, entry };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const delta = entries[entries.length - 1].weight_kg - entries[0].weight_kg;

  return (
    <article className="panel card">
      <div className="panel-header">
        <h2>Weight Trend</h2>
      </div>
      <div className="weight-chart">
        <svg className="weight-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Weight trend from ${formatMacro(entries[0].weight_kg)}kg to ${formatMacro(entries[entries.length - 1].weight_kg)}kg`}>
          <line className="weight-gridline" x1="0" y1="20" x2={width} y2="20" />
          <line className="weight-gridline" x1="0" y1="62" x2={width} y2="62" />
          <line className="weight-gridline" x1="0" y1="104" x2={width} y2="104" />
          <path className="weight-path" d={path} />
          {points.map((point) => (
            <circle className="weight-dot" cx={point.x} cy={point.y} r="6" key={point.entry.id} />
          ))}
        </svg>
        <div className="weight-labels">
          {entries.map((entry) => (
            <span key={entry.id}>{formatMacro(entry.weight_kg)}</span>
          ))}
        </div>
        <p className="weight-change">{weightChangeText(delta)}</p>
      </div>
    </article>
  );
}

function FoodList({
  entries,
  onEdit,
  emptyText,
}: {
  entries: FoodEntry[];
  onEdit: (entry: FoodEntry) => void;
  emptyText: string;
}) {
  if (entries.length === 0) return <div className="empty-state">{emptyText}</div>;

  return (
    <div className="food-list">
      {entries.map((entry) => (
        <article className="food-row" key={entry.id}>
          <div className="food-main">
            <button className="food-title" type="button" onClick={() => onEdit(entry)}>
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
            <button className="edit-button" type="button" onClick={() => onEdit(entry)} aria-label="Edit food entry" title="Edit food entry">
              <Edit3 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function FoodEntrySheet({
  form,
  onClose,
  onSave,
  onDelete,
}: {
  form: FoodFormState;
  onClose: () => void;
  onSave: (values: FoodEntryInput) => void;
  onDelete?: () => void | Promise<void>;
}) {
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
        <div className="sheet-actions">
          <button className="primary-button full" type="button" disabled={!canSave} onClick={() => onSave(values)}>
            <Check size={17} /> Save
          </button>
          {onDelete ? (
            <button className="secondary-button danger-text full" type="button" onClick={onDelete}>
              <Trash2 size={17} /> Delete entry
            </button>
          ) : null}
        </div>
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

function LoginScreen({ error, onSignIn }: { error: string | null; onSignIn: () => void }) {
  return (
    <main className="login-preview-screen">
      <div className="login-preview-shell" aria-hidden="true">
        <header className="topbar login-preview-topbar">
          <div className="brand">
            <img className="brand-logo" src={logoUrl} alt="" />
            <div>
              <p className="eyebrow">Easy Calorie Tracker</p>
              <h1>Your Dashboard</h1>
              <p className="header-email">your data is waiting</p>
            </div>
          </div>
        </header>
        <div className="dashboard-grid login-preview-grid">
          <div className="left-column">
            <section className="macro-grid">
              <article className="metric-card calorie-hero primary card">
                <div className="calorie-topline">
                  <span className="metric-label">Today Calories</span>
                  <strong className="metric-value">1,652 <span className="metric-unit">kcal</span></strong>
                </div>
                <div className="calorie-subline">
                  <span className="metric-average">7-day avg <strong>1,802 kcal</strong></span>
                </div>
              </article>
              <div className="macro-row">
                <article className="metric-card compact-macro card">
                  <span className="metric-label">Protein</span>
                  <strong className="metric-value">123<span className="metric-unit">g</span></strong>
                </article>
                <article className="metric-card compact-macro card">
                  <span className="metric-label">Carbs</span>
                  <strong className="metric-value">116<span className="metric-unit">g</span></strong>
                </article>
                <article className="metric-card compact-macro card">
                  <span className="metric-label">Fat</span>
                  <strong className="metric-value">76<span className="metric-unit">g</span></strong>
                </article>
              </div>
            </section>
            <section className="secondary-grid">
              <article className="panel card login-preview-panel">
                <div className="panel-header"><h2>Protein Trend</h2></div>
                <div className="compact-chart">
                  <div className="compact-row"><span>Mon</span><div className="compact-track"><span className="compact-fill" style={{ width: "54%" }} /></div><strong>68g</strong></div>
                  <div className="compact-row"><span>Tue</span><div className="compact-track"><span className="compact-fill" style={{ width: "78%" }} /></div><strong>98g</strong></div>
                  <div className="compact-row"><span>Wed</span><div className="compact-track"><span className="compact-fill" style={{ width: "96%" }} /></div><strong>121g</strong></div>
                </div>
              </article>
              <article className="panel card login-preview-panel">
                <div className="panel-header"><h2>Weight Trend</h2></div>
                <div className="weight-chart" />
              </article>
            </section>
          </div>
          <aside className="right-column">
            <section className="panel card login-preview-panel">
              <div className="panel-header"><h2>Daily Calories</h2></div>
              <div className="chart-days">
                {[48, 62, 77, 100, 58, 70].map((height, index) => (
                  <div className="day-bar" key={index}>
                    <span className="bar-track"><span className="bar-fill" style={{ height: `${height}%` }} /></span>
                    <span>Day</span>
                    <strong>----</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel card login-preview-panel">
              <div className="panel-header"><h2>Today's Food</h2></div>
              <div className="food-list">
                <div className="food-row"><div className="food-main"><button className="food-title" type="button">Homemade meal estimate</button><span>lunch / Core</span></div><div className="food-macros"><strong>--- kcal</strong><span>P -- / C -- / F --</span></div></div>
                <div className="food-row"><div className="food-main"><button className="food-title" type="button">Evening snack</button><span>snack / Core</span></div><div className="food-macros"><strong>--- kcal</strong><span>P -- / C -- / F --</span></div></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      <section className="login-unlock-card">
        <img className="brand-logo" src={logoUrl} alt="Easy Calorie Tracker logo" />
        <div>
          <p className="eyebrow">Easy Calorie Tracker</p>
          <h1>Login to view your data</h1>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        <button className="primary-button full" type="button" onClick={onSignIn}>
          Sign in with Google
        </button>
      </section>
      <AppFooter />
    </main>
  );
}

function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <a className="legal-home" href="/">
          Easy Calorie Tracker
        </a>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: June 30, 2026</p>

        <h2>What We Collect</h2>
        <p>
          Easy Calorie Tracker stores nutrition data you choose to log, including food descriptions, calories, macros, meal type,
          notes, dates, and weight entries. If you sign in with Google, we receive basic account information such as your email
          address and profile name through Supabase Auth.
        </p>

        <h2>How We Use Data</h2>
        <p>
          We use your data to log food and weight entries, show daily summaries, power dashboard views, and help you review or
          correct your own nutrition history.
        </p>

        <h2>Where Data Is Stored</h2>
        <p>
          Authentication and app data are stored in Supabase. The API runs on Cloudflare Workers. The dashboard is served through
          Cloudflare Pages.
        </p>

        <h2>Data Sharing</h2>
        <p>
          We do not sell your data. Data is shared with service providers only as needed to operate the app, such as Supabase,
          Cloudflare, Google authentication, and OpenAI Custom GPT Actions.
        </p>

        <h2>Your Controls</h2>
        <p>
          You can edit or delete individual food and weight entries. You can also delete all nutrition tracking data from the app
          after explicit confirmation.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions, <a href={`mailto:${contactEmail}`}>contact me</a>.
        </p>
        <AppFooter />
      </section>
    </main>
  );
}

function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <a className="legal-home" href="/">
          Easy Calorie Tracker
        </a>
        <h1>Terms of Service</h1>
        <p className="legal-date">Last updated: June 30, 2026</p>

        <h2>Use Of The App</h2>
        <p>
          Easy Calorie Tracker is a personal nutrition logging tool. You are responsible for reviewing estimates and deciding what
          to save.
        </p>

        <h2>Nutrition Estimates</h2>
        <p>
          Calorie and macro estimates are approximate and may be wrong. The app is not medical, nutritional, or fitness advice.
        </p>

        <h2>Your Data</h2>
        <p>
          You control your food and weight entries. Deleting all data is irreversible once confirmed.
        </p>

        <h2>Availability</h2>
        <p>
          The app is provided as-is and may change, pause, or stop during active development.
        </p>
      </section>
      <AppFooter />
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
      <AppFooter />
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

function AppFooter() {
  return (
    <footer className="app-footer">
      <a href="/privacy">Privacy Policy</a>
      <a href={`mailto:${contactEmail}`}>Contact me</a>
    </footer>
  );
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

function foodCardTitle(date: string, todayDate: string): string {
  if (date === todayDate) return "Today's Food";
  return `Food on ${formatFullDate(date)}`;
}

function formatFullDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] || value;
}

function smartTrendDays(days: DashboardData["last_14_days"]["days"]): DashboardData["last_14_days"]["days"] {
  if (days.length <= 6) return days;
  const firstLoggedIndex = days.findIndex((day) => day.entries_count > 0);
  if (firstLoggedIndex === -1) return days.slice(-6);
  return days.slice(Math.max(0, Math.min(firstLoggedIndex, days.length - 6)));
}

function rollingAverage(days: DashboardData["last_14_days"]["days"]): {
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const loggedDays = days.filter((day) => day.entries_count > 0).slice(-7);
  const count = loggedDays.length || 1;
  const totals = loggedDays.reduce(
    (sum, day) => ({
      calories: sum.calories + day.calories,
      protein_g: sum.protein_g + day.protein_g,
      carbs_g: sum.carbs_g + day.carbs_g,
      fat_g: sum.fat_g + day.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return {
    label: `${loggedDays.length || 0}-day avg`,
    calories: Math.round(totals.calories / count),
    protein_g: totals.protein_g / count,
    carbs_g: totals.carbs_g / count,
    fat_g: totals.fat_g / count,
  };
}

function weightChangeText(delta: number): string {
  if (Math.abs(delta) < 0.05) return "No major change across recent entries";
  const direction = delta < 0 ? "Down" : "Up";
  return `${direction} ${formatMacro(Math.abs(delta))} kg across recent entries`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function publicPageForPath(pathname: string): "privacy" | "terms" | null {
  if (pathname === "/privacy") return "privacy";
  if (pathname === "/terms") return "terms";
  return null;
}

function sessionFromHash(): { access_token: string; refresh_token: string } | null {
  if (!window.location.hash.startsWith("#")) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}
