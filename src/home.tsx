import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RepoBrain } from "./brain";
import { AskCard, CiCard, InboxCard, ReviewCard, SearchCard, TriageCard } from "./specimens";

function wantsIntro() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (sessionStorage.getItem("bg-intro-2")) return false;
  return true;
}

export function Home({ onHub }: { onHub: () => void }) {
  const story = useRef<HTMLElement>(null);
  const [play] = useState(wantsIntro);
  const [intro, setIntro] = useState(play);

  useEffect(() => {
    document.documentElement.classList.add("motion");
    const nodes = document.querySelectorAll(".chapter");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      nodes.forEach((node) => node.classList.add("in"));
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("in");
        }
      },
      { threshold: 0.2 },
    );
    nodes.forEach((node) => seen.observe(node));
    return () => seen.disconnect();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("opening", intro);
    document.documentElement.classList.toggle("opened", !intro);
    if (!intro) {
      document.documentElement.classList.remove("intro-lock");
      return;
    }
    document.documentElement.classList.add("intro-lock");
    const done = () => {
      sessionStorage.setItem("bg-intro-2", "1");
      setIntro(false);
    };
    const timer = window.setTimeout(done, 3000);
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Escape") done();
    };
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", skip);
    };
  }, [intro]);

  return (
    <div>
      <button
        className="wordmark"
        type="button"
        onClick={() => {
          sessionStorage.setItem("bg-intro-2", "1");
          setIntro(false);
        }}
        aria-label="Skip the opening"
      >
        <strong>Skip</strong>
      </button>
      <section className="story" ref={story} aria-label="A project is written, flows up into the brain, then a push and a pull. Drag sideways to turn it.">
        <div className="story-pin field">
          <RepoBrain className="field-brain" assembled={!play} hint soften />
          <div className="veil" />
          <div className="field-fade">
            <div className="wrap field-copy">
              <div className="copy-plate">
                <p className="kicker">Your repository. With a brain.</p>
                <h1>
                  The line, <em>accounted for.</em>
                </h1>
                <p className="lede">
                  Pull requests, issues and checks, read where the change is. Required comments are
                  marked. The merge stays yours.
                </p>
                <div className="row">
                  <button className="solid" type="button" onClick={onHub}>
                    Open BrainHub
                  </button>
                  <a className="ghost" href="#review">
                    Read a pull request
                  </a>
                </div>
                <p className="hint">
                  <span className="chev" aria-hidden="true">
                    ←
                  </span>
                  Drag sideways to turn the repo
                  <span className="chev" aria-hidden="true">
                    →
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="wrap">
        <section className="section chapter">
          <p className="kicker">What the brain reads</p>
          <h2>One repo. Every question.</h2>
          <p className="lede">The sample is one sign-in change. Every tool below is reading it.</p>
          <div className="split">
            <div className="repo-well" aria-hidden="true">
              <RepoBrain count={1100} assembled />
            </div>
            <ReviewCard />
          </div>
        </section>
        <section className="section pair chapter">
          <AskCard />
          <SearchCard />
        </section>
        <section className="section notes chapter">
          <TriageCard />
          <InboxCard />
          <CiCard />
        </section>
        <section className="section close chapter">
          <p className="kicker">The merge is still yours</p>
          <h2>Read the next change with a brain beside it.</h2>
          <button className="solid" type="button" onClick={onHub}>
            Open BrainHub
          </button>
        </section>
      </main>
      <footer className="wrap foot">
        <span>BrainGit</span>
        <span>The repository, with a brain.</span>
      </footer>
    </div>
  );
}
