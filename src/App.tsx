import { useState, type FormEvent } from "react";
import { Auth } from "./auth";
import { Mark } from "./brain";
import { askRepo, type Hit } from "./content";
import { Home } from "./home";
import { Hub } from "./hub";
import { readSession, writeSession, type Session } from "./session";

type View = "home" | "signin" | "create" | "hub";

export function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState<Hit | null>(null);

  function save(next: Session | null) {
    writeSession(next);
    setSession(next);
  }

  function openHub() {
    if (session) setView("hub");
    else setView("signin");
  }

  function ask(event: FormEvent) {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      setHit(null);
      return;
    }
    setHit(askRepo(next));
    if (view === "signin" || view === "create") setView(session ? "hub" : "home");
  }

  return (
    <>
      <p className="top-line">Powered by Brain API</p>
      <header className="wrap nav">
        <button
          className="brand"
          type="button"
          onClick={() => {
            setView("home");
            setHit(null);
          }}
        >
          <Mark />
          <span>BrainGit</span>
        </button>
        <form className="search" onSubmit={ask}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search or ask Brain..."
            aria-label="Search or ask Brain"
          />
        </form>
        <button className="solid" type="button" onClick={openHub}>
          {session ? session.name : "Sign in"}
        </button>
      </header>
      {hit && view === "home" ? (
        <div className="wrap ask-banner">
          <p className="file">{hit.file}</p>
          <h2>{hit.title}</h2>
          <p>{hit.detail}</p>
          <a href={`#${hit.feature}`}>Open that tool</a>
        </div>
      ) : null}
      {view === "home" ? <Home onHub={openHub} /> : null}
      {view === "signin" || view === "create" ? (
        <Auth
          mode={view}
          onMode={setView}
          onCancel={() => setView("home")}
          onDone={(next) => {
            save(next);
            setView("hub");
          }}
        />
      ) : null}
      {view === "hub" && session ? (
        <Hub
          session={session}
          onSignOut={() => {
            save(null);
            setView("home");
          }}
        />
      ) : null}
    </>
  );
}
