export type Feature = {
  id: string;
  title: string;
  body: string;
};

export const features: Feature[] = [
  {
    id: "review",
    title: "Brain code review",
    body: "Every pull request gets a summary and line comments marked required or optional — no more guessing what blocks a merge.",
  },
  {
    id: "assistant",
    title: "Repo assistant",
    body: "Ask any repository how it works. Answers point to the exact files.",
  },
  {
    id: "search",
    title: "Smart search",
    body: "Search by meaning across repos, issues and pull requests, not just exact words.",
  },
  {
    id: "triage",
    title: "Auto triage",
    body: "Labels, priority, likely duplicates and a suggested fix the moment an issue lands.",
  },
  {
    id: "inbox",
    title: "Priority inbox",
    body: "Notifications ranked by what actually needs you, with a Brain digest.",
  },
  {
    id: "ci",
    title: "Brain CI",
    body: "One-click checks that explain failures in plain words and how to fix them.",
  },
];

export type Hit = {
  title: string;
  detail: string;
  file: string;
  feature: string;
};

const knowledge: { keys: string[]; hit: Hit }[] = [
  {
    keys: ["session", "sign", "auth", "login", "safari", "loop", "stale", "cookie", "redirect"],
    hit: {
      title: "Sign-in reads the session before the redirect",
      detail:
        "A stale session is refused in session.ts. The Safari loop is issue #448, likely the same failure as #441.",
      file: "src/auth/session.ts",
      feature: "assistant",
    },
  },
  {
    keys: ["review", "merge", "comment", "required", "optional", "pull", "pr"],
    hit: {
      title: "One comment blocks this merge",
      detail:
        "The required note is on line 42. fresh is not a field on Session. The optional note only asks for a clearer denial.",
      file: "src/auth/session.ts",
      feature: "review",
    },
  },
  {
    keys: ["ci", "check", "fail", "type", "typecheck", "build"],
    hit: {
      title: "Typecheck failed on the fresh field",
      detail:
        "session.ts:42 reads session.fresh, and Session never declares it. Compare expiresAt to now instead.",
      file: "src/auth/session.ts",
      feature: "ci",
    },
  },
  {
    keys: ["triage", "issue", "duplicate", "label", "priority", "448", "441"],
    hit: {
      title: "Issue #448 is already labeled",
      detail:
        "bug · auth · high. Likely duplicate of #441. Suggested fix: clear the stale cookie before the redirect.",
      file: "issues/448",
      feature: "triage",
    },
  },
  {
    keys: ["inbox", "notification", "digest", "need"],
    hit: {
      title: "Two things need you",
      detail: "The required review and the failed check are the same line. Issue #448 can wait.",
      file: "inbox",
      feature: "inbox",
    },
  },
  {
    keys: ["search", "meaning", "find", "where"],
    hit: {
      title: "Search matches the idea, not the word",
      detail: "“stale login” finds the session check, the failed typecheck and issue #448 together.",
      file: "src/auth/session.ts",
      feature: "search",
    },
  },
];

export function askRepo(query: string): Hit {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);
  let best = knowledge[0]!.hit;
  let score = 0;
  for (const row of knowledge) {
    const next = words.reduce(
      (n, word) => n + (row.keys.some((key) => key.includes(word) || word.includes(key)) ? 1 : 0),
      0,
    );
    if (next > score) {
      score = next;
      best = row.hit;
    }
  }
  if (score > 0) return best;
  return {
    title: "Nothing in this sample repository matches that",
    detail: "Try the session check, the review, or issue #448. This preview only reads the sample repo.",
    file: "brainhub",
    feature: "assistant",
  };
}
