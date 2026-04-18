// Fill-in-the-blank normalization and scoring helpers.

export function normalizeForComparison(s: string): string {
  return s
    .replace(/[・·\s\-=ー−‐]/g, "") // middle dot, spaces, hyphens, dashes
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

export type Blank = {
  index: number;
  answer: string;
  accept?: string[];
  options?: string[];
};

export function isBlankCorrect(input: string, blank: Blank): boolean {
  const n = normalizeForComparison(input);
  if (n.length === 0) return false;
  if (normalizeForComparison(blank.answer) === n) return true;
  return (blank.accept ?? []).some((a) => normalizeForComparison(a) === n);
}

export interface FillBlankScore {
  correctCount: number;
  total: number;
  ratio: number;
  perBlank: Record<number, boolean>;
}

export function scoreFillBlank(
  inputs: Record<number, string>,
  blanks: Blank[],
): FillBlankScore {
  const perBlank: Record<number, boolean> = {};
  let correctCount = 0;
  for (const b of blanks) {
    const ok = isBlankCorrect(inputs[b.index] ?? "", b);
    perBlank[b.index] = ok;
    if (ok) correctCount++;
  }
  const total = blanks.length;
  const ratio = total === 0 ? 0 : correctCount / total;
  return { correctCount, total, ratio, perBlank };
}

export const PARTIAL_CREDIT_THRESHOLD = 0.8;

/** Extract unique {{N}} placeholders in order of first appearance. */
export function extractPlaceholderIndices(text: string): number[] {
  const re = /\{\{(\d+)\}\}/g;
  const seen = new Set<number>();
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n)) continue;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Split question_text into segments of literal text and placeholder refs,
 * for inline rendering with input fields.
 */
export type RenderSegment =
  | { kind: "text"; value: string }
  | { kind: "blank"; index: number };

export function renderSegments(text: string): RenderSegment[] {
  const re = /\{\{(\d+)\}\}/g;
  const out: RenderSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", value: text.slice(last, m.index) });
    }
    out.push({ kind: "blank", index: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "text", value: text.slice(last) });
  }
  return out;
}
