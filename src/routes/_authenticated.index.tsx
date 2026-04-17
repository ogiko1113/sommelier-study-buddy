import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

type TagStat = {
  tag: string;
  total_answers: number;
  correct_rate: number | null;
};

type CategoryStat = {
  category: string;
  total_answers: number;
  correct_rate: number | null;
};

function rateColorClass(rate: number) {
  if (rate < 0.6) return "bg-red-500/15 border-red-500/40";
  if (rate < 0.75) return "bg-amber-500/15 border-amber-500/40";
  return "bg-emerald-500/15 border-emerald-500/40";
}

function HomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [tagStats, setTagStats] = useState<TagStat[] | null>(null);
  const [tagStatsError, setTagStatsError] = useState<string | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[] | null>(null);
  const [categoryStatsError, setCategoryStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .not("next_review_at", "is", null)
        .lte("next_review_at", nowIso)
        .lt("srs_stage", 5);
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // tag_stats view isn't in generated types — cast to any
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // category_stats view isn't in generated types — cast to any
      const { data, error } = await (supabase as any)
        .from("category_stats")
        .select("category,total_answers,correct_rate")
        .order("correct_rate", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      if (error) {
        console.error("category_stats error", error);
        setCategoryStatsError("カテゴリ統計を取得できませんでした");
        setCategoryStats([]);
      } else {
        setCategoryStats((data ?? []) as CategoryStat[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-5 py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Wine Master</h1>
        <button
          onClick={onLogout}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ログアウト
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-8">
        <Link
          to="/srs/run"
          className="block rounded-2xl border bg-card p-6 shadow-sm transition-colors hover:bg-accent"
        >
          <p className="text-sm font-medium text-muted-foreground">本日のSRS</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold text-primary tabular-nums">
              {dueCount ?? "—"}
            </span>
            <span className="text-base text-muted-foreground">問</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">復習待ち + スター付き</p>
        </Link>

        <div className="space-y-3">
          <Button
            asChild
            className="h-14 w-full text-base font-medium"
          >
            <Link to="/quiz/setup">クイズを始める</Link>
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
            disabled={dueCount === 0}
            className="h-14 w-full text-base font-medium"
          >
            {dueCount === 0 ? (
              <span className="opacity-50">SRS復習(なし)</span>
            ) : (
              <Link to="/srs/run">SRS復習</Link>
            )}
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">カテゴリ別正答率</h2>
          {categoryStats === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : categoryStatsError ? (
            <p className="text-sm text-destructive">{categoryStatsError}</p>
          ) : categoryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ回答記録がありません
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryStats.map((row) => {
                const insufficient =
                  row.total_answers < 5 || row.correct_rate === null;
                const rate = row.correct_rate ?? 0;
                const colorClass = insufficient
                  ? "bg-muted border-border opacity-60"
                  : rateColorClass(rate);
                return (
                  <li key={row.category}>
                    <Link
                      to="/quiz/setup"
                      search={{ category: row.category }}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:brightness-95 ${colorClass}`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {row.category}
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
                        <span
                          aria-hidden
                          className="text-muted-foreground"
                        >
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
      </main>
    </div>
  );
}
