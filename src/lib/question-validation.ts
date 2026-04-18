import { z } from "zod";
import { CATEGORIES } from "@/constants/categories";
import { extractPlaceholderIndices } from "@/lib/fill-blank-judge";

const CATEGORY_SET = new Set<string>(CATEGORIES as readonly string[]);

export const EXPLANATION_DEPTHS = ["short", "deep"] as const;
export type ExplanationDepth = (typeof EXPLANATION_DEPTHS)[number];

export type FormBlank = {
  index: number;
  answer: string;
  accept: string[];
  options: string[]; // length 4 when input_mode === "select"
};

export type QuestionFormValues = {
  category: string;
  subcategory: string | null;
  tags: string[];
  question_type: "multiple_choice" | "fill_blank" | "flashcard";
  question_text: string;
  options: [string, string, string, string];
  answer_index: number;
  difficulty: 1 | 2 | 3;
  explanation: string;
  explanation_depth: ExplanationDepth;
  image_url: string | null;
  card_front: string | null;
  card_back: string | null;
  input_mode: "text" | "select" | null;
  blanks: FormBlank[];
};

// Schema used by the manual form (after UI-side normalization)
export const questionSchema = z
  .object({
    category: z
      .string()
      .trim()
      .min(1, "カテゴリを選択してください")
      .refine((v) => CATEGORY_SET.has(v), "カテゴリが不正です"),
    subcategory: z.string().trim().nullable().optional(),
    tags: z
      .array(z.string().trim().min(1))
      .min(1, "タグを1つ以上指定してください")
      .max(3, "タグは最大3つまでです"),
    question_type: z.enum(["multiple_choice", "fill_blank", "flashcard"]),
    question_text: z.string().trim().max(2000).optional().default(""),
    options: z
      .array(z.string().trim())
      .length(4, "選択肢は4つ必要です"),
    answer_index: z.number().int(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    explanation: z.string().trim().max(4000).optional().default(""),
    explanation_depth: z.enum(EXPLANATION_DEPTHS),
    image_url: z.string().url().nullable().optional(),
    card_front: z.string().trim().nullable().optional(),
    card_back: z.string().trim().nullable().optional(),
    input_mode: z.enum(["text", "select"]).nullable().optional(),
    blanks: z
      .array(
        z.object({
          index: z.number().int().min(1),
          answer: z.string(),
          accept: z.array(z.string()).default([]),
          options: z.array(z.string()).default([]),
        }),
      )
      .default([]),
  })
  .superRefine((val, ctx) => {
    if (val.question_type === "flashcard") {
      if (!val.card_front || val.card_front.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["card_front"],
          message: "表面は必須です",
        });
      }
      if (!val.card_back || val.card_back.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["card_back"],
          message: "裏面は必須です",
        });
      }
      return;
    }

    if (val.question_type === "fill_blank") {
      if (!val.question_text || val.question_text.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["question_text"],
          message: "問題文は必須です",
        });
      }
      const placeholders = extractPlaceholderIndices(val.question_text ?? "");
      if (placeholders.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["question_text"],
          message: "問題文に {{1}} のような空欄を1つ以上含めてください",
        });
      }
      if (!val.input_mode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["input_mode"],
          message: "入力方式を選択してください",
        });
      }
      const blankIndices = new Set(val.blanks.map((b) => b.index));
      // Every placeholder needs a matching blank
      for (const p of placeholders) {
        if (!blankIndices.has(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blanks"],
            message: `{{${p}}} に対応する空欄が定義されていません`,
          });
        }
      }
      // Every blank needs a placeholder reference (no orphans)
      const placeholderSet = new Set(placeholders);
      val.blanks.forEach((b, i) => {
        if (!placeholderSet.has(b.index)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blanks", i, "index"],
            message: `{{${b.index}}} は問題文に存在しません`,
          });
        }
        if (!b.answer || b.answer.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blanks", i, "answer"],
            message: "正解は必須です",
          });
        }
        if (val.input_mode === "select") {
          const opts = b.options ?? [];
          if (opts.length !== 4 || opts.some((o) => !o || o.trim().length === 0)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["blanks", i, "options"],
              message: "選択肢は4つすべて必須です",
            });
          } else if (!opts.includes(b.answer)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["blanks", i, "options"],
              message: "選択肢の中に正解を含めてください",
            });
          }
        }
      });
      if (!val.explanation || val.explanation.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["explanation"],
          message: "解説は必須です",
        });
      }
      return;
    }

    // multiple_choice
    if (!val.question_text || val.question_text.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_text"],
        message: "問題文は必須です",
      });
    }
    if (!val.explanation || val.explanation.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["explanation"],
        message: "解説は必須です",
      });
    }
    val.options.forEach((o, i) => {
      if (!o || o.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", i],
          message: "選択肢は空にできません",
        });
      }
    });
    if (val.answer_index < 0 || val.answer_index > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answer_index"],
        message: "正解を選択してください",
      });
    }
  });

