/**
 * Rough blended (input+output) USD price per 1M tokens, by model name pattern.
 * Best-effort estimate for surfacing agent cost — not billing-accurate. Update as
 * vendor pricing changes; unknown models fall back to DEFAULT_PER_MILLION.
 */
const PRICE_PER_MILLION: Array<[RegExp, number]> = [
  [/gpt-4o-mini/i, 0.3],
  [/gpt-4o/i, 5],
  [/gpt-4\.1-mini/i, 0.4],
  [/gpt-4\.1/i, 5],
  [/(o1|o3)-mini/i, 1.5],
  [/claude.*haiku/i, 1],
  [/claude.*sonnet/i, 6],
  [/claude.*opus/i, 30],
  [/gemini.*flash/i, 0.3],
  [/gemini.*pro/i, 5],
  [/(llama|mistral)/i, 0.6],
];

const DEFAULT_PER_MILLION = 2;

export function pricePerMillion(model?: string): number {
  if (model) {
    for (const [re, price] of PRICE_PER_MILLION) {
      if (re.test(model)) return price;
    }
  }
  return DEFAULT_PER_MILLION;
}

/** Estimated USD cost for `tokens` tokens on `model` (or the default rate if unknown). */
export function estimateTokenCostUsd(tokens: number, model?: string): number {
  if (!tokens || tokens <= 0) return 0;
  return (tokens / 1_000_000) * pricePerMillion(model);
}
