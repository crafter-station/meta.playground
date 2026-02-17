export type ModelConfig = {
  id: string;
  name: string;
  provider: "OpenAI" | "Anthropic" | "Google";
  inputCostPer1MTokens: number;
  outputCostPer1MTokens: number;
};

export const MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    inputCostPer1MTokens: 2.5,
    outputCostPer1MTokens: 10.0,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    inputCostPer1MTokens: 0.15,
    outputCostPer1MTokens: 0.6,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "OpenAI",
    inputCostPer1MTokens: 0.3,
    outputCostPer1MTokens: 1.2,
  },
  {
    id: "anthropic/claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    inputCostPer1MTokens: 3.0,
    outputCostPer1MTokens: 15.0,
  },
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    inputCostPer1MTokens: 0.1,
    outputCostPer1MTokens: 0.4,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    inputCostPer1MTokens: 1.25,
    outputCostPer1MTokens: 5.0,
  },
];

export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d97757",
  Google: "#4285f4",
};

export function calculateCost(
  model: ModelConfig,
  promptTokens: number,
  completionTokens: number
): number {
  return (
    (promptTokens / 1_000_000) * model.inputCostPer1MTokens +
    (completionTokens / 1_000_000) * model.outputCostPer1MTokens
  );
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
