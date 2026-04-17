// Fixed-interval SRS logic
export const SRS_INTERVALS_DAYS: Record<number, number> = {
  1: 3,
  2: 7,
  3: 14,
  4: 30,
};

export const MASTERED_STAGE = 5;

export type SrsRating = "perfect" | "vague" | "unknown";

export interface SrsUpdate {
  srs_stage: number;
  next_review_at: string | null;
  last_reviewed_at: string;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function applySrsRating(currentStage: number, rating: SrsRating): SrsUpdate {
  const now = new Date().toISOString();

  if (rating === "perfect") {
    const newStage = Math.min(currentStage + 1, MASTERED_STAGE);
    if (newStage === MASTERED_STAGE) {
      return { srs_stage: newStage, next_review_at: null, last_reviewed_at: now };
    }
    return {
      srs_stage: newStage,
      next_review_at: addDays(SRS_INTERVALS_DAYS[newStage]),
      last_reviewed_at: now,
    };
  }

  if (rating === "vague") {
    const stage = Math.max(currentStage, 1);
    return {
      srs_stage: currentStage,
      next_review_at: addDays(SRS_INTERVALS_DAYS[Math.min(stage, 4)]),
      last_reviewed_at: now,
    };
  }

  // unknown -> reset to stage 1
  return {
    srs_stage: 1,
    next_review_at: addDays(SRS_INTERVALS_DAYS[1]),
    last_reviewed_at: now,
  };
}
