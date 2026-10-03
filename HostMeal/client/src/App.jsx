import { useMemo, useRef, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_PORT

/* ---------- options for the dropdowns ---------- */

const OPTIONS = {
  mealType: ["Any meal", "Breakfast", "Lunch", "Dinner", "Evening snack"],
  diet: ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"],
  budget: [30, 50, 80, 100, 150, 200].map((v) => ({ value: v, label: `Up to ₹${v}` })),
  time: [10, 15, 20, 30, 45].map((v) => ({ value: v, label: `${v} minutes` })),
  servings: [1, 2, 3, 4].map((v) => ({ value: v, label: v === 1 ? "Just me" : `${v} people` })),
  goal: ["Normal", "High protein", "Low cost", "Healthy", "Filling"],
  equipment: ["Gas stove", "Induction", "Electric kettle", "Microwave", "No equipment"],
  taste: ["Any", "Spicy", "Mild", "Tangy", "North Indian", "South Indian"],
  pantry: [
    { value: "yes", label: "I have salt, oil and basic masalas" },
    { value: "no", label: "Count everything" },
  ],
  sort: [
    { value: "match", label: "Closest to what I have" },
    { value: "cost", label: "Cheapest first" },
    { value: "time", label: "Quickest first" },
    { value: "protein", label: "Most protein" },
  ],
  maxMissing: [
    { value: "any", label: "Any number missing" },
    { value: "0", label: "Nothing missing" },
    { value: "1", label: "1 or fewer missing" },
    { value: "2", label: "2 or fewer missing" },
  ],
};

const COMMON_ITEMS = {
  Staples: ["Rice", "Atta", "Poha", "Maggi", "Bread", "Oats", "Dalia", "Suji"],
  "Dal and protein": ["Toor dal", "Moong dal", "Rajma", "Chana", "Soya chunks", "Paneer", "Eggs", "Peanuts"],
  Vegetables: ["Onion", "Tomato", "Potato", "Green chilli", "Capsicum", "Peas", "Carrot", "Spinach"],
  "Dairy and extras": ["Milk", "Curd", "Butter", "Cheese", "Ghee", "Pickle"],
};

const PANTRY_BASICS = [
  "salt", "oil", "water", "turmeric", "haldi", "chilli powder", "red chilli",
  "garam masala", "masala", "cumin", "jeera", "mustard", "pepper", "sugar", "ginger garlic",
];

/* ---------- ingredient matching ---------- */

const normalise = (s) =>
  String(s).toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

const singular = (s) => (s.length > 3 && s.endsWith("s") ? s.slice(0, -1) : s);

function isCovered(item, haveList, assumeBasics) {
  const n = singular(normalise(item));
  if (!n) return true;
  if (assumeBasics && PANTRY_BASICS.some((b) => n.includes(b))) return true;
  return haveList.some((h) => {
    const x = singular(normalise(h));
    return x.length >= 3 && (n.includes(x) || x.includes(n));
  });
}

function getMissing(meal, haveList, assumeBasics) {
  const source = meal.ingredients ?? [];

  return source.filter(
    (item) => !isCovered(item, haveList, assumeBasics)
  );
}

/* ---------- small building blocks ---------- */

// text-base on phones stops iOS Safari from zooming the page when a field is focused
const fieldBase =
  "w-full rounded-md border border-[#C9D0D8] bg-white px-3 py-2.5 text-base text-[#1B2430] sm:py-2 sm:text-sm " +
  "focus:border-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#1B2430]/15";

function Select({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm text-[#4A5666]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldBase} cursor-pointer appearance-none truncate pr-9`}
        >
          {options.map((o) => {
            const opt = typeof o === "object" ? o : { value: o, label: o };
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A5666]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

function IngredientInput({ items, setItems }) {
  const [draft, setDraft] = useState("");

  const add = (raw) => {
    const incoming = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!incoming.length) return;
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.toLowerCase()));
      const fresh = incoming.filter((i) => !seen.has(i.toLowerCase()));
      return [...prev, ...fresh];
    });
    setDraft("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && items.length) {
      setItems((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div>
      <span className="mb-1 block text-sm text-[#4A5666]">Ingredients you have</span>

      <div className="flex min-h-22 flex-wrap content-start gap-1.5 rounded-md border border-[#C9D0D8] bg-white p-2 focus-within:border-[#1B2430] focus-within:ring-2 focus-within:ring-[#1B2430]/15">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex max-w-full items-center gap-1 rounded bg-[#E7ECF1] py-1 pl-2 pr-1 text-sm text-[#1B2430]"
          >
            <span className="wrap-break-words">{item}</span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => setItems((prev) => prev.filter((p) => p !== item))}
              className="rounded px-2 py-0.5 text-[#4A5666] hover:bg-[#C9D0D8] hover:text-[#1B2430] sm:px-1.5"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          enterKeyHint="done"
          autoCapitalize="none"
          placeholder={items.length ? "Add another" : "Type an item, press Enter"}
          className="min-w-32 flex-1 bg-transparent px-1 py-1.5 text-base outline-none placeholder:text-[#8A95A3] sm:py-1 sm:text-sm"
        />
      </div>
    </div>
  );
}

/* The common-items picker needs <optgroup>, so it gets its own component. */
function CommonItemPicker({ onPick }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[#4A5666]">Or pick from common items</span>
      <span className="relative block">
        <select
          value=""
          onChange={(e) => e.target.value && onPick(e.target.value)}
          className={`${fieldBase} cursor-pointer appearance-none pr-9`}
        >
          <option value="">Choose an item to add</option>
          {Object.entries(COMMON_ITEMS).map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A5666]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

/* ---------- shopping list (rendered in the sidebar on desktop, under the results on mobile) ---------- */

function ShoppingList({ className = "", shopping, setShopping, onRemove, onCopy, copied }) {
  return (
    <section className={`rounded-lg border border-[#D5DBE1] bg-white p-4 sm:p-5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Shopping list</h2>
        {shopping.length > 0 && (
          <button
            onClick={() => setShopping([])}
            className="py-1 text-sm text-[#4A5666] underline underline-offset-2 hover:text-[#1B2430]"
          >
            Clear
          </button>
        )}
      </div>

      {shopping.length === 0 ? (
        <p className="mt-2 text-sm text-[#4A5666]">
          Missing ingredients you add from a recipe will collect here.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-[#E3E8ED] text-sm">
            {shopping.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 wrap-break-words">{s}</span>
                <button
                  aria-label={`Remove ${s} from list`}
                  onClick={() => onRemove(s)}
                  className="shrink-0 px-2.5 py-1.5 text-[#4A5666] hover:text-[#1B2430]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={onCopy}
            className="mt-3 w-full rounded-md border border-[#C9D0D8] py-2.5 text-sm hover:border-[#1B2430] sm:py-2"
          >
            {copied ? "Copied" : "Copy list"}
          </button>
        </>
      )}
    </section>
  );
}

/* ---------- main app ---------- */

// Skeleton Loading
function MealSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-lg border border-[#D5DBE1] bg-white p-4 sm:p-5"
        >
          {/* Title + description */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-5 w-2/5 rounded bg-[#E3E8ED]" />
              <div className="mt-3 h-3 w-4/5 rounded bg-[#E3E8ED]" />
              <div className="mt-2 h-3 w-3/5 rounded bg-[#E3E8ED]" />
            </div>

            {/* Price */}
            <div className="h-5 w-12 shrink-0 rounded bg-[#E3E8ED]" />
          </div>

          {/* Stats */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <div className="h-4 w-20 rounded bg-[#E3E8ED]" />
            <div className="h-4 w-24 rounded bg-[#E3E8ED]" />
            <div className="h-4 w-32 rounded bg-[#E3E8ED]" />
          </div>

          {/* Missing ingredients */}
          <div className="mt-5 rounded-md bg-[#F2F4F6] p-3">
            <div className="h-4 w-32 rounded bg-[#E3E8ED]" />

            <div className="mt-3 flex flex-wrap gap-2">
              <div className="h-7 w-20 rounded bg-[#E3E8ED]" />
              <div className="h-7 w-24 rounded bg-[#E3E8ED]" />
              <div className="h-7 w-16 rounded bg-[#E3E8ED]" />
            </div>
          </div>

          {/* Recipe button */}
          <div className="mt-4 h-4 w-24 rounded bg-[#E3E8ED]" />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    mealType: "Any meal",
    diet: "Vegetarian",
    budget: "80",
    time: "20",
    servings: "1",
    goal: "Normal",
    equipment: "Gas stove",
    taste: "Any",
    pantry: "yes",
  });
  const [view, setView] = useState({ sort: "match", maxMissing: "any" });
  const [meals, setMeals] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shopping, setShopping] = useState([]);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const assumeBasics = form.pantry === "yes";

  const addItem = (name) =>
    setItems((prev) => (prev.some((p) => p.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]));

  const generateMeals = async () => {
    if (!items.length) {
      setError("Add at least one ingredient to get started.");
      return;
    }
    setError("");
    setLoading(true);

    // On phones the results sit below the form, so bring them into view.
    if (window.innerWidth < 1024) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    try {
      const { data } = await axios.post(`${API_URL}/api/meals`, {
        ingredients: items,
        budget: Number(form.budget),
        time: Number(form.time),
        servings: Number(form.servings),
        goal: form.goal,
        equipment: form.equipment,
        diet: form.diet,
        mealType: form.mealType,
        taste: form.taste,
      });
      setMeals(data.meals ?? []);
      setHasSearched(true);
    } catch (err) {
      console.error(err.response?.data || err.message);
      setError("Could not reach the meal service. Check that the server is running and try again.");
      // the error message is in the form, so take small screens back to it
      if (window.innerWidth < 1024) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  };

  /* attach missing list to each meal, then filter and sort */
  const results = useMemo(() => {
    const withMissing = meals.map((m) => ({ ...m, _missing: getMissing(m, items, assumeBasics) }));

    const filtered =
      view.maxMissing === "any"
        ? withMissing
        : withMissing.filter((m) => m._missing.length <= Number(view.maxMissing));

    const sorters = {
      match: (a, b) => a._missing.length - b._missing.length || a.cost - b.cost,
      cost: (a, b) => a.cost - b.cost,
      time: (a, b) => a.time - b.time,
      protein: (a, b) => b.protein - a.protein,
    };
    return [...filtered].sort(sorters[view.sort]);
  }, [meals, items, assumeBasics, view]);

  const toggleShopping = (name) =>
    setShopping((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));

  const addAllMissing = (list) =>
    setShopping((prev) => [...prev, ...list.filter((i) => !prev.includes(i))]);

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shopping.map((s) => `- ${s}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available, ignore */
    }
  };

  const shoppingProps = {
    shopping,
    setShopping,
    onRemove: toggleShopping,
    onCopy: copyList,
    copied,
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#F2F4F6] font-['Schibsted_Grotesk',system-ui,sans-serif] text-[#1B2430]">
      <header className="border-b border-[#D5DBE1] bg-white">
        <div className="mx-auto flex max-w-6xl items-baseline justify-center px-4 py-3 sm:px-5 sm:py-4">
          <h1 className="text-xl font-bold">HostMeal</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 sm:gap-6 sm:px-5 sm:py-6 lg:grid-cols-[360px_1fr]">
        {/* ---------- left: inputs ---------- */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-[#D5DBE1] bg-white p-4 sm:p-5">
            {/* on tablets the two inputs sit side by side */}
            <div className="grid gap-4 md:grid-cols-2 md:items-start lg:grid-cols-1">
              <IngredientInput items={items} setItems={setItems} />
              <CommonItemPicker onPick={addItem} />
            </div>

            <hr className="my-5 border-[#E3E8ED]" />

            {/* 1 column on small phones, 2 on phones, 4 on tablets, 2 again in the desktop sidebar */}
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 min-[400px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-2">
              <Select label="Meal" value={form.mealType} onChange={set("mealType")} options={OPTIONS.mealType} />
              <Select label="Diet" value={form.diet} onChange={set("diet")} options={OPTIONS.diet} />
              <Select label="Budget" value={form.budget} onChange={set("budget")} options={OPTIONS.budget} />
              <Select label="Cooking time" value={form.time} onChange={set("time")} options={OPTIONS.time} />
              <Select label="Cooking for" value={form.servings} onChange={set("servings")} options={OPTIONS.servings} />
              <Select label="Goal" value={form.goal} onChange={set("goal")} options={OPTIONS.goal} />
              <Select label="Equipment" value={form.equipment} onChange={set("equipment")} options={OPTIONS.equipment} />
              <Select label="Taste" value={form.taste} onChange={set("taste")} options={OPTIONS.taste} />
            </div>

            <div className="mt-4 md:max-w-md lg:max-w-none">
              <Select label="Pantry basics" value={form.pantry} onChange={set("pantry")} options={OPTIONS.pantry} />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-md border border-[#E9B8AE] bg-[#FBEDEA] px-3 py-2 text-sm text-[#8F2A16]">
                {error}
              </p>
            )}

            <button
              onClick={generateMeals}
              disabled={loading}
              className="mt-5 w-full rounded-md bg-[#1B2430] py-3 text-sm font-medium text-white hover:bg-[#2B3748] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2430] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:py-2.5 cursor-pointer"
            >
              {loading ? "Finding meals..." : "Find meals"}
            </button>
          </section>

          {/* desktop only: on small screens the list is shown under the results instead */}
          <ShoppingList className="hidden lg:mt-6 lg:block" {...shoppingProps} />
        </aside>

        {/* ---------- right: results ---------- */}
        <main ref={resultsRef} className="min-w-0 scroll-mt-4">
          {/* Loading */}
          {loading && <MealSkeleton />}

          {!hasSearched && !loading && (
            <div className="flex items-center justify-center lg:min-h-[60vh]">
              <div className="w-full rounded-lg border border-dashed border-[#BFC8D1] p-8 text-center sm:p-12">
                <p className="font-medium">No meals yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[#4A5666]">
                  Add the ingredients you have, set your budget and time, then choose Find meals.
                </p>
              </div>
            </div>
          )}

          {hasSearched && !loading && (
            <>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {results.length} {results.length === 1 ? "meal" : "meals"}
                  </h2>
                  <p className="text-sm text-[#4A5666]">
                    {form.diet}, up to ₹{form.budget}, {form.time} minutes
                  </p>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:max-w-md">
                  <Select label="Sort by" value={view.sort} onChange={(v) => setView((s) => ({ ...s, sort: v }))} options={OPTIONS.sort} />
                  <Select label="Show" value={view.maxMissing} onChange={(v) => setView((s) => ({ ...s, maxMissing: v }))} options={OPTIONS.maxMissing} />
                </div>
              </div>

              {results.length === 0 ? (
                <p className="rounded-lg border border-[#D5DBE1] bg-white p-6 text-sm text-[#4A5666]">
                  No meals match this filter. Allow more missing ingredients, or add more items on the left.
                </p>
              ) : (
                <ul className="space-y-3">
                  {results.map((meal, i) => (
                    <MealRow
                      key={`${meal.name}-${i}`}
                      meal={meal}
                      haveList={items}
                      assumeBasics={assumeBasics}
                      isTop={i === 0 && view.sort === "match"}
                      shopping={shopping}
                      onToggleShopping={toggleShopping}
                      onAddAll={addAllMissing}
                    />
                  ))}
                </ul>
              )}
            </>
          )}

          {/* mobile and tablet only: the shopping list lives under the results */}
          {(hasSearched || shopping.length > 0) && (
            <ShoppingList className="mt-5 lg:hidden" {...shoppingProps} />
          )}
        </main>
      </div>

      <footer className="mt-12 border-t border-[#D5DBE1] bg-white">
  <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
    
    {/* Brand */}
    <div>
      <p className="text-sm font-semibold text-[#1B2430]">
        HostMeal
      </p>
      <p className="mt-1 text-xs text-[#6B7280]">
        Smart meals for hostel life.
      </p>
    </div>

    {/* Links */}
    <div className="flex flex-wrap gap-4 text-xs text-[#6B7280]">
      <a
        href="https://github.com/reyan3"
        className="transition hover:text-[#1B2430] "
      >
        GitHub
      </a>
    </div>

    {/* Copyright */}
    <p className="text-xs text-[#8A95A3]">
      © {new Date().getFullYear()} HostMeal
    </p>
  </div>
</footer>
    </div>
  );
}

//YT CARD
function YouTubeCard({ video }) {
  if (!video) return null;

  return (
    <div className="mt-5 border-t border-[#E3E8ED] pt-5">
      {/* Section heading */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#1B2430]">
            Recipe video
          </h4>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Helpful video guide for this meal
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-[#FCE8E6] px-2.5 py-1 text-[11px] font-medium text-[#B91C1C]">
          YouTube
        </span>
      </div>

      {/* Video card: stacked on small phones, side by side from 480px up */}
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Watch ${video.title} on YouTube`}
        className="group block overflow-hidden rounded-lg border border-[#D5DBE1] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B8C0C9] hover:shadow-md"
      >
        <div className="flex flex-col min-[480px]:flex-row">
          {/* Thumbnail */}
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[#E9EDF1] min-[480px]:w-40 sm:w-48">
            <img
              src={video.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/20" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-sm text-[#1B2430] shadow-md transition-transform duration-200 group-hover:scale-110">
                ▶
              </span>
            </div>

            {/* YouTube badge */}
            <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
              WATCH
            </span>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5">
            <div>
              <h5 className="line-clamp-2 text-sm font-semibold leading-5 text-[#1B2430] group-hover:text-[#374151]">
                {video.title}
              </h5>

              <p className="mt-1.5 truncate text-xs text-[#6B7280]">
                {video.channel}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[#4A5666]">
                Watch recipe
              </span>

              <span className="text-sm text-[#4A5666] transition-transform group-hover:translate-x-1">
                →
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

/* ---------- a single meal ---------- */

function MealRow({ meal, haveList, assumeBasics, isTop, shopping, onToggleShopping, onAddAll }) {
  const [open, setOpen] = useState(false);

  const all = meal.ingredients ?? [];
  const missing = meal._missing;
  const haveCount = all.length - missing.length;
  const complete = missing.length === 0;

  return (
    <li
      className={`rounded-lg border bg-white ${
        isTop ? "border-l-4 border-[#1B2430] border-y-[#D5DBE1] border-r-[#D5DBE1]" : "border-[#D5DBE1]"
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h3 className="wrap-break-words text-lg font-semibold leading-snug">
              {meal.emoji && <span className="mr-2">{meal.emoji}</span>}
              {meal.name}
            </h3>
            <p className="mt-1 text-sm text-[#4A5666]">{meal.description}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold">₹{meal.cost}</p>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm sm:gap-x-6">
          <div className="flex gap-1.5">
            <dt className="text-[#4A5666]">Time</dt>
            <dd className="font-medium">{meal.time} min</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#4A5666]">Protein</dt>
            <dd className="font-medium">{meal.protein} g</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#4A5666]">You have</dt>
            <dd className="font-medium">
              {haveCount} of {all.length} ingredients
            </dd>
          </div>
        </dl>

        {/* missing ingredients */}
        <div className="mt-4 rounded-md bg-[#F2F4F6] p-3">
          {complete ? (
            <p className="text-sm font-medium text-[#2E6B4A]">You have everything for this one.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-[#8F2A16]">
                  Missing {missing.length} {missing.length === 1 ? "ingredient" : "ingredients"}
                </p>
                <button
                  onClick={() => onAddAll(missing)}
                  className="shrink-0 py-1 text-sm underline underline-offset-2 hover:text-[#4A5666]"
                >
                  Add all to list
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missing.map((m) => {
                  const added = shopping.includes(m);
                  return (
                    <li key={m} className="max-w-full">
                      <button
                        onClick={() => onToggleShopping(m)}
                        aria-pressed={added}
                        className={`max-w-full wrap-break-words rounded border px-2.5 py-1.5 text-left text-sm sm:px-2 sm:py-1 ${
                          added
                            ? "border-[#1B2430] bg-[#1B2430] text-white"
                            : "border-[#E0A99E] bg-white text-[#8F2A16] hover:border-[#8F2A16]"
                        }`}
                      >
                        {added ? "Added: " : "+ "}
                        {m}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <YouTubeCard video={meal.youtube} />

        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-4 py-1 text-sm font-medium underline underline-offset-2 hover:text-[#4A5666]"
        >
          {open ? "Hide recipe" : "Show recipe"}
        </button>
      </div>

      {open && (
        <div className="grid gap-5 border-t border-[#E3E8ED] p-4 sm:gap-6 sm:p-5 md:grid-cols-2">
          <div>
            <h4 className="mb-2 font-semibold">Ingredients</h4>
            <ul className="space-y-1 text-sm">
              {all.map((item, i) => {
                const have = isCovered(item, haveList, assumeBasics);
                return (
                  <li key={i} className={have ? "text-[#1B2430]" : "text-[#8F2A16]"}>
                    {item}
                    {!have && <span className="ml-2 text-xs">(missing)</span>}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Method</h4>
            <ol className="space-y-2 text-sm">
              {(meal.steps ?? []).map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 shrink-0 text-[#4A5666]">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </li>
  );
}
