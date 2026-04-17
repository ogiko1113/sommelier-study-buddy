import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .or(`next_review_at.lte.${nowIso},is_starred.eq.true`);
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
      </main>
    </div>
  );
}
