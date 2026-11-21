import type { PlanMeasurement } from './roof-plan-geometry.ts';
/** Numeric-only boundary schedule; deliberately excludes approved quantities. */
export function roofBoundaryCsv(result: PlanMeasurement): string {
  if (result.status !== 'preliminary-unverified' || !result.edgeLengthsM.length ||
      result.edgeLengthsM.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('A valid preliminary measurement is required.');
  }
  return ['Status,Edge,Plan length (m)', ...result.edgeLengthsM.map((value, i) =>
    `Preliminary - independently verify,${i + 1},${value}`)].join('\r\n') + '\r\n';
}
