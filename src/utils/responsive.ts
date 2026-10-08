import { layout } from '@/theme/tokens';
export function isCompactLayout(width: number, fontScale: number): boolean {
  return width < layout.compactWidth || fontScale >= layout.largeTextScale;
}
