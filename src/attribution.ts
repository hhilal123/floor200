import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readAttributionTuning } from "./config.js";
import type { NormalizedCommit } from "./git.js";
import type { NormalizedPullRequest } from "./github.js";
import type { NormalizedUsageSession } from "./usage.js";

export type AttributionConfidence = "high" | "medium" | "low" | "unknown";
export type AttributionMethod = "time+pr-commit" | "time-only" | "unattributed" | "pending-data";

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
  /** False only when the session's project context definitively did not match this repository. */
  inScope: boolean;
}

export class AttributionDataError extends Error {
  constructor(readonly fileName: string, options?: ErrorOptions) {
    super(`Required attribution data is missing or malformed: ${fileName}`, options);
    this.name = "AttributionDataError";
  }
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

export interface AttributionTuning {
  lookbackHours: number;
  windowHours: number;
  ambiguityMinutes: number;
}

export const DEFAULT_ATTRIBUTION_TUNING: AttributionTuning = {
  lookbackHours: 2,
  windowHours: 24,
  ambiguityMinutes: 15,
};

function unknown(
  session: NormalizedUsageSession,
  explanation: string,
  inScope = true,
  method: AttributionMethod = "unattributed",
): Attribution {
  return {
    sessionId: session.sourceSessionId, source: session.source, model: session.model,
    commitSha: null, prNumber: null, confidence: "unknown", confidenceScore: 0,
    method, explanation, estimatedCostUsd: session.estimatedCostUsd,
    sessionStartedAt: session.startedAt, commitCommittedAt: null, prMergedAt: null, inScope,
  };
}

function encodeProjectPath(root: string): string {
  return root.replace(/\//g, "-");
}

export function attributeSessions(
  sessions: NormalizedUsageSession[],
  commits: NormalizedCommit[],
  pullRequests: NormalizedPullRequest[],
  repositoryRoot: string,
  tuning: AttributionTuning = DEFAULT_ATTRIBUTION_TUNING,
  collectedAt: string | null = null,
): Attribution[] {
  const lookback = tuning.lookbackHours * HOUR;
  const window = tuning.windowHours * HOUR;
  const ambiguity = tuning.ambiguityMinutes * MINUTE;
  const repositoryHash = createHash("sha256").update(encodeProjectPath(repositoryRoot)).digest("hex");
  const prByCommit = new Map<string, NormalizedPullRequest>();
  for (const pullRequest of pullRequests) {
    for (const sha of pullRequest.commits) prByCommit.set(sha, pullRequest);
    if (pullRequest.mergeCommitSha) prByCommit.set(pullRequest.mergeCommitSha, pullRequest);
  }

  return sessions.map((session) => {
    if (session.projectPathHash && session.projectPathHash !== repositoryHash) {
      return unknown(session, "No attribution: repository context did not match the collected git repository.", false);
    }
    const anchorText = session.endedAt || session.startedAt;
    const anchor = Date.parse(anchorText);
    if (!Number.isFinite(anchor)) return unknown(session, "No attribution: session timestamp was invalid.");
    const eligible = commits
      .map((commit) => ({ commit, delta: Date.parse(commit.committedAt) - anchor }))
      .filter(({ delta }) => Number.isFinite(delta) && delta >= -lookback && delta <= window);
    if (eligible.length === 0) {
      const collectedAtMs = collectedAt === null ? NaN : Date.parse(collectedAt);
      if (Number.isFinite(collectedAtMs) && anchor > collectedAtMs - window) {
        return unknown(
          session,
          "No attribution yet: the session is recent enough that its commits may not have existed or been collected when data was gathered; re-run the pipeline later to resolve it.",
          true,
          "pending-data",
        );
      }
      return unknown(session, `No attribution: no commit occurred within the matching window (${tuning.lookbackHours} hours before to ${tuning.windowHours} hours after the session anchor).`);
    }
    // Commits belonging to the same PR (branch commits + merge commit) are one unit of
    // work: two of them landing close together is corroboration, not ambiguity.
    const units = new Map<string, { commit: NormalizedCommit; delta: number }>();
    for (const candidate of eligible) {
      const pullRequest = prByCommit.get(candidate.commit.sha);
      const key = pullRequest ? `pr:${pullRequest.number}` : `commit:${candidate.commit.sha}`;
      const nearest = units.get(key);
      if (!nearest || Math.abs(candidate.delta) < Math.abs(nearest.delta)) units.set(key, candidate);
    }
    const candidates = [...units.values()].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    if (candidates.length > 1 && Math.abs(candidates[1].delta) - Math.abs(candidates[0].delta) <= ambiguity) {
      return unknown(session, `No attribution: the two nearest eligible commits were within ${tuning.ambiguityMinutes} minutes of each other, so choosing one would create false precision.`);
    }
    const { commit, delta } = candidates[0];
    const hours = Math.abs(delta) / HOUR;
    const direction = delta < 0 ? "before the session anchor" : "after the session";
    const decay = Math.max(0, 1 - Math.abs(delta) / window);
    const pullRequest = prByCommit.get(commit.sha);
    // Score bands keep the numeric score consistent with the label: commit-only
    // evidence can never outscore PR-backed evidence, however close the timing.
    const score = pullRequest ? 0.4 + 0.6 * decay : 0.4 * decay;
    if (pullRequest && hours > 8) {
      return unknown(session, `No attribution: the nearest PR-backed commit was ${hours.toFixed(2)} hours away and exceeded the 8-hour PR threshold.`);
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
        ? `Nearest commit occurred ${hours.toFixed(2)} hours ${direction}, appears in merged PR #${pullRequest.number}, and ${context}.`
        : `Nearest commit occurred ${hours.toFixed(2)} hours ${direction}, but no merged PR contains that commit; this is commit-only evidence.`,
      estimatedCostUsd: session.estimatedCostUsd, sessionStartedAt: session.startedAt,
      commitCommittedAt: commit.committedAt, prMergedAt: pullRequest?.mergedAt ?? null, inScope: true,
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
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const tuning = await readAttributionTuning(baseDirectory);
  const dataDirectory = join(baseDirectory, ".floor200", "data");
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
  const typedCommits = commitData as {
    repository: { root: string };
    collectedAt?: unknown;
    commits: NormalizedCommit[];
  };
  const collectedAt = typeof typedCommits.collectedAt === "string" ? typedCommits.collectedAt : null;
  const attributions = attributeSessions(
    usage as NormalizedUsageSession[], typedCommits.commits,
    pullRequests as NormalizedPullRequest[], typedCommits.repository.root, tuning, collectedAt,
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
