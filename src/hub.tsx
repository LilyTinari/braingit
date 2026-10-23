import { useState } from "react";
import { features } from "./content";
import type { Session } from "./session";
import { AskCard, CiCard, InboxCard, ReviewCard, SearchCard, TriageCard } from "./specimens";

const panes = [ReviewCard, AskCard, SearchCard, TriageCard, InboxCard, CiCard];

export function Hub({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [tool, setTool] = useState(0);
  const Pane = panes[tool] ?? ReviewCard;
  return (
    <main className="wrap hub">
      <aside>
        <p className="kicker">BrainHub</p>
        <h1 className="hub-title">Two things need you, {session.name}.</h1>
        <p className="lede tight">
          The digest is the stale session: a required comment, and the check that failed on the same
          line.
        </p>
        <div className="tools" role="tablist" aria-label="Brain tools">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              role="tab"
              aria-selected={tool === index}
              data-on={tool === index}
              onClick={() => setTool(index)}
            >
              <strong>{feature.title}</strong>
              <span>{feature.body}</span>
            </button>
          ))}
        </div>
        <button className="quiet out" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </aside>
      <div role="tabpanel">
        <Pane />
      </div>
    </main>
  );
}
