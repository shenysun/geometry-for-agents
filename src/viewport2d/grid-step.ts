const TARGET_GRID_PX = 48;

/** World-unit spacing so grid lines stay near 48px apart as scale changes. */
export function readableGridStep(scale: number): number {
  const raw = TARGET_GRID_PX / scale;
  const exponent = Math.floor(Math.log10(raw));
  const magnitude = 10 ** exponent;
  const residual = raw / magnitude;
  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
}