// More tolerant schema for bulk JSON import (raw input may have unknown fields)
const blankImportSchema = z.object({
  index: z.number().int().min(1),
  answer: z.string().min(1, "blank.answer は必須です"),
  accept: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
});

const baseImport = z.object({
  category: z.string().trim().min(1).refine((v) => CATEGORY_SET.has(v), "category が不正です"),
  subcategory: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).max(10).optional().default([]),
  question_type: z
    .enum(["multiple_choice", "fill_blank", "flashcard"])
    .optional()
    .default("multiple_choice"),
  question_text: z.string().trim().min(1, "question_text は必須です"),
  options: z.array(z.string().trim().min(1)).optional(),
  answer_index: z.number().int().optional(),
  card_front: z.string().trim().optional(),
  card_back: z.string().trim().optional(),
  input_mode: z.enum(["text", "select"]).optional(),
  blanks: z.array(blankImportSchema).optional(),
  explanation: z.string().trim().optional().default(""),
  explanation_depth: z.enum(EXPLANATION_DEPTHS, {
    errorMap: () => ({ message: "explanation_depth は 'short' または 'deep' です" }),
  }),
  difficulty: z
    .number()
    .int()
    .refine((v) => v === 1 || v === 2 || v === 3, "difficulty は 1〜3 です"),
  image_url: z.string().url("image_url は有効なURLである必要があります").optional(),
});

export const importItemSchema = baseImport.passthrough().superRefine((val, ctx) => {
  if (val.question_type === "multiple_choice") {
    if (!val.options || val.options.length !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "options は4要素の配列である必要があります",
      });
    }
    if (
      typeof val.answer_index !== "number" ||
      val.answer_index < 0 ||
      val.answer_index > 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answer_index"],
        message: "answer_index は 0〜3 の範囲です",
      });
    }
    if (!val.explanation || val.explanation.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["explanation"],
        message: "explanation は必須です",
      });
    }
  } else if (val.question_type === "flashcard") {
    if (!val.card_front || val.card_front.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["card_front"],
        message: "card_front は必須です",
      });
    }
    if (!val.card_back || val.card_back.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["card_back"],
        message: "card_back は必須です",
      });
    }
  } else if (val.question_type === "fill_blank") {
    if (!val.input_mode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["input_mode"],
        message: "input_mode は 'text' または 'select' です",
      });
    }
    const placeholders = extractPlaceholderIndices(val.question_text);
    if (placeholders.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_text"],
        message: "question_text に {{N}} 形式の空欄を1つ以上含めてください",
      });
    }
    if (!val.blanks || val.blanks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blanks"],
        message: "blanks は1件以上必要です",
      });
    } else {
      const blankIdx = new Set(val.blanks.map((b) => b.index));
      for (const p of placeholders) {
        if (!blankIdx.has(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["blanks"],
            message: `{{${p}}} に対応する blank がありません`,
          });
        }
      }
      val.blanks.forEach((b, i) => {
        if (val.input_mode === "select") {
          if (!b.options || b.options.length !== 4) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["blanks", i, "options"],
              message: "options は4要素必須です",
            });
          } else if (!b.options.includes(b.answer)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["blanks", i, "options"],
              message: "options に answer を含めてください",
            });
          }
        }
      });
    }
    if (!val.explanation || val.explanation.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["explanation"],
        message: "explanation は必須です",
      });
    }
  }
});

export type ImportItem = z.infer<typeof baseImport>;

export type ImportPreviewRow = {
  index: number;
  raw: unknown;
  parsed: ImportItem | null;
  errors: string[];
};

export function previewImport(jsonText: string): {
  rows: ImportPreviewRow[];
  parseError: string | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      rows: [],
      parseError: `JSONのパースに失敗しました: ${(e as Error).message}`,
    };
  }
  if (!Array.isArray(parsed)) {
    return { rows: [], parseError: "トップレベルは配列である必要があります" };
  }
  const rows: ImportPreviewRow[] = parsed.map((raw, index) => {
    const result = importItemSchema.safeParse(raw);
    if (result.success) {
      return { index, raw, parsed: result.data as ImportItem, errors: [] };
    }
    const errors = result.error.issues.map((i) => {
      const path = i.path.join(".");
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { index, raw, parsed: null, errors };
  });
  return { rows, parseError: null };
}
