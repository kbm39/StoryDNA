/**
 * Application-authoritative length cut arithmetic (not model-derived).
 */

export interface LengthCutCalculation {
  current: number;
  cutPercentage: number;
  cutAmount: number;
  resulting: number;
}

export function calculateLengthCut(
  currentWordCount: number,
  cutPercentage: number,
): LengthCutCalculation {
  const cutAmount = Math.round(currentWordCount * (cutPercentage / 100));
  const resulting = currentWordCount - cutAmount;
  return {
    current: currentWordCount,
    cutPercentage,
    cutAmount,
    resulting,
  };
}

/** Format a cut recommendation block for prompts and repair instructions. */
export function formatLengthCutBlock(
  currentWordCount: number,
  cutPercentage: number,
): string {
  const calc = calculateLengthCut(currentWordCount, cutPercentage);
  return [
    `Current: ${calc.current.toLocaleString()}`,
    `Cut (${cutPercentage}%): ${calc.cutAmount.toLocaleString()}`,
    `Result: ${calc.resulting.toLocaleString()}`,
  ].join("\n");
}
