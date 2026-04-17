import { z } from "zod";
import { CATEGORIES } from "@/constants/categories";

const CATEGORY_SET = new Set<string>(CATEGORIES as readonly string[]);

export const EXPLANATION_DEPTHS = ["short", "deep"] as const;
export type ExplanationDepth = (typeof EXPLANATION_DEPTHS)[number];

export type QuestionFormValues = {
  category: string;
  subcategory: string | null;
  tags: string[];
  question_type: "multiple_choice" | "fill_blank";
  question_text: string;
  options: [string, string, string, string];
  answer_index: number;
  difficulty: 1 | 2 | 3;
  explanation: string;
  explanation_depth: ExplanationDepth;
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
    question_type: z.enum(["multiple_choice", "fill_blank"]),
    question_text: z.string().trim().min(1, "問題文は必須です").max(2000),
    options: z
      .array(z.string().trim().min(1, "選択肢は空にできません"))
      .length(4, "選択肢は4つ必要です"),
    answer_index: z
      .number()
      .int()
      .min(0, "正解を選択してください")
      .max(3, "正解インデックスが範囲外です"),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    explanation: z.string().trim().min(1, "解説は必須です").max(4000),
    explanation_depth: z.enum(EXPLANATION_DEPTHS),
  })
  .superRefine((val, ctx) => {
    if (val.question_type === "fill_blank") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_type"],
        message: "穴埋め問題は現在サポートされていません",
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
