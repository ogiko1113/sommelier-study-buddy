import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { QuestionForm, type SubmitMode } from "@/components/editor/QuestionForm";
import type { QuestionFormValues } from "@/lib/question-validation";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/editor/new")({
  component: EditorNewPage,
});

function EditorNewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  // Track values that should persist across "Save and create another" submissions.
  const [seed, setSeed] = useState<Partial<QuestionFormValues> | undefined>(undefined);
  // Re-mount key to fully reset the form between sequential entries
  const [formKey, setFormKey] = useState(0);

  const onSubmit = async (values: QuestionFormValues, mode: SubmitMode) => {
    if (!user) return;
    setSubmitting(true);
    const isCard = values.question_type === "flashcard";
    const isFill = values.question_type === "fill_blank";
    const { error } = await (supabase as any).from("questions").insert({
      user_id: user.id,
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
    });
    setSubmitting(false);
    if (error) {
      console.error("insert error", error);
      toast.error(`保存に失敗しました: ${error.message}`);
      return;
    }
    toast.success("問題を保存しました");
    if (mode === "save_and_new") {
      // Keep category, subcategory, tags
      setSeed({
        category: values.category,
        subcategory: values.subcategory,
        tags: values.tags,
        question_type: values.question_type,
      });
      setFormKey((k) => k + 1);
    } else {
      navigate({ to: "/editor" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/editor" className="text-sm text-muted-foreground">
          ← 一覧へ
        </Link>
        <h1 className="text-lg font-semibold">新規問題</h1>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">
        <QuestionForm
          key={formKey}
          initial={seed}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      </main>
    </div>
  );
}
