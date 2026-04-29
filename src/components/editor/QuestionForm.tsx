import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CATEGORIES, SUBCATEGORIES } from "@/constants/categories";
import { TAGS } from "@/constants/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  questionSchema,
  type QuestionFormValues,
  type FormBlank,
} from "@/lib/question-validation";
import { ImageUploadField } from "@/components/editor/ImageUploadField";
import { extractPlaceholderIndices } from "@/lib/fill-blank-judge";

const FIELD_LABELS: Record<string, string> = {
  category: "カテゴリ",
  subcategory: "サブカテゴリ",
  tags: "タグ",
  question_type: "問題形式",
  question_text: "問題文",
  options: "選択肢",
  answer_index: "正解",
  difficulty: "難易度",
  explanation: "解説",
  explanation_depth: "解説の深さ",
  image_url: "画像",
  card_front: "表面",
  card_back: "裏面",
  input_mode: "入力方式",
  blanks: "空欄",
};

export type SubmitMode = "save" | "save_and_new";

interface QuestionFormProps {
  initial?: Partial<QuestionFormValues>;
  showSaveAndNew?: boolean;
  submitting?: boolean;
  onSubmit: (values: QuestionFormValues, mode: SubmitMode) => Promise<void> | void;
  footerSlot?: React.ReactNode;
}

const EMPTY_VALUES: QuestionFormValues = {
  category: CATEGORIES[0],
  subcategory: null,
  tags: [],
  question_type: "multiple_choice",
  question_text: "",
  options: ["", "", "", ""],
  answer_index: -1 as unknown as number,
  difficulty: 1,
  explanation: "",
  explanation_depth: "short",
  image_url: null,
  card_front: null,
  card_back: null,
  input_mode: null,
  blanks: [],
};

