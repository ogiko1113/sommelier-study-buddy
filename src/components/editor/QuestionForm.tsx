import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, SUBCATEGORIES } from "@/constants/categories";
import { TAGS } from "@/constants/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { questionSchema, type QuestionFormValues } from "@/lib/question-validation";
import { ImageUploadField } from "@/components/editor/ImageUploadField";

export type SubmitMode = "save" | "save_and_new";

interface QuestionFormProps {
  initial?: Partial<QuestionFormValues>;
  /** Hide "save and create another" (used in the edit screen). */
  showSaveAndNew?: boolean;
  submitting?: boolean;
  onSubmit: (values: QuestionFormValues, mode: SubmitMode) => Promise<void> | void;
  /** Optional extra footer slot rendered after the save buttons (used by edit screen). */
  footerSlot?: React.ReactNode;
}

const EMPTY_VALUES: QuestionFormValues = {
  category: CATEGORIES[0],
  subcategory: null,
  tags: [],
  question_type: "multiple_choice",
  question_text: "",
  options: ["", "", "", ""],
  answer_index: -1 as unknown as number, // forces user to pick
  difficulty: 1,
  explanation: "",
  explanation_depth: "short",
  image_url: null,
  card_front: null,
  card_back: null,
};

export function QuestionForm({
  initial,
  showSaveAndNew = true,
  submitting = false,
  onSubmit,
  footerSlot,
}: QuestionFormProps) {
  const [values, setValues] = useState<QuestionFormValues>(() => ({
    ...EMPTY_VALUES,
    ...initial,
    options:
      (initial?.options as [string, string, string, string] | undefined) ??
      EMPTY_VALUES.options,
    tags: initial?.tags ?? EMPTY_VALUES.tags,
  }));
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);

  // Reset when `initial` identity changes (e.g. edit page loaded different question)
  useEffect(() => {
    if (!initial) return;
    setValues((prev) => ({
      ...prev,
      ...initial,
      options:
        (initial.options as [string, string, string, string] | undefined) ?? prev.options,
      tags: initial.tags ?? prev.tags,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const subcats = useMemo(() => SUBCATEGORIES[values.category] ?? [], [values.category]);

  // Clear subcategory if not applicable
  useEffect(() => {
    if (subcats.length === 0 && values.subcategory) {
      setValues((v) => ({ ...v, subcategory: null }));
    }
  }, [subcats, values.subcategory]);

  const setField = <K extends keyof QuestionFormValues>(
    key: K,
    val: QuestionFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: val }));
  };

  const setOption = (idx: number, val: string) => {
    setValues((v) => {
      const next = [...v.options] as [string, string, string, string];
      next[idx] = val;
      return { ...v, options: next };
    });
  };

  const toggleTag = (t: string) => {
    setValues((v) => {
      if (v.tags.includes(t)) return { ...v, tags: v.tags.filter((x) => x !== t) };
      if (v.tags.length >= 3) return v;
      return { ...v, tags: [...v.tags, t] };
    });
  };

  const addCustomTag = () => {
    const raw = tagInput.trim();
    if (!raw) return;
    setValues((v) => {
      if (v.tags.includes(raw)) return v;
      if (v.tags.length >= 3) return v;
      return { ...v, tags: [...v.tags, raw] };
    });
    setTagInput("");
  };

  const removeTag = (t: string) =>
    setValues((v) => ({ ...v, tags: v.tags.filter((x) => x !== t) }));

  const submit = async (mode: SubmitMode) => {
    const candidate: QuestionFormValues = {
      ...values,
      // normalize subcategory to null when blank
      subcategory: values.subcategory && values.subcategory.length > 0 ? values.subcategory : null,
    };
    const result = questionSchema.safeParse(candidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await onSubmit(candidate, mode);
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  return (
    <div className="space-y-6">
      {/* Image */}
      <ImageUploadField
        value={values.image_url ?? null}
        onChange={(url) => setField("image_url", url)}
        onUploadingChange={setImageUploading}
      />

      {/* Category */}
      <div className="space-y-2">
        <Label className="text-base">カテゴリ <span className="text-destructive">*</span></Label>
        <select
          value={values.category}
          onChange={(e) => setField("category", e.target.value)}
          className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {fieldError("category")}
      </div>

      {/* Subcategory (conditional) */}
      {subcats.length > 0 && (
        <div className="space-y-2">
          <Label className="text-base">サブカテゴリ</Label>
          <select
            value={values.subcategory ?? ""}
            onChange={(e) =>
              setField("subcategory", e.target.value === "" ? null : e.target.value)
            }
            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
          >
            <option value="">(未指定)</option>
            {subcats.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-base">
          タグ <span className="text-destructive">*</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({values.tags.length}/3)
          </span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const selected = values.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`h-9 rounded-full border px-3 text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomTag();
              }
            }}
            placeholder="カスタムタグを追加"
          />
          <Button type="button" variant="outline" onClick={addCustomTag}>
            追加
          </Button>
        </div>
        {values.tags.filter((t) => !(TAGS as readonly string[]).includes(t)).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {values.tags
              .filter((t) => !(TAGS as readonly string[]).includes(t))
              .map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-input bg-muted px-3 py-1 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`タグ ${t} を削除`}
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
        )}
        {fieldError("tags")}
      </div>

      {/* Question type tabs */}
      <div className="space-y-2">
        <Label className="text-base">問題形式</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setField("question_type", "multiple_choice")}
            className={`h-10 flex-1 rounded-md border text-sm font-medium transition-colors ${
              values.question_type === "multiple_choice"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground"
            }`}
          >
            クイズ(4択)
          </button>
          <button
            type="button"
            onClick={() => setField("question_type", "flashcard")}
            className={`h-10 flex-1 rounded-md border text-sm font-medium transition-colors ${
              values.question_type === "flashcard"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground"
            }`}
          >
            カード
          </button>
          <button
            type="button"
            disabled
            className="h-10 flex-1 rounded-md border border-input bg-muted text-sm font-medium text-muted-foreground"
          >
            穴埋め
          </button>
        </div>
      </div>

      {values.question_type === "flashcard" ? (
        <>
          <div className="space-y-2">
            <Label className="text-base">
              表面 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={values.card_front ?? ""}
              onChange={(e) => setField("card_front", e.target.value)}
              rows={4}
              className="text-base"
              placeholder="例: ボルドー左岸の代表的な品種は?"
            />
            {fieldError("card_front")}
          </div>
          <div className="space-y-2">
            <Label className="text-base">
              裏面 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={values.card_back ?? ""}
              onChange={(e) => setField("card_back", e.target.value)}
              rows={4}
              className="text-base"
              placeholder="例: カベルネ・ソーヴィニヨン"
            />
            {fieldError("card_back")}
          </div>
        </>
      ) : (
        <>
          {/* Question text */}
          <div className="space-y-2">
            <Label className="text-base">
              問題文 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={values.question_text}
              onChange={(e) => setField("question_text", e.target.value)}
              rows={4}
              className="text-base"
            />
            {fieldError("question_text")}
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-base">
              選択肢 <span className="text-destructive">*</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (左のラジオで正解を選択)
              </span>
            </Label>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="answer_index"
                    checked={values.answer_index === idx}
                    onChange={() => setField("answer_index", idx)}
                    className="h-5 w-5 accent-primary"
                    aria-label={`選択肢 ${idx + 1} を正解にする`}
                  />
                  <span className="w-5 text-sm font-semibold text-muted-foreground tabular-nums">
                    {idx + 1}.
                  </span>
                  <Input
                    value={values.options[idx]}
                    onChange={(e) => setOption(idx, e.target.value)}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            {fieldError("options")}
            {fieldError("answer_index")}
          </div>
        </>
      )}

      {/* Difficulty */}
      <div className="space-y-2">
        <Label className="text-base">
          難易度 <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setField("difficulty", d as 1 | 2 | 3)}
              className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                values.difficulty === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-foreground"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div className="space-y-2">
        <Label className="text-base">
          解説{" "}
          {values.question_type === "flashcard" ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(任意)</span>
          ) : (
            <span className="text-destructive">*</span>
          )}
        </Label>
        <Textarea
          value={values.explanation}
          onChange={(e) => setField("explanation", e.target.value)}
          rows={4}
          className="text-base"
        />
        {fieldError("explanation")}
      </div>

      {/* Explanation depth */}
      <div className="space-y-2">
        <Label className="text-base">
          解説の深さ <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          {(["short", "deep"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setField("explanation_depth", d)}
              className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                values.explanation_depth === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-foreground"
              }`}
            >
              {d === "short" ? "簡潔" : "詳細"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          type="button"
          onClick={() => submit("save")}
          disabled={submitting || imageUploading}
          className="h-14 w-full text-base font-medium"
        >
          {submitting ? "保存中..." : imageUploading ? "画像アップロード中..." : "保存"}
        </Button>
        {showSaveAndNew && (
          <Button
            type="button"
            variant="outline"
            onClick={() => submit("save_and_new")}
            disabled={submitting || imageUploading}
            className="h-12 w-full text-sm font-medium"
          >
            保存して続けて作成(カテゴリ・タグを保持)
          </Button>
        )}
        {footerSlot}
      </div>
    </div>
  );
}
