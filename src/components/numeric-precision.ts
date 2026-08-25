/**
 * 数字精度处理：所有数字字段统一支持小数点后 2 位精度。
 * 输入任何浮点数，截断到两位小数后再验证。
 * voxel 坐标在截断后转整数。
 */

/**
 * 截断数字到小数点后 2 位。
 * 例：3.756 → 3.75，3.7 → 3.7，3 → 3
 */
export function truncateToPrecision(value: number, decimalPlaces: number = 2): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.trunc(value * factor) / factor;
}

/**
 * 截断后转整数（用于 voxel x/y/z）。
 * 例：3.75 → 3，-2.99 → -2
 */
export function truncateToInteger(value: number): number {
  return Math.trunc(truncateToPrecision(value));
}

/**
 * 验证截断后的数值是否满足约束。
 * 返回 { valid, truncated } — valid 表示是否通过约束，truncated 是截断后的值。
 */
export function validateNumericField(
  value: number,
  constraints: {
    positive?: boolean;
    integer?: boolean;
    min?: number;
  },
): { valid: boolean; truncated: number } {
  // 非有限数值直接拒绝
  if (!Number.isFinite(value)) {
    return { valid: false, truncated: NaN };
  }

  // 整数约束：先截断再检查
  const truncated = constraints.integer
    ? truncateToInteger(value)
    : truncateToPrecision(value);

  // 正数约束
  if (constraints.positive && truncated <= 0) {
    return { valid: false, truncated };
  }

  // 下界约束
  if (constraints.min !== undefined && truncated < constraints.min) {
    return { valid: false, truncated };
  }

  return { valid: true, truncated };
}
