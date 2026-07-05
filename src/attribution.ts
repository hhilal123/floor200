import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { NormalizedCommit } from "./git.js";
import type { NormalizedPullRequest } from "./github.js";
import type { NormalizedUsageSession } from "./usage.js";

export type AttributionConfidence = "high" | "medium" | "low" | "unknown";
export type AttributionMethod = "time+pr-commit" | "time-only" | "unattributed";

export interface Attribution {
  sessionId: string;
  source: string;
  model: string;
  commitSha: string | null;
  prNumber: number | null;
  confidence: AttributionConfidence;
  confidenceScore: number;
  method: AttributionMethod;
  explanation: string;
  estimatedCostUsd: number;
  sessionStartedAt: string;
  commitCommittedAt: string | null;
  prMergedAt: string | null;
}

export class AttributionDataError extends Error {
  constructor(readonly fileName: string, options?: ErrorOptions) {
    super(`Required attribution data is missing or malformed: ${fileName}`, options);
    this.name = "AttributionDataError";
  }
}

const HOUR = 3_600_000;
const WINDOW = 24 * HOUR;
const AMBIGUITY = 15 * 60_000;

function unknown(session: NormalizedUsageSession, explanation: string): Attribution {
  return {
    sessionId: session.sourceSessionId, source: session.source, model: session.model,
    commitSha: null, prNumber: null, confidence: "unknown", confidenceScore: 0,
    method: "unattributed", explanation, estimatedCostUsd: session.estimatedCostUsd,
    sessionStartedAt: session.startedAt, commitCommittedAt: null, prMergedAt: null,
  };
}

export function attributeSessions(
  sessions: NormalizedUsageSession[],
  commits: NormalizedCommit[],
  pullRequests: NormalizedPullRequest[],
  repositoryRoot: string,
): Attribution[] {
  const repositoryHash = createHash("sha256").update(repositoryRoot).digest("hex");
  const prByCommit = new Map<string, NormalizedPullRequest>();
  for (const pullRequest of pullRequests) {
    for (const sha of pullRequest.commits) prByCommit.set(sha, pullRequest);
  }

  return sessions.map((session) => {
    if (session.projectPathHash && session.projectPathHash !== repositoryHash) {
      return unknown(session, "No attribution: repository context did not match the collected git repository.");
    }
    const anchorText = session.endedAt || session.startedAt;
    const anchor = Date.parse(anchorText);
    if (!Number.isFinite(anchor)) return unknown(session, "No attribution: session timestamp was invalid.");
    const candidates = commits
      .map((commit) => ({ commit, delta: Date.parse(commit.committedAt) - anchor }))
      .filter(({ delta }) => Number.isFinite(delta) && delta >= 0 && delta <= WINDOW)
      .sort((a, b) => a.delta - b.delta);
    if (candidates.length === 0) {
      return unknown(session, "No attribution: no commit occurred within 24 hours after the session anchor.");
    }
    if (candidates.length > 1 && candidates[1].delta - candidates[0].delta <= AMBIGUITY) {
      return unknown(session, "No attribution: the two nearest eligible commits were within 15 minutes of each other, so choosing one would create false precision.");
    }
    const { commit, delta } = candidates[0];
    const hours = delta / HOUR;
    const score = Math.max(0, 1 - delta / WINDOW);
    const pullRequest = prByCommit.get(commit.sha);
    if (pullRequest && hours > 8) {
      return unknown(session, `No attribution: the nearest PR-backed commit was ${hours.toFixed(2)} hours later and exceeded the 8-hour PR threshold.`);
    }
    const hasRepositoryContext = Boolean(session.projectPathHash);
    const confidence: AttributionConfidence = pullRequest
      ? hours <= 2 && hasRepositoryContext ? "high" : "medium"
      : "low";
    const context = hasRepositoryContext
      ? "repository context matched"
      : "repository context was unavailable, so confidence was capped";
    return {
      sessionId: session.sourceSessionId, source: session.source, model: session.model,
      commitSha: commit.sha, prNumber: pullRequest?.number ?? null, confidence,
      confidenceScore: score, method: pullRequest ? "time+pr-commit" : "time-only",
      explanation: pullRequest
        ? `Nearest commit occurred ${hours.toFixed(2)} hours after the session, appears in merged PR #${pullRequest.number}, and ${context}.`
        : `Nearest commit occurred ${hours.toFixed(2)} hours after the session, but no merged PR contains that commit; this is commit-only evidence.`,
      estimatedCostUsd: session.estimatedCostUsd, sessionStartedAt: session.startedAt,
      commitCommittedAt: commit.committedAt, prMergedAt: pullRequest?.mergedAt ?? null,
    };
  });
}

async function readJson(path: string, fileName: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new AttributionDataError(fileName, { cause: error });
  }
}

export async function runAttribution(
  options: { baseDirectory?: string } = {},
): Promise<{
  outputPath: string;
  counts: Record<AttributionConfidence, number>;
  roiEligibleCount: number;
}> {
  const dataDirectory = join(options.baseDirectory ?? process.cwd(), ".floor200", "data");
  const usage = await readJson(join(dataDirectory, "usage.json"), "usage.json");
  if (!Array.isArray(usage)) throw new AttributionDataError("usage.json");
  const commitData = await readJson(join(dataDirectory, "commits.json"), "commits.json");
  if (
    typeof commitData !== "object" || commitData === null ||
    typeof (commitData as { repository?: { root?: unknown } }).repository?.root !== "string" ||
    !Array.isArray((commitData as { commits?: unknown }).commits)
  ) throw new AttributionDataError("commits.json");
  const pullRequests = await readJson(join(dataDirectory, "prs.json"), "prs.json");
  if (!Array.isArray(pullRequests)) throw new AttributionDataError("prs.json");
  const typedCommits = commitData as { repository: { root: string }; commits: NormalizedCommit[] };
  const attributions = attributeSessions(
    usage as NormalizedUsageSession[], typedCommits.commits,
    pullRequests as NormalizedPullRequest[], typedCommits.repository.root,
  );
  const counts = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const attribution of attributions) counts[attribution.confidence] += 1;
  const roiEligibleCount = attributions.filter((attribution) =>
    (attribution.confidence === "high" || attribution.confidence === "medium") &&
    attribution.method === "time+pr-commit"
  ).length;
  const outputPath = join(dataDirectory, "attributions.json");
  await writeFile(outputPath, `${JSON.stringify(attributions, null, 2)}\n`, "utf8");
  return { outputPath, counts, roiEligibleCount };
}
