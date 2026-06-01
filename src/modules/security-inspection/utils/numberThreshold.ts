import type { ChecklistItemDef } from '../types';

export function isNumberItem(item: ChecklistItemDef): boolean {
  return item.inputType === 'number';
}

/** null min/max = không giới hạn phía đó */
export function isWithinThreshold(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined
): boolean {
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function evaluateNumericStatus(
  value: number | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): 'unset' | 'pass' | 'fail' {
  if (value === undefined || Number.isNaN(value)) return 'unset';
  return isWithinThreshold(value, min, max) ? 'pass' : 'fail';
}

export function formatThresholdHint(item: ChecklistItemDef): string {
  const parts: string[] = [];
  if (item.minValue != null) parts.push(`≥ ${item.minValue}`);
  if (item.maxValue != null) parts.push(`≤ ${item.maxValue}`);
  const range = parts.join(' · ');
  return item.unit ? `${range} ${item.unit}`.trim() : range;
}
