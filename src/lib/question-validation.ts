import { z } from "zod";
import { CATEGORIES } from "@/constants/categories";

const CATEGORY_SET = new Set<string>(CATEGORIES as readonly string[]);

export const EXPLANATION_DEPTHS = ["short", "deep"] as const;
export type ExplanationDepth = (typeof EXPLANATION_DEPTHS)[number];

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
  })
  .superRefine((val, ctx) => {
    if (val.question_type === "fill_blank") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_type"],
        message: "穴埋め問題は現在サポートされていません",
      });
      return;
    }
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
      if (!val.explanation || val.explanation.length === 0) {
        // explanation not required for flashcards — clear any prior error
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
export const importItemSchema = z
  .object({
    category: z.string().trim().min(1).refine((v) => CATEGORY_SET.has(v), "category が不正です"),
    subcategory: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).max(10).optional().default([]),
    question_type: z
      .string()
      .optional()
      .default("multiple_choice")
      .refine(
        (v) => v === "multiple_choice",
        "現在は multiple_choice のみサポートされています",
      ),
    question_text: z.string().trim().min(1, "question_text は必須です"),
    options: z
      .array(z.string().trim().min(1))
      .length(4, "options は4要素の配列である必要があります"),
    answer_index: z.number().int().min(0).max(3, "answer_index は 0〜3 の範囲です"),
    explanation: z.string().trim().min(1, "explanation は必須です"),
    explanation_depth: z.enum(EXPLANATION_DEPTHS, {
      errorMap: () => ({ message: "explanation_depth は 'short' または 'deep' です" }),
    }),
    difficulty: z
      .number()
      .int()
      .refine((v) => v === 1 || v === 2 || v === 3, "difficulty は 1〜3 です"),
    image_url: z.string().url("image_url は有効なURLである必要があります").optional(),
  })
  .passthrough();

export type ImportItem = z.infer<typeof importItemSchema>;

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
      return { index, raw, parsed: result.data, errors: [] };
    }
    const errors = result.error.issues.map((i) => {
      const path = i.path.join(".");
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { index, raw, parsed: null, errors };
  });
  return { rows, parseError: null };
}
