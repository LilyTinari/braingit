import { useState, type FormEvent } from "react";
import type { Session } from "./session";

export function Auth({
  mode,
  onMode,
  onDone,
  onCancel,
}: {
  mode: "signin" | "create";
  onMode: (mode: "signin" | "create") => void;
  onDone: (session: Session) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const creating = mode === "create";

  function enter(next: Session) {
    setError("");
    onDone(next);
  }

  function preview(label: string) {
    enter({ name: label, email: "preview@braingit.ai" });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter an email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (creating && name.trim().length < 2) {
      setError("Choose a username.");
      return;
    }
    const handle = creating ? name.trim() : email.split("@")[0] || "You";
    enter({ name: handle, email: email.trim() });
  }

  return (
    <section className="auth">
      <button className="mark-btn" type="button" onClick={onCancel} aria-label="Back to BrainGit">
        <span className="mark-orb" aria-hidden="true" />
      </button>
      <h1>{creating ? "Create your account" : "Sign in to BrainHub"}</h1>
      <form className="auth-card" onSubmit={submit}>
        <button className="oauth" type="button" onClick={() => preview("Google")}>
          Continue with Google
        </button>
        <button className="oauth light" type="button" onClick={() => preview("Lovable")}>
          Continue with Lovable
        </button>
        <p className="or">or</p>
        {creating ? (
          <label>
            Username
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" />
          </label>
        ) : null}
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={creating ? "new-password" : "current-password"}
          />
        </label>
        {creating ? <p className="fine">At least 8 characters.</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="solid wide" type="submit">
          {creating ? "Create account" : "Sign in"}
        </button>
        {creating ? null : (
          <button className="link" type="button" onClick={() => setNote("Reset links ship with the live BrainHub.")}>
            Forgot your password?
          </button>
        )}
        {note ? <p className="fine">{note}</p> : null}
      </form>
      <p className="switch">
        {creating ? "Already have an account?" : "New to BrainHub?"}{" "}
        <button type="button" onClick={() => onMode(creating ? "signin" : "create")}>
          {creating ? "Sign in" : "Create an account"}
        </button>
      </p>
      <p className="fine center">This preview keeps the session on this device. Passwords are not stored.</p>
    </section>
  );
}
