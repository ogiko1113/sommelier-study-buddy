export const TAGS = [
  "格付け",
  "品種",
  "法律・AOC",
  "土壌・気候",
  "醸造法",
  "歴史・人物",
  "数字・年号",
  "瓶形・ラベル",
] as const;

export type Tag = (typeof TAGS)[number];