function makeBlank(index: number, inputMode: "text" | "select"): FormBlank {
  return {
    index,
    answer: "",
    accept: [],
    options: inputMode === "select" ? ["", "", "", ""] : [],
  };
}

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
    blanks: initial?.blanks ?? EMPTY_VALUES.blanks,
    input_mode: initial?.input_mode ?? EMPTY_VALUES.input_mode,
    answer_index:
      typeof initial?.answer_index === "number"
        ? initial.answer_index
        : EMPTY_VALUES.answer_index,
  }));
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setValues((prev) => ({
      ...prev,
      ...initial,
      options:
        (initial.options as [string, string, string, string] | undefined) ?? prev.options,
      tags: initial.tags ?? prev.tags,
      blanks: initial.blanks ?? prev.blanks,
      input_mode: initial.input_mode ?? prev.input_mode,
      answer_index:
        typeof initial.answer_index === "number" ? initial.answer_index : prev.answer_index,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const subcats = useMemo(() => SUBCATEGORIES[values.category] ?? [], [values.category]);

  useEffect(() => {
    if (subcats.length === 0 && values.subcategory) {
      setValues((v) => ({ ...v, subcategory: null }));
    }
  }, [subcats, values.subcategory]);

  // When switching to fill_blank, ensure input_mode defaults to "text"
  useEffect(() => {
    if (values.question_type === "fill_blank" && !values.input_mode) {
      setValues((v) => ({ ...v, input_mode: "text" }));
    }
  }, [values.question_type, values.input_mode]);

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

  // -------- Blank helpers --------
  const setBlank = (i: number, patch: Partial<FormBlank>) => {
    setValues((v) => {
      const next = [...v.blanks];
      next[i] = { ...next[i], ...patch };
      return { ...v, blanks: next };
    });
  };
  const setBlankOption = (i: number, oi: number, val: string) => {
    setValues((v) => {
      const next = [...v.blanks];
      const opts = [...(next[i].options ?? ["", "", "", ""])];
      opts[oi] = val;
      next[i] = { ...next[i], options: opts };
      return { ...v, blanks: next };
    });
  };
  const removeBlank = (i: number) => {
    setValues((v) => ({ ...v, blanks: v.blanks.filter((_, j) => j !== i) }));
  };
  const addBlank = () => {
    setValues((v) => {
      const used = new Set(v.blanks.map((b) => b.index));
      let n = 1;
      while (used.has(n)) n++;
      const mode = v.input_mode ?? "text";
      return { ...v, blanks: [...v.blanks, makeBlank(n, mode)] };
    });
  };
  const syncBlanksFromText = () => {
    setValues((v) => {
      const indices = extractPlaceholderIndices(v.question_text);
      const mode = v.input_mode ?? "text";
      const byIdx = new Map(v.blanks.map((b) => [b.index, b]));
      const next: FormBlank[] = indices.map((idx) => {
        const existing = byIdx.get(idx);
        if (existing) {
          // Adjust options length to mode
          if (mode === "select" && existing.options.length !== 4) {
            return { ...existing, options: ["", "", "", ""] };
          }
          if (mode === "text" && existing.options.length !== 0) {
            return { ...existing, options: [] };
          }
          return existing;
        }
        return makeBlank(idx, mode);
      });
      // Preserve orphans (blanks not in text) so user can decide
      const inText = new Set(indices);
      const orphans = v.blanks.filter((b) => !inText.has(b.index));
      return { ...v, blanks: [...next, ...orphans] };
    });
  };

  // When input_mode toggles, normalize blank.options length
  const onInputModeChange = (mode: "text" | "select") => {
    setValues((v) => ({
      ...v,
      input_mode: mode,
      blanks: v.blanks.map((b) =>
        mode === "select"
          ? { ...b, options: b.options.length === 4 ? b.options : ["", "", "", ""] }
          : { ...b, options: [] },
      ),
    }));
  };

  const placeholdersInText = useMemo(
    () => new Set(extractPlaceholderIndices(values.question_text)),
    [values.question_text],
  );

  const submit = async (mode: SubmitMode) => {
    const candidate: QuestionFormValues = {
      ...values,
      subcategory:
        values.subcategory && values.subcategory.length > 0 ? values.subcategory : null,
    };
    const result = questionSchema.safeParse(candidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Surface the first error as a toast so the user understands why save did nothing.
      const firstIssue = result.error.issues[0];
      const firstKey = firstIssue.path.join(".");
      const topKey = String(firstIssue.path[0] ?? "");
      const label = FIELD_LABELS[topKey] ?? topKey;
      toast.error(`入力エラー: ${label} — ${firstIssue.message}`);
      // Scroll the first invalid field into view if possible.
      if (typeof document !== "undefined") {
        const el =
          document.querySelector(`[data-field-error="${firstKey}"]`) ??
          document.querySelector(`[data-field-error="${topKey}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return;
    }
    setErrors({});
    await onSubmit(candidate, mode);
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  const isCard = values.question_type === "flashcard";
  const isFill = values.question_type === "fill_blank";
  const isMC = values.question_type === "multiple_choice";

  return (
    <div className="space-y-6">
      <ImageUploadField
        value={values.image_url ?? null}
        onChange={(url) => setField("image_url", url)}
        onUploadingChange={setImageUploading}
      />

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
              isMC
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
              isCard
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground"
            }`}
          >
            カード
          </button>
          <button
            type="button"
            onClick={() => setField("question_type", "fill_blank")}
            className={`h-10 flex-1 rounded-md border text-sm font-medium transition-colors ${
              isFill
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-foreground"
            }`}
          >
            穴埋め
          </button>
        </div>
      </div>

      {isCard && (
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
      )}

      {isFill && (
        <>
          <div className="space-y-2">
            <Label className="text-base">
              入力方式 <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              {(["text", "select"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onInputModeChange(m)}
                  className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                    values.input_mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-foreground"
                  }`}
                >
                  {m === "text" ? "記入式" : "選択式"}
                </button>
              ))}
            </div>
            {fieldError("input_mode")}
          </div>

          <div className="space-y-2">
            <Label className="text-base">
              問題文 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={values.question_text}
              onChange={(e) => setField("question_text", e.target.value)}
              rows={4}
              className="text-base"
              placeholder="例: {{1}}地方の{{2}}村は、{{3}}品種で造られる。"
            />
            <p className="text-xs text-muted-foreground">
              空欄は <code className="rounded bg-muted px-1">{"{{1}}"}</code>,{" "}
              <code className="rounded bg-muted px-1">{"{{2}}"}</code>{" "}
              のように書きます。番号は任意で、下の空欄リストと対応します。
            </p>
            {fieldError("question_text")}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">空欄リスト</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={syncBlanksFromText}
                >
                  問題文から同期
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addBlank}>
                  + 追加
                </Button>
              </div>
            </div>
            {values.blanks.length === 0 && (
              <p className="text-xs text-muted-foreground">
                問題文に {"{{1}}"} を書いてから「同期」を押してください。
              </p>
            )}
            <div className="space-y-3">
              {values.blanks.map((b, i) => {
                const orphan = !placeholdersInText.has(b.index);
                return (
                  <div
                    key={i}
                    className={`space-y-2 rounded-lg border p-3 ${
                      orphan ? "border-destructive/40 bg-destructive/5" : "border-input bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums">
                        {`{{${b.index}}}`}
                        {orphan && (
                          <span className="ml-2 text-xs text-destructive">
                            ⚠ 問題文に存在しません
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBlank(i)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`空欄 ${b.index} を削除`}
                      >
                        🗑 削除
                      </button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        正解 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={b.answer}
                        onChange={(e) => setBlank(i, { answer: e.target.value })}
                        className="text-sm"
                      />
                      {fieldError(`blanks.${i}.answer`)}
                    </div>
                    {values.input_mode === "text" && (
                      <div className="space-y-1">
                        <Label className="text-xs">許容回答 (カンマ区切り、任意)</Label>
                        <Input
                          value={(b.accept ?? []).join(", ")}
                          onChange={(e) =>
                            setBlank(i, {
                              accept: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter((s) => s.length > 0),
                            })
                          }
                          placeholder="例: 五, 5"
                          className="text-sm"
                        />
                      </div>
                    )}
                    {values.input_mode === "select" && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          選択肢 (4つ必須、正解を含むこと)
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[0, 1, 2, 3].map((oi) => (
                            <Input
                              key={oi}
                              value={(b.options ?? [])[oi] ?? ""}
                              onChange={(e) => setBlankOption(i, oi, e.target.value)}
                              placeholder={`選択肢 ${oi + 1}`}
                              className="text-sm"
                            />
                          ))}
                        </div>
                        {fieldError(`blanks.${i}.options`)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {fieldError("blanks")}
          </div>
        </>
      )}

      {isMC && (
        <>
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

      <div className="space-y-2">
        <Label className="text-base">
          解説{" "}
          {isCard ? (
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
