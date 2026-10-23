import { useState } from "react";
import { askRepo, features, type Hit } from "./content";

export function ReviewCard() {
  const feature = features[0]!;
  return (
    <article className="specimen" id="review">
      <div className="spec-bar">
        <span>Pull request · #86</span>
        <span className="need">Needs a check</span>
      </div>
      <h3>Reject a stale session before the redirect</h3>
      <p>{feature.body}</p>
      <p className="summary">
        The change stops a sign-in loop by refusing a session that has already expired. One comment
        blocks the merge. One does not.
      </p>
      <div className="diff" aria-label="Diff of src/auth/session.ts">
        <div className="diff-file">src/auth/session.ts</div>
        <div className="diff-line add">
          <span>42</span>
          <code>if (!session.fresh) return deny("stale")</code>
        </div>
      </div>
      <ul className="comments">
        <li>
          <strong>Required</strong>
          <span>
            <code>fresh</code> is not a field on Session. The merge reads a value that was never
            declared. Compare <code>expiresAt</code> to now.
          </span>
        </li>
        <li>
          <strong>Optional</strong>
          <span>Name the denial. A bare return is harder to find in the log.</span>
        </li>
      </ul>
    </article>
  );
}

export function AskCard({ initial = "" }: { initial?: string }) {
  const feature = features[1]!;
  const [q, setQ] = useState(initial);
  const [hit, setHit] = useState<Hit | null>(initial ? askRepo(initial) : null);
  return (
    <article className="specimen" id="assistant">
      <div className="spec-bar">
        <span>Repo assistant</span>
        <span>brainhub</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.body}</p>
      <form
        className="ask"
        onSubmit={(event) => {
          event.preventDefault();
          setHit(askRepo(q));
        }}
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Ask this repository…"
          aria-label="Ask this repository"
        />
        <button className="solid" type="submit">
          Ask
        </button>
      </form>
      {hit ? (
        <div className="hit">
          <p className="file">{hit.file}</p>
          <h4>{hit.title}</h4>
          <p>{hit.detail}</p>
        </div>
      ) : (
        <p className="fine">Try “what blocks the merge” or “safari sign-in loop”.</p>
      )}
    </article>
  );
}

export function SearchCard() {
  const feature = features[2]!;
  return (
    <article className="specimen" id="search">
      <div className="spec-bar">
        <span>Smart search</span>
        <span>stale login</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.body}</p>
      <ul className="hits">
        <li>
          <span className="file">src/auth/session.ts</span>
          <span>The check that refuses an expired session.</span>
        </li>
        <li>
          <span className="file">pull/86</span>
          <span>Required comment on line 42. This blocks the merge.</span>
        </li>
        <li>
          <span className="file">issues/448</span>
          <span>Sign-in loop on Safari. Likely duplicate of #441.</span>
        </li>
      </ul>
    </article>
  );
}

export function TriageCard() {
  const feature = features[3]!;
  return (
    <article className="specimen" id="triage">
      <div className="spec-bar">
        <span>Issue #448</span>
        <span>Just landed</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.body}</p>
      <h4 className="issue">Sign-in loop on Safari</h4>
      <dl className="meta">
        <div>
          <dt>Labels</dt>
          <dd>bug · auth</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>High</dd>
        </div>
        <div>
          <dt>Duplicate</dt>
          <dd>#441</dd>
        </div>
      </dl>
      <p className="summary">Suggested fix: clear the stale session cookie before the redirect.</p>
    </article>
  );
}

export function InboxCard() {
  const feature = features[4]!;
  return (
    <article className="specimen" id="inbox">
      <div className="spec-bar">
        <span>Priority inbox</span>
        <span>Brain digest</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.body}</p>
      <ul className="hits">
        <li>
          <span className="need">Needs you</span>
          <span>Required comment on session.ts. It blocks the merge.</span>
        </li>
        <li>
          <span className="need">Needs you</span>
          <span>Brain CI failed on the same line.</span>
        </li>
        <li>
          <span className="wait">Can wait</span>
          <span>#448 may duplicate #441.</span>
        </li>
      </ul>
      <p className="summary">Digest: two things need you. Both are the stale session. One issue can wait.</p>
    </article>
  );
}

export function CiCard() {
  const feature = features[5]!;
  return (
    <article className="specimen" id="ci">
      <div className="spec-bar">
        <span>Brain CI</span>
        <span className="need">Failed</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.body}</p>
      <p className="file">typecheck · src/auth/session.ts:42</p>
      <p className="summary">
        The check reads <code>session.fresh</code>. Session has no such field, so the build stops
        before the redirect can ship.
      </p>
      <p className="summary">How to fix: compare <code>expiresAt</code> to now, and delete the fresh check.</p>
    </article>
  );
}
