import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { getDailyGoal, getExamDateKey } from "@/lib/user-settings";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

// ---- Constants -------------------------------------------------------------

const EXPANDABLE_CATEGORIES = new Set(["フランス", "イタリア"]);


// ---- Helpers ---------------------------------------------------------------

function jstDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function jstMidnightUtc(key: string): Date {
  return new Date(`${key}T00:00:00+09:00`);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
}

function daysUntilExam(examKey: string): number {
  const todayKey = jstDateKey(new Date());
  const todayJst = jstMidnightUtc(todayKey);
  const examJst = jstMidnightUtc(examKey);
  const ms = examJst.getTime() - todayJst.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}


function computeStreak(keys: Set<string>): number {
  const todayKey = jstDateKey(new Date());
  const yesterdayKey = jstDateKey(addDays(new Date(), -1));
  let cursor: Date;
  if (keys.has(todayKey)) {
    cursor = jstMidnightUtc(todayKey);
  } else if (keys.has(yesterdayKey)) {
    cursor = jstMidnightUtc(yesterdayKey);
  } else {
    return 0;
  }
  let streak = 0;
  while (keys.has(jstDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function rateColorClass(rate: number) {
  if (rate < 0.6) return "bg-red-500/15 border-red-500/40";
  if (rate < 0.75) return "bg-amber-500/15 border-amber-500/40";
  return "bg-emerald-500/15 border-emerald-500/40";
}

// ---- Types -----------------------------------------------------------------

type TagStat = {
  tag: string;
  total_answers: number;
  correct_rate: number | null;
};

type CategoryAgg = {
  category: string;
  correct: number;
  wrong: number;
  total: number;
};

type SubcategoryAgg = {
  subcategory: string;
  correct: number;
  wrong: number;
  total: number;
};

type DifficultyAgg = {
  difficulty: number;
  correct: number;
  wrong: number;
  total: number;
};

type UncoveredAgg = {
  category: string;
  uncovered: number;
  total: number;
};

type TrendPoint = {
  key: string;
  label: string;
  accuracy: number | null;
};

// ---- Component -------------------------------------------------------------

function HomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [dueCount, setDueCount] = useState<number | null>(null);
  const [tagStats, setTagStats] = useState<TagStat[] | null>(null);
  const [tagStatsError, setTagStatsError] = useState<string | null>(null);

  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [trend, setTrend] = useState<TrendPoint[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [categoryAggs, setCategoryAggs] = useState<CategoryAgg[] | null>(null);
  const [subcategoryMap, setSubcategoryMap] = useState<Record<
    string,
    SubcategoryAgg[]
  > | null>(null);
  const [difficultyAggs, setDifficultyAggs] = useState<DifficultyAgg[] | null>(
    null,
  );
  const [uncoveredAggs, setUncoveredAggs] = useState<UncoveredAgg[] | null>(
    null,
  );
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // SRS due count (existing)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { count, error } = await (supabase as any)
        .from("questions")
        .select("id", { count: "exact", head: true })
        .not("next_review_at", "is", null)
        .lte("next_review_at", nowIso)
        .lt("srs_stage", 5)
        .eq("is_archived", false);
      if (!cancelled) {
        if (error) {
          console.error("due count error", error);
          setDueCount(0);
        } else {
          setDueCount(count ?? 0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Tag stats (existing)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("tag_stats")
        .select("tag,total_answers,correct_rate")
        .order("correct_rate", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (error) {
        console.error("tag_stats error", error);
        setTagStatsError("タグ統計を取得できませんでした");
        setTagStats([]);
      } else {
        setTagStats((data ?? []) as TagStat[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Today's count + streak + 7-day trend
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const todayKey = jstDateKey(new Date());
      const todayJst = jstMidnightUtc(todayKey);
      const tomorrowJst = addDays(todayJst, 1);
      const sixtyDaysAgoJst = addDays(todayJst, -60);

      // Today's count
      const todayP = (supabase as any)
        .from("answer_logs")
        .select("id", { count: "exact", head: true })
        .gte("answered_at", todayJst.toISOString())
        .lt("answered_at", tomorrowJst.toISOString());

      // 60-day window for streak + trend
      const windowP = (supabase as any)
        .from("answer_logs")
        .select("answered_at, is_correct")
        .gte("answered_at", sixtyDaysAgoJst.toISOString());

      const [todayRes, windowRes] = await Promise.all([todayP, windowP]);
      if (cancelled) return;

      if (todayRes.error) {
        console.error("today count error", todayRes.error);
        setActivityError("学習データを取得できませんでした");
        setTodayCount(0);
      } else {
        setTodayCount(todayRes.count ?? 0);
      }

      if (windowRes.error) {
        console.error("window error", windowRes.error);
        setActivityError("学習データを取得できませんでした");
        setStreak(0);
        setTrend([]);
        return;
      }

      const rows = (windowRes.data ?? []) as Array<{
        answered_at: string;
        is_correct: boolean;
      }>;

      // Streak: distinct JST day-keys
      const dayKeys = new Set<string>();
      for (const r of rows) dayKeys.add(jstDateKey(new Date(r.answered_at)));
      setStreak(computeStreak(dayKeys));

      // 7-day trend: bucket by JST day
      const buckets = new Map<string, { correct: number; total: number }>();
      for (const r of rows) {
        const key = jstDateKey(new Date(r.answered_at));
        const b = buckets.get(key) ?? { correct: 0, total: 0 };
        b.total += 1;
        if (r.is_correct) b.correct += 1;
        buckets.set(key, b);
      }
      const points: TrendPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = addDays(todayJst, -i);
        const key = jstDateKey(d);
        const b = buckets.get(key);
        const [, m, day] = key.split("-");
        points.push({
          key,
          label: `${parseInt(m, 10)}/${parseInt(day, 10)}`,
          accuracy: b && b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
        });
      }
      setTrend(points);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Single questions fetch → category, subcategory, difficulty, uncovered
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("questions")
        .select("category, subcategory, difficulty, correct_count, wrong_count")
        .eq("is_archived", false);
      if (cancelled) return;
      if (error) {
        console.error("questions agg error", error);
        setQuestionsError("カテゴリ統計を取得できませんでした");
        setCategoryAggs([]);
        setSubcategoryMap({});
        setDifficultyAggs([]);
        setUncoveredAggs([]);
        return;
      }
      const rows = (data ?? []) as Array<{
        category: string;
        subcategory: string | null;
        difficulty: number;
        correct_count: number;
        wrong_count: number;
      }>;

      const catMap = new Map<string, CategoryAgg>();
      const subMap = new Map<string, Map<string, SubcategoryAgg>>();
      const diffMap = new Map<number, DifficultyAgg>();
      const uncMap = new Map<string, UncoveredAgg>();

      for (const r of rows) {
        const cc = r.correct_count ?? 0;
        const wc = r.wrong_count ?? 0;
        const t = cc + wc;

        // Category
        const ca = catMap.get(r.category) ?? {
          category: r.category,
          correct: 0,
          wrong: 0,
          total: 0,
        };
        ca.correct += cc;
        ca.wrong += wc;
        ca.total += t;
        catMap.set(r.category, ca);

        // Subcategory (only for expandable categories)
        if (EXPANDABLE_CATEGORIES.has(r.category) && r.subcategory) {
          const inner = subMap.get(r.category) ?? new Map();
          const sa = inner.get(r.subcategory) ?? {
            subcategory: r.subcategory,
            correct: 0,
            wrong: 0,
            total: 0,
          };
          sa.correct += cc;
          sa.wrong += wc;
          sa.total += t;
          inner.set(r.subcategory, sa);
          subMap.set(r.category, inner);
        }

        // Difficulty
        if (r.difficulty >= 1 && r.difficulty <= 3) {
          const da = diffMap.get(r.difficulty) ?? {
            difficulty: r.difficulty,
            correct: 0,
            wrong: 0,
            total: 0,
          };
          da.correct += cc;
          da.wrong += wc;
          da.total += t;
          diffMap.set(r.difficulty, da);
        }

        // Uncovered
        const ua = uncMap.get(r.category) ?? {
          category: r.category,
          uncovered: 0,
          total: 0,
        };
        ua.total += 1;
        if (t === 0) ua.uncovered += 1;
        uncMap.set(r.category, ua);
      }

      // Sort categories by correct_rate ascending (matches old behavior)
      const cats = Array.from(catMap.values()).sort((a, b) => {
        const ar = a.total > 0 ? a.correct / a.total : 1;
        const br = b.total > 0 ? b.correct / b.total : 1;
        return ar - br;
      });
      setCategoryAggs(cats);

      const subObj: Record<string, SubcategoryAgg[]> = {};
      for (const [cat, inner] of subMap) {
        subObj[cat] = Array.from(inner.values()).sort((a, b) => {
          const ar = a.total > 0 ? a.correct / a.total : 1;
          const br = b.total > 0 ? b.correct / b.total : 1;
          return ar - br;
        });
      }
      setSubcategoryMap(subObj);

      const diffs: DifficultyAgg[] = [];
      for (const d of [1, 2, 3]) {
        diffs.push(
          diffMap.get(d) ?? {
            difficulty: d,
            correct: 0,
            wrong: 0,
            total: 0,
          },
        );
      }
      setDifficultyAggs(diffs);

      const uncovered = Array.from(uncMap.values())
        .filter((u) => u.uncovered > 0)
        .sort((a, b) => b.uncovered - a.uncovered);
      setUncoveredAggs(uncovered);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const toggleExpanded = (cat: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const examDays = useMemo(() => daysUntilExam(getExamDateKey()), []);
  const dailyGoal = useMemo(() => getDailyGoal(), []);

  const trendAllNull =
    trend !== null && trend.every((p) => p.accuracy === null);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-5 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Wine Master</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            設定
          </Link>
          <button
            onClick={onLogout}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ログアウト
          </button>
        </div>
      </header>


      <main className="mx-auto max-w-md space-y-6 px-5 py-8">
        {/* 1. Exam countdown */}
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">
            ソムリエ・ワインエキスパート一次試験
          </p>
          {examDays > 0 ? (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">試験まで</span>
              <span className="text-5xl font-bold text-primary tabular-nums">
                {examDays}
              </span>
              <span className="text-base text-muted-foreground">日</span>
            </div>
          ) : examDays === 0 ? (
            <p className="mt-2 text-3xl font-bold text-primary">試験当日です</p>
          ) : (
            <p className="mt-2 text-2xl font-semibold text-primary">
              試験お疲れさまでした
            </p>
          )}
        </div>

        {/* 2. SRS due count */}
        <div className="block rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">本日の復習</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold text-primary tabular-nums">
              {dueCount ?? "—"}
            </span>
            <span className="text-base text-muted-foreground">問が復習待ち</span>
          </div>
        </div>

        {/* 3. Action buttons */}
        <div className="space-y-3">
          <Button asChild className="h-14 w-full text-base font-medium">
            <Link to="/quiz/setup">クイズを始める</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full text-base font-medium"
          >
            <Link to="/cards/setup">フラッシュカードを始める</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-11 w-full text-sm font-medium"
          >
            <Link to="/drill">タグ横断演習</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-11 w-full text-sm font-medium"
          >
            <Link to="/editor">問題を編集</Link>
          </Button>
          {dueCount === 0 ? (
            <Button
              variant="outline"
              disabled
              className="h-14 w-full text-base font-medium opacity-50"
            >
              本日の復習なし
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-14 w-full text-base font-medium"
            >
              <Link to="/srs/run">
                SRS復習を始める
                {dueCount !== null && dueCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
                    {dueCount}
                  </span>
                )}
              </Link>
            </Button>
          )}
        </div>

        {/* 4. Today's learning + streak */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          {todayCount === null || streak === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : activityError ? (
            <p className="text-sm text-destructive">{activityError}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  本日の学習
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {todayCount}
                  </span>
                  <span className="text-muted-foreground">
                    問 / 目標 {dailyGoal}問
                  </span>
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((todayCount / dailyGoal) * 100, 100)}%`,
                    }}
                  />

                </div>
              </div>
              <div className="border-l pl-4">
                <p className="text-xs font-medium text-muted-foreground">
                  連続学習
                </p>
                <p className="mt-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {streak}
                  </span>
                  <span className="text-sm text-muted-foreground">日連続</span>
                  {streak >= 7 && <span className="ml-1">🔥</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. 7-day accuracy trend */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            直近7日の正答率
          </h2>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            {trend === null ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : trendAllNull ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                まだデータがありません
              </p>
            ) : (
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={trend}
                    margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v) => (v === null ? "—" : `${v}%`)}
                      labelStyle={{ fontSize: 12 }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* 6. Category accuracy with drill-down */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">カテゴリ別正答率</h2>
          {categoryAggs === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : questionsError ? (
            <p className="text-sm text-destructive">{questionsError}</p>
          ) : categoryAggs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ回答記録がありません
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryAggs.map((row) => {
                const insufficient = row.total < 5;
                const rate = row.total > 0 ? row.correct / row.total : 0;
                const colorClass = insufficient
                  ? "bg-muted border-border opacity-60"
                  : rateColorClass(rate);
                const isExpandable = EXPANDABLE_CATEGORIES.has(row.category);
                const isOpen = expanded.has(row.category);
                const subs = subcategoryMap?.[row.category] ?? [];

                const inner = (
                  <>
                    <span className="flex items-center gap-2">
                      {isExpandable && (
                        <span
                          aria-hidden
                          className="text-xs text-muted-foreground"
                        >
                          {isOpen ? "▼" : "▶"}
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {row.category}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {insufficient ? (
                        <span className="text-xs text-muted-foreground">
                          n&lt;5(計測不可)
                        </span>
                      ) : (
                        <>
                          <span className="text-base font-semibold tabular-nums text-foreground">
                            {Math.round(rate * 100)}%
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            n={row.total}
                          </span>
                        </>
                      )}
                      {!isExpandable && (
                        <span aria-hidden className="text-muted-foreground">
                          ›
                        </span>
                      )}
                    </span>
                  </>
                );

                return (
                  <li key={row.category} className="space-y-2">
                    {isExpandable ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.category)}
                        className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:brightness-95 ${colorClass}`}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link
                        to="/quiz/setup"
                        search={{ category: row.category } as any}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:brightness-95 ${colorClass}`}
                      >
                        {inner}
                      </Link>
                    )}

                    {isExpandable && isOpen && (
                      <ul className="ml-4 space-y-2">
                        {subs.length === 0 ? (
                          <li className="rounded-lg border border-dashed border-border px-4 py-2 text-xs text-muted-foreground">
                            サブカテゴリのデータがありません
                          </li>
                        ) : (
                          subs.map((s) => {
                            const sInsuff = s.total < 5;
                            const sRate = s.total > 0 ? s.correct / s.total : 0;
                            const sColor = sInsuff
                              ? "bg-muted border-border opacity-60"
                              : rateColorClass(sRate);
                            return (
                              <li key={s.subcategory}>
                                <Link
                                  to="/quiz/setup"
                                  search={
                                    {
                                      category: row.category,
                                      subcategory: s.subcategory,
                                    } as any
                                  }
                                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:brightness-95 ${sColor}`}
                                >
                                  <span className="font-medium text-foreground">
                                    {s.subcategory}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    {sInsuff ? (
                                      <span className="text-xs text-muted-foreground">
                                        n&lt;5
                                      </span>
                                    ) : (
                                      <>
                                        <span className="font-semibold tabular-nums text-foreground">
                                          {Math.round(sRate * 100)}%
                                        </span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                          n={s.total}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                </Link>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 7. Tag accuracy (unchanged) */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">タグ別正答率</h2>
          {tagStats === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : tagStatsError ? (
            <p className="text-sm text-destructive">{tagStatsError}</p>
          ) : tagStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ回答記録がありません
            </p>
          ) : (
            <ul className="space-y-2">
              {tagStats.map((row) => {
                const insufficient =
                  row.total_answers < 5 || row.correct_rate === null;
                const rate = row.correct_rate ?? 0;
                const colorClass = insufficient
                  ? "bg-muted border-border opacity-60"
                  : rateColorClass(rate);
                return (
                  <li key={row.tag}>
                    <Link
                      to="/drill"
                      search={{ tag: row.tag, autostart: "1" }}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:brightness-95 ${colorClass}`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {row.tag}
                      </span>
                      <span className="flex items-center gap-2">
                        {insufficient ? (
                          <span className="text-xs text-muted-foreground">
                            n&lt;5(計測不可)
                          </span>
                        ) : (
                          <>
                            <span className="text-base font-semibold tabular-nums text-foreground">
                              {Math.round(rate * 100)}%
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              n={row.total_answers}
                            </span>
                          </>
                        )}
                        <span aria-hidden className="text-muted-foreground">
                          ›
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 8. Difficulty accuracy */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            難易度別正答率
          </h2>
          {difficultyAggs === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : questionsError ? (
            <p className="text-sm text-destructive">{questionsError}</p>
          ) : (
            <ul className="space-y-2">
              {difficultyAggs.map((row) => {
                const insufficient = row.total < 5;
                const rate = row.total > 0 ? row.correct / row.total : 0;
                const colorClass = insufficient
                  ? "bg-muted border-border opacity-60"
                  : rateColorClass(rate);
                const stars = "★".repeat(row.difficulty);
                return (
                  <li
                    key={row.difficulty}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${colorClass}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-background/60 px-2 py-0.5 text-sm font-medium text-foreground">
                        {stars}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        難易度 {row.difficulty}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {insufficient ? (
                        <span className="text-xs text-muted-foreground">
                          n&lt;5(計測不可)
                        </span>
                      ) : (
                        <>
                          <span className="text-base font-semibold tabular-nums text-foreground">
                            {Math.round(rate * 100)}%
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            n={row.total}
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 9. Uncovered questions by category */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            未解答の問題
          </h2>
          {uncoveredAggs === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : questionsError ? (
            <p className="text-sm text-destructive">{questionsError}</p>
          ) : uncoveredAggs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              すべての問題に解答済みです 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {uncoveredAggs.map((row) => {
                const coverage =
                  row.total > 0 ? (row.total - row.uncovered) / row.total : 0;
                return (
                  <li
                    key={row.category}
                    className="rounded-lg border bg-card px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {row.category}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        残り{" "}
                        <span className="text-sm font-semibold text-foreground">
                          {row.uncovered}
                        </span>
                        問 / 全 {row.total}問
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.round(coverage * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
