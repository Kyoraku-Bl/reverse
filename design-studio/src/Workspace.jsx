import React, { useState, useEffect, createContext, useContext } from "react";
import { api, projectView, saveProject } from "./api";
import { Sparkles, ArrowRight, LoaderCircle, LogOut } from "lucide-react";
const Context = createContext(null);
export const useWorkspace = () => useContext(Context);
export function Workspace({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [projects, setProjects] = useState([]),
    [preferences, setPreferences] = useState({
      favorites: [],
      workspace: "Personal",
      brand: null,
    });
  const load = async () => {
    const [p, prefs] = await Promise.all([
      api("/projects"),
      api("/preferences"),
    ]);
    setProjects(p.projects.map(projectView));
    setPreferences(prefs);
  };
  useEffect(() => {
    let alive = true;
    api("/auth/me")
      .then(async (r) => {
        if (alive) {
          await load();
          setUser(r.user);
        }
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function auth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.target));
    try {
      const r = await api(
        "/auth/" + (mode === "login" ? "login" : "register"),
        { method: "POST", body: JSON.stringify(form) },
      );
      await load();
      setUser(r.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const updatePreferences = async (update) => {
    await api("/preferences", { method: "PUT", body: JSON.stringify(update) });
    setPreferences((p) => ({ ...p, ...update }));
  };
  const save = async (p) => {
    const saved = await saveProject(p);
    setProjects((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
    return saved;
  };
  const remove = async (id) => {
    await api("/projects/" + id, { method: "DELETE" });
    setProjects((list) => list.filter((p) => p.id !== id));
  };
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setProjects([]);
      setPreferences({ favorites: [], workspace: "Personal", brand: null });
    } catch (e) {
      setError(e.message);
    }
  };
  if (loading)
    return (
      <div className="auth-loading">
        <LoaderCircle size={30} className="spin" />
        <p>Opening your creative workspace…</p>
      </div>
    );
  if (!user)
    return (
      <div className="auth-page">
        <section className="auth-intro">
          <span className="studio-logo">
            Open Studio<span>✦</span>
          </span>
          <div>
            <span className="eyebrow">YOUR IDEAS. NO PAYWALLS.</span>
            <h1>
              A little idea.
              <br />
              Unlimited
              <br />
              <em>possibilities.</em>
            </h1>
            <p>
              A real creative workspace. Your designs, your files,
              <br />
              your own space to make something wonderful.
            </p>
            <div className="auth-pills">
              <span>✦ Free editing tools</span>
              <span>↗ No-watermark exports</span>
              <span>♡ Your work, saved</span>
            </div>
          </div>
          <small>
            Independent, open-source creative tools. Not affiliated with Canva.
          </small>
        </section>
        <section className="auth-form-panel">
          <form onSubmit={auth}>
            <span className="modal-symbol">
              <Sparkles size={25} />
            </span>
            <h2>
              {mode === "login"
                ? "Welcome to your creative space."
                : "A home for your big ideas."}
            </h2>
            <p>
              {mode === "login"
                ? "Sign in to pick up where you left off."
                : "Create your free account. No subscription. No card."}
            </p>
            {mode === "register" && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={60}
                  placeholder="What should we call you?"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={10}
                maxLength={128}
                placeholder="At least 10 characters"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button full" disabled={busy}>
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create free account"
              )}
              <ArrowRight size={17} />
            </button>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login"
                ? "New here? Create a free account"
                : "Already have an account? Sign in"}
            </button>
            <small>
              Your projects are saved on this server, not just in this browser.
            </small>
          </form>
        </section>
      </div>
    );
  return (
    <Context.Provider
      value={{
        user,
        projects,
        preferences,
        updatePreferences,
        save,
        remove,
        logout,
        reload: load,
      }}
    >
      {children}
      {error && (
        <div className="toast" onClick={() => setError("")}>
          {error}
        </div>
      )}
    </Context.Provider>
  );
}
