/**
 * 文字列を Unicode code point 順で比較する。PostgreSQL の `COLLATE "C"` は
 * UTF-8 byte 順であり、それは code point 順と一致する。JS の `<` や
 * `localeCompare` は UTF-16 code unit 順/locale 依存で、補助面文字
 * (U+10000 以降)や locale 差で発散するため、in-memory 実装と PostgreSQL
 * 実装の ordering parity は code point 順で揃える。
 */
export function compareTextByCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  const leftPoints = Array.from(left, (char) => char.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (char) => char.codePointAt(0) ?? 0);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = (leftPoints[index] ?? 0) - (rightPoints[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}
