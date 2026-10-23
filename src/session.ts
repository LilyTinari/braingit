export type Session = {
  name: string;
  email: string;
};

const key = "bg-session";

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.name || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null) {
  if (!session) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify(session));
}
