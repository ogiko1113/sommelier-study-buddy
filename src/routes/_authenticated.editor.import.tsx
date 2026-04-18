import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { previewImport, type ImportPreviewRow } from "@/lib/question-validation";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/editor/import")({
  component: EditorImportPage,
});

const PLACEHOLDER = `[
  {
    "category": "フランス",
    "subcategory": "ボルドー",
    "tags": ["格付け"],
    "question_type": "multiple_choice",
    "question_text": "...",
    "options": ["A", "B", "C", "D"],
    "answer_index": 1,
    "explanation": "...",
    "explanation_depth": "deep",
    "difficulty": 2
  }
]`;

function EditorImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);

  const onPreview = () => {
    const { rows: r, parseError: pe } = previewImport(text);
    setRows(r);
    setParseError(pe);
    // Default check valid rows only
    const next: Record<number, boolean> = {};
    for (const row of r) {
      next[row.index] = row.errors.length === 0;
    }
    setChecked(next);
  };

  const validCount = useMemo(
    () => rows.filter((r) => r.errors.length === 0 && checked[r.index]).length,
    [rows, checked],
  );

  const onImport = async () => {
    if (!user) return;
    const toInsert = rows.filter((r) => r.errors.length === 0 && checked[r.index] && r.parsed);
    if (toInsert.length === 0) return;
    setImporting(true);
    const payload = toInsert.map((r) => {
      const p = r.parsed!;
      const isCard = p.question_type === "flashcard";
      const isFill = p.question_type === "fill_blank";
      return {
        user_id: user.id,
        category: p.category,
        subcategory: p.subcategory ?? null,
        tags: p.tags ?? [],
        question_type: p.question_type,
        question_text: isCard ? "" : p.question_text,
        options: isCard || isFill ? [] : (p.options ?? []),
        answer_index: isCard || isFill ? 0 : (p.answer_index ?? 0),
        difficulty: p.difficulty,
        explanation: p.explanation,
        explanation_depth: p.explanation_depth,
        image_url: (p as any).image_url ?? null,
        card_front: isCard ? (p.card_front ?? null) : null,
        card_back: isCard ? (p.card_back ?? null) : null,
        input_mode: isFill ? (p.input_mode ?? null) : null,
        blanks: isFill ? (p.blanks ?? null) : null,
      };
    });
    const { error, count } = await (supabase as any)
      .from("questions")
      .insert(payload, { count: "exact" });
    setImporting(false);
    if (error) {
      console.error("import error", error);
      toast.error(`インポートに失敗しました: ${error.message}`);
      return;
    }
    toast.success(`${count ?? toInsert.length} 件をインポートしました`);
    navigate({ to: "/editor" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/editor" className="text-sm text-muted-foreground">
          ← 一覧へ
        </Link>
        <h1 className="text-lg font-semibold">JSON一括インポート</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-6">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={12}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={onPreview} disabled={!text.trim()}>
              プレビュー
            </Button>
          </div>
        </div>

        {parseError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {parseError}
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground tabular-nums">
              {rows.length} 件のうち {validCount} 件をインポート可能
            </p>
            <ul className="space-y-2">
              {rows.map((r) => {
                const invalid = r.errors.length > 0;
                const c = checked[r.index] ?? false;
                const preview =
                  typeof (r.raw as any)?.question_text === "string"
                    ? ((r.raw as any).question_text as string)
                    : "(question_text 不明)";
                const truncated = preview.length > 80 ? preview.slice(0, 80) + "…" : preview;
                return (
                  <li
                    key={r.index}
                    className={`rounded-lg border p-3 ${
                      invalid
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-input bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!invalid && c}
                        disabled={invalid}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [r.index]: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 accent-primary"
                        aria-label={`行 ${r.index + 1} をインポート対象にする`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm leading-snug text-foreground">
                          {(r.raw as any)?.question_type === "fill_blank" ? "📝 " : ""}
                          {(r.raw as any)?.question_type === "flashcard" ? "🃏 " : ""}
                          {(r.raw as any)?.image_url ? "🖼 画像あり · " : ""}
                          {truncated}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {(r.raw as any)?.category ?? "—"} ·{" "}
                          {(r.raw as any)?.question_type ?? "multiple_choice"} · 難{" "}
                          {(r.raw as any)?.difficulty ?? "—"}
                        </p>
                        {invalid && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-destructive">
                            {r.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              onClick={onImport}
              disabled={validCount === 0 || importing}
              className="h-12 w-full text-base font-medium"
            >
              {importing ? "インポート中..." : `${validCount} 件をインポート`}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
