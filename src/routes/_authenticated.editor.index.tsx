import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CATEGORIES } from "@/constants/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/editor/")({
  component: EditorListPage,
});

type ArchiveFilter = "non_archived" | "all" | "archived";
type TypeFilter = "all" | "multiple_choice" | "flashcard" | "fill_blank";
type DifficultyFilter = "all" | "1" | "2" | "3";
type ReviewFilter = "all" | "needs_review";

interface QRow {
  id: string;
  category: string;
  subcategory: string | null;
  question_text: string;
  question_type: string;
  difficulty: number;
  needs_review: boolean;
  is_archived: boolean;
  image_url: string | null;
  correct_count: number;
  wrong_count: number;
  created_at: string;
}

const PAGE_SIZE = 20;

function EditorListPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [review, setReview] = useState<ReviewFilter>("all");
  const [archive, setArchive] = useState<ArchiveFilter>("non_archived");
  const [keyword, setKeyword] = useState("");
  const [keywordDebounced, setKeywordDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<QRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Debounce keyword
  useEffect(() => {
    const id = setTimeout(() => {
      setKeywordDebounced(keyword.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [keyword]);

  // Reset to first page on any filter change
  useEffect(() => {
    setPage(0);
  }, [category, type, difficulty, review, archive]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let q = (supabase as any)
        .from("questions")
        .select(
          "id, category, subcategory, question_text, question_type, difficulty, needs_review, is_archived, image_url, correct_count, wrong_count, created_at",
          { count: "exact" },
        );

      if (category !== "all") q = q.eq("category", category);
      if (type !== "all") q = q.eq("question_type", type);
      if (difficulty !== "all") q = q.eq("difficulty", Number(difficulty));
      if (review === "needs_review") q = q.eq("needs_review", true);

      if (archive === "non_archived") q = q.eq("is_archived", false);
      else if (archive === "archived") q = q.eq("is_archived", true);
      // archive === "all": no filter

      if (keywordDebounced) {
        q = q.ilike("question_text", `%${keywordDebounced}%`);
      }

      q = q
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, error: err, count } = await q;
      if (cancelled) return;
      if (err) {
        console.error("editor list error", err);
        setError("問題の読み込みに失敗しました");
        setRows([]);
        return;
      }
      setError(null);
      setRows((data ?? []) as QRow[]);
      setTotal(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, category, type, difficulty, review, archive, keywordDebounced, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 戻る
        </Link>
        <h1 className="text-lg font-semibold">問題エディタ</h1>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        {/* Filter bar */}
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">カテゴリ</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="all">すべて</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">問題形式</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TypeFilter)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="all">すべて</option>
                <option value="multiple_choice">クイズ</option>
                <option value="flashcard">カード</option>
                <option value="fill_blank">穴埋め</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">難易度</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="all">すべて</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">要復習</Label>
              <select
                value={review}
                onChange={(e) => setReview(e.target.value as ReviewFilter)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="all">すべて</option>
                <option value="needs_review">要復習のみ</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">アーカイブ</Label>
              <select
                value={archive}
                onChange={(e) => setArchive(e.target.value as ArchiveFilter)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                <option value="non_archived">非アーカイブのみ</option>
                <option value="all">すべて</option>
                <option value="archived">アーカイブのみ</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">キーワード</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="問題文を検索"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {total} 件
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/editor/import">📋 JSONインポート</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/editor/new">+ 新規作成</Link>
              </Button>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* List */}
        <div className="space-y-2">
          {rows === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当する問題がありません</p>
          ) : (
            rows.map((r) => {
              const totalAns = (r.correct_count ?? 0) + (r.wrong_count ?? 0);
              const acc =
                totalAns > 0 ? Math.round(((r.correct_count ?? 0) / totalAns) * 100) : null;
              return (
                <div
                  key={r.id}
                  className="rounded-lg border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                          {r.category}
                          {r.subcategory ? ` / ${r.subcategory}` : ""}
                        </span>
                        <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                          {r.question_type === "multiple_choice"
                            ? "クイズ"
                            : r.question_type === "flashcard"
                              ? "カード"
                              : "穴埋め"}
                        </span>
                        <span className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground tabular-nums">
                          難 {r.difficulty}
                        </span>
                        {r.needs_review && (
                          <span title="要復習" aria-label="要復習">
                            🚩
                          </span>
                        )}
                        {r.is_archived && (
                          <span title="アーカイブ済み" aria-label="アーカイブ済み">
                            📦
                          </span>
                        )}
                        {r.image_url && (
                          <span title="画像あり" aria-label="画像あり">
                            🖼
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-snug text-foreground">
                        {r.question_text.length > 60
                          ? r.question_text.slice(0, 60) + "…"
                          : r.question_text}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        正答率 {acc === null ? "—" : `${acc}%`}{" "}
                        ({r.correct_count}/{totalAns})
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/editor/$id" params={{ id: r.id }}>
                        編集
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← 前へ
            </Button>
            <p className="text-xs text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ →
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
