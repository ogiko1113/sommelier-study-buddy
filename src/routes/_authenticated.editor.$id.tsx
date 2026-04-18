import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { QuestionForm, type SubmitMode } from "@/components/editor/QuestionForm";
import type { QuestionFormValues } from "@/lib/question-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/editor/$id")({
  component: EditorEditPage,
});

interface FullQuestion extends QuestionFormValues {
  id: string;
  is_archived: boolean;
  needs_review: boolean;
  review_note: string | null;
  correct_count: number;
  wrong_count: number;
  srs_stage: number;
  last_reviewed_at: string | null;
}

function EditorEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [question, setQuestion] = useState<FullQuestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("questions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("load error", error);
      setNotFound(true);
      setLoaded(true);
      return;
    }
    if (!data) {
      setNotFound(true);
      setLoaded(true);
      return;
    }
    const q: FullQuestion = {
      id: data.id,
      category: data.category,
      subcategory: data.subcategory,
      tags: data.tags ?? [],
      question_type: data.question_type,
      question_text: data.question_text,
      options: Array.isArray(data.options)
        ? (data.options as [string, string, string, string])
        : ["", "", "", ""],
      answer_index: data.answer_index,
      difficulty: data.difficulty,
      explanation: data.explanation,
      explanation_depth: data.explanation_depth,
      image_url: data.image_url ?? null,
      card_front: data.card_front ?? null,
      card_back: data.card_back ?? null,
      input_mode: data.input_mode ?? null,
      blanks: Array.isArray(data.blanks)
        ? data.blanks.map((b: any) => ({
            index: Number(b.index),
            answer: String(b.answer ?? ""),
            accept: Array.isArray(b.accept) ? b.accept.map(String) : [],
            options: Array.isArray(b.options) ? b.options.map(String) : [],
          }))
        : [],
      is_archived: !!data.is_archived,
      needs_review: !!data.needs_review,
      review_note: data.review_note ?? null,
      correct_count: data.correct_count ?? 0,
      wrong_count: data.wrong_count ?? 0,
      srs_stage: data.srs_stage ?? 0,
      last_reviewed_at: data.last_reviewed_at ?? null,
    };
    setQuestion(q);
    setLoaded(true);
  };

  useEffect(() => {
    setLoaded(false);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (values: QuestionFormValues, _mode: SubmitMode) => {
    setSubmitting(true);
    const isCard = values.question_type === "flashcard";
    const isFill = values.question_type === "fill_blank";
    const { error } = await (supabase as any)
      .from("questions")
      .update({
        category: values.category,
        subcategory: values.subcategory,
        tags: values.tags,
        question_type: values.question_type,
        question_text: isCard ? "" : values.question_text,
        options: isCard || isFill ? [] : values.options,
        answer_index: isCard || isFill ? 0 : values.answer_index,
        difficulty: values.difficulty,
        explanation: values.explanation,
        explanation_depth: values.explanation_depth,
        image_url: values.image_url,
        card_front: isCard ? values.card_front : null,
        card_back: isCard ? values.card_back : null,
        input_mode: isFill ? values.input_mode : null,
        blanks: isFill ? values.blanks : null,
      })
      .eq("id", id);
    setSubmitting(false);
    if (error) {
      console.error("update error", error);
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast.success("変更を保存しました");
    navigate({ to: "/editor" });
  };

  const onClearReviewFlag = async () => {
    const { error } = await (supabase as any)
      .from("questions")
      .update({ needs_review: false, review_note: null })
      .eq("id", id);
    if (error) {
      toast.error("フラグの解除に失敗しました");
      return;
    }
    toast.success("フラグを解除しました");
    setQuestion((q) => (q ? { ...q, needs_review: false, review_note: null } : q));
  };

  const onToggleArchive = async () => {
    if (!question) return;
    const newVal = !question.is_archived;
    const { error } = await (supabase as any)
      .from("questions")
      .update({ is_archived: newVal })
      .eq("id", id);
    if (error) {
      toast.error("アーカイブ操作に失敗しました");
      return;
    }
    toast.success(newVal ? "アーカイブしました" : "アーカイブを解除しました");
    setQuestion((q) => (q ? { ...q, is_archived: newVal } : q));
  };

  const onPermanentDelete = async () => {
    const { error } = await (supabase as any).from("questions").delete().eq("id", id);
    if (error) {
      toast.error(`削除に失敗しました: ${error.message}`);
      return;
    }
    toast.success("問題を完全に削除しました");
    setDeleteOpen(false);
    navigate({ to: "/editor" });
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }
  if (notFound || !question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">問題が見つかりません</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/editor">一覧へ戻る</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalAns = question.correct_count + question.wrong_count;
  const acc = totalAns > 0 ? Math.round((question.correct_count / totalAns) * 100) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/editor" className="text-sm text-muted-foreground">
          ← 一覧へ
        </Link>
        <h1 className="text-lg font-semibold">問題を編集</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">正解</p>
            <p className="text-lg font-semibold tabular-nums">{question.correct_count}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">誤答</p>
            <p className="text-lg font-semibold tabular-nums">{question.wrong_count}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">SRS</p>
            <p className="text-lg font-semibold tabular-nums">{question.srs_stage}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">最終</p>
            <p className="text-xs tabular-nums">
              {question.last_reviewed_at
                ? new Date(question.last_reviewed_at).toLocaleDateString("ja-JP")
                : "—"}
            </p>
          </div>
          {acc !== null && (
            <div className="col-span-4 text-center text-xs text-muted-foreground tabular-nums">
              正答率 {acc}%
            </div>
          )}
        </div>

        {question.needs_review && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">🚩 この問題は要復習です</p>
            {question.review_note && (
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                {question.review_note}
              </p>
            )}
          </div>
        )}

        <QuestionForm
          initial={question}
          showSaveAndNew={false}
          submitting={submitting}
          onSubmit={onSubmit}
          footerSlot={
            <div className="space-y-2 pt-2">
              {question.needs_review && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClearReviewFlag}
                  className="h-12 w-full text-sm font-medium"
                >
                  🚩 フラグを解除
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onToggleArchive}
                className="h-12 w-full text-sm font-medium"
              >
                {question.is_archived ? "📦 アーカイブを解除" : "📦 アーカイブする"}
              </Button>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteSection((v) => !v)}
                  className="text-xs text-muted-foreground underline"
                >
                  {showDeleteSection ? "完全削除を隠す" : "完全削除を表示"}
                </button>
                {showDeleteSection && (
                  <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      この操作は取り消せません。問題と関連する回答ログがすべて削除されます。
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setDeleteConfirm("");
                        setDeleteOpen(true);
                      }}
                    >
                      🗑 完全に削除
                    </Button>
                  </div>
                )}
              </div>
            </div>
          }
        />
      </main>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>本当に削除しますか?</DialogTitle>
            <DialogDescription>
              この問題と関連する回答ログがすべて完全に削除されます。この操作は取り消せません。
              続行するには下のフィールドに「delete」と入力してください。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="delete"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "delete"}
              onClick={onPermanentDelete}
            >
              完全に削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
