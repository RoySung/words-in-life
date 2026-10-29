export const WORD_CATEGORIES = ['全部', '食物', '生活用品', '植物', '其他'] as const;
export function wordCategory(word: string) {
  if (/\b(coffee|tea|bread|apple|banana|orange|rice|egg|milk|juice|water|salad|sandwich|cake|food|fruit|tomato|carrot)\b/i.test(word)) return '食物';
  if (/\b(plant|flower|tree|leaf|grass|cactus)\b/i.test(word)) return '植物';
  if (/\b(cup|mug|table|chair|book|laptop|phone|window|lamp|pen|pencil|notebook|bag|bottle|plate|fork|spoon|clock|desk|shelf|sofa|bed|keyboard|monitor)\b/i.test(word)) return '生活用品';
  return '其他';
}
