import type { DemoData } from "./types.js";

export const demoData: DemoData = {
  totalSpend: 428.72,
  abandonedSpend: 91.2,
  mergedPullRequests: 26,
  ciRuns: { passed: 42, total: 48 },
  revertCount: 2,
  models: [
    { name: "Claude", spend: 182.4, mergedPullRequests: 14, confidence: "high" },
    { name: "Codex", spend: 96.1, mergedPullRequests: 9, confidence: "high" },
    { name: "Gemini", spend: 12.02, mergedPullRequests: 1, confidence: "medium" },
    { name: "OpenCode", spend: 44.2, mergedPullRequests: 2, confidence: "medium" },
    { name: "Unattributed", spend: 94, mergedPullRequests: 0, confidence: "low" },
  ],
  developers: [
    { name: "Avery", spend: 168.12, mergedPullRequests: 11, confidence: "high" },
    { name: "Sam", spend: 132.4, mergedPullRequests: 9, confidence: "high" },
    { name: "Jordan", spend: 128.2, mergedPullRequests: 6, confidence: "medium" },
  ],
  repos: [
    { name: "api", spend: 211.32, mergedPullRequests: 12, confidence: "high" },
    { name: "web", spend: 146.8, mergedPullRequests: 10, confidence: "high" },
    { name: "infra", spend: 70.6, mergedPullRequests: 4, confidence: "medium" },
  ],
  recommendations: [
    "Investigate abandoned sessions over $10.",
    "Use Claude for larger backend changes.",
    "Use Codex for smaller scoped fixes.",
    "Avoid agent-led migrations until CI is more reliable.",
  ],
};
