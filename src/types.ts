export type Confidence = "high" | "medium" | "low";

export interface SpendBreakdown {
  name: string;
  spend: number;
  mergedPullRequests: number;
  confidence: Confidence;
}

export interface DemoData {
  totalSpend: number;
  abandonedSpend: number;
  mergedPullRequests: number;
  ciRuns: { passed: number; total: number };
  revertCount: number;
  models: SpendBreakdown[];
  developers: SpendBreakdown[];
  repos: SpendBreakdown[];
  recommendations: string[];
}

export interface DerivedMetrics {
  costPerMergedPullRequest: number;
  wasteRate: number;
  ciPassRate: number;
}
