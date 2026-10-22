import React, { useState, useRef, useEffect } from "react";
import { HardDrive, Download, Upload, X, ShieldCheck } from "lucide-react";
import { downloadBlob } from "./local-db";
import "./local.css";
export default function LocalWorkspaceTools() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [usage, setUsage] = useState(null),
    file = useRef();
  useEffect(() => {
    if (open)
      navigator.storage
        ?.estimate?.()
        .then(setUsage)
        .catch(() => {});
  }, [open]);
  async function backup() {
    setBusy(true);
    setMessage("Preparing your projects and source files…");
    try {
      const { exportBackup } = await import("./local-backup");
      downloadBlob(
        await exportBackup(),
        "open-studio-backup-" + new Date().toISOString().slice(0, 10) + ".zip",
      );
      setMessage("Backup downloaded. Keep it somewhere safe.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(e) {
    const selected = e.target.files[0];
    e.target.value = "";
    if (
      !selected ||
      !confirm(
        "Replace this browser workspace with the backup? Export a backup of your current work first.",
      )
    )
      return;
    setBusy(true);
    setMessage("Validating backup before restoring…");
    try {
      const { importBackup } = await import("./local-backup");
      await importBackup(selected);
      location.reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="local-workspace-pill" onClick={() => setOpen(true)}>
        <HardDrive size={15} /> On this device <span>Backup</span>
      </button>
      {open && (
        <div className="local-overlay">
          <section
            className="local-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Local workspace storage"
          >
            <button
              className="local-close"
              aria-label="Close local workspace storage"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              <X />
            </button>
            <span className="eyebrow">PRIVATE BY DESIGN · NO ACCOUNT</span>
            <h2>Your browser is your workspace.</h2>
            <p>
              Designs, brand kits and original media stay on this device.
              Nothing is uploaded to a rendering server. Other visitors cannot
              see your projects.
            </p>
            <div className="local-notice">
              Browser storage can be cleared or evicted. Private browsing,
              another browser or another site address will not share this
              workspace. Download regular backups. Existing server accounts are
              not automatically migrated.
            </div>
            {usage && (
              <p>
                Storage used: {(usage.usage / 1024 ** 2).toFixed(1)} MB of
                approximately {(usage.quota / 1024 ** 3).toFixed(1)} GB
                available to this origin.
              </p>
            )}
            <div className="local-actions">
              <button disabled={busy} onClick={backup}>
                <Download size={17} /> Download workspace backup
              </button>
              <button disabled={busy} onClick={() => file.current.click()}>
                <Upload size={17} /> Restore workspace backup
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  const kept = await navigator.storage
                    ?.persist?.()
                    .catch(() => false);
                  setMessage(
                    kept
                      ? "Persistent storage granted. Still keep external backups."
                      : "This browser did not grant persistent storage. Keep downloading backups.",
                  );
                }}
              >
                <ShieldCheck size={17} /> Request persistent storage
              </button>
            </div>
            <input
              hidden
              ref={file}
              type="file"
              accept=".zip,application/zip"
              onChange={restore}
            />
            <small>
              Backups include designs, history, brand kit and original media
              (128 MB archive safety limit). Finished MP4 exports are
              session-only: download them before closing the tab. A public
              website link does not publish your projects.
            </small>
            {message && <p role="status">{message}</p>}
          </section>
        </div>
      )}
    </>
  );
}
