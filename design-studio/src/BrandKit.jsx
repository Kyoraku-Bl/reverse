import React, { useState } from "react";
import { Palette, Check, Plus } from "lucide-react";
import { useWorkspace } from "./Workspace";
export default function BrandKit() {
  const { preferences, updatePreferences } = useWorkspace();
  const [name, setName] = useState(preferences.brand?.name || ""),
    [colors, setColors] = useState(
      preferences.brand?.colors || [
        "#4d6149",
        "#b4c6a0",
        "#efe8de",
        "#d3b4dd",
        "#282e28",
      ],
    ),
    [font, setFont] = useState(preferences.brand?.fonts?.[0] || "DM Sans"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updatePreferences({ brand: { name, colors, fonts: [font] } });
      setMessage(
        "Your brand kit is saved. Its colors are available in the editor.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="brand-page">
      <div className="eyebrow">YOUR BRAND. NO SUBSCRIPTION.</div>
      <h1>A home for your brand.</h1>
      <p>Keep your colors and typography consistent across every design.</p>
      <form className="brand-kit-editor" onSubmit={save}>
        <label>
          Brand name
          <input
            type="text"
            value={name}
            required
            maxLength={80}
            placeholder="Your brilliant brand"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="brand-color-inputs">
          {colors.map((c, i) => (
            <input
              key={i}
              aria-label={`Brand color ${i + 1}`}
              type="color"
              value={c}
              onChange={(e) =>
                setColors(colors.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
          ))}
          {colors.length < 12 && (
            <button
              type="button"
              aria-label="Add brand color"
              onClick={() => setColors([...colors, "#ffffff"])}
            >
              <Plus size={19} />
            </button>
          )}
        </div>
        <label>
          Primary font
          <select
            style={{
              display: "block",
              marginTop: 10,
              padding: 10,
              border: "1px solid #dee6d2",
              borderRadius: 6,
            }}
            value={font}
            onChange={(e) => setFont(e.target.value)}
          >
            {["DM Sans", "Manrope", "Georgia", "Arial", "monospace"].map(
              (f) => (
                <option key={f}>{f}</option>
              ),
            )}
          </select>
        </label>
        <button
          className="primary-button full"
          disabled={busy}
          style={{ marginTop: 25 }}
        >
          <Check size={16} />
          {busy ? "Saving…" : "Save brand kit — free"}
        </button>
        {message && (
          <p
            style={{ marginTop: 20, fontSize: 12, lineHeight: 1.8 }}
            role="status"
          >
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
