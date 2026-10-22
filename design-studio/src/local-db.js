// No network fallback: an unavailable browser database must be reported, not hidden.
import { assetUrl } from "./config";
let opening;
export const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function database() {
  if (!opening)
    opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB)
        return reject(
          fail(
            "This browser does not support local storage. Use a recent browser outside private mode.",
          ),
        );
      const request = indexedDB.open("open-studio-local-v1:" + assetUrl(""), 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("records", { keyPath: "key" });
      request.onerror = () => {
        opening = null;
        reject(request.error);
      };
      request.onblocked = () => {
        opening = null;
        reject(fail("Close other Open Studio tabs and try again."));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
    });
  return opening;
}
export async function read(key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("records").objectStore("records").get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}
export async function list(prefix = "") {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("records")
      .objectStore("records")
      .getAll(IDBKeyRange.bound(prefix, prefix + "\uffff"));
    req.onsuccess = () => resolve(req.result.map((r) => r.value));
    req.onerror = () => reject(req.error);
  });
}
export async function writeMany(records, remove = []) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    try {
      for (const key of remove) store.delete(key);
      for (const [key, value] of records) store.put({ key, value });
    } catch (error) {
      tx.abort();
      reject(error);
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        tx.error ||
          fail("Storage could not be updated. Check available space."),
      );
    tx.onerror = () => {};
  });
}
// The revision check and save share a transaction; another tab cannot silently overwrite work.
export async function saveRecord(kind, id, input) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    let result, error;
    if (kind === "videoProjects") {
      const d = input.document,
        ids = new Set(
          [
            ...d.clips,
            ...(d.overlays || []),
            ...(d.audioTracks || []),
            ...(d.soundtrack ? [d.soundtrack] : []),
          ].map((c) => c.assetId),
        );
      for (const source of ids) {
        const check = store.get("media/" + source);
        check.onsuccess = () => {
          if (!check.result) {
            error = fail(
              "A source file was removed in another tab. Restore it before saving.",
              409,
            );
            tx.abort();
          }
        };
      }
    }
    const req = store.get(kind + "/" + id);
    req.onsuccess = () => {
      const old = req.result?.value;
      if (old && old.revision !== input.revision) {
        error = fail(
          "This project changed in another tab. Reopen it before saving.",
          409,
        );
        tx.abort();
        return;
      }
      if (!old && input.revision) {
        error = fail("Project no longer exists. Reopen your workspace.", 404);
        tx.abort();
        return;
      }
      result = {
        id,
        title: input.title.trim() || "Untitled",
        document: input.document,
        meta: input.meta || {},
        revision: (old?.revision || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      if (old && kind === "projects")
        store.put({
          key: `versions/${id}/${old.revision}`,
          value: {
            ...old,
            projectId: id,
            id: String(old.revision),
            created: old.updatedAt,
          },
        });
      if (old && kind === "projects" && old.revision > 30)
        store.delete(`versions/${id}/${old.revision - 30}`);
      store.put({ key: kind + "/" + id, value: result });
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        error ||
          tx.error ||
          fail("Not enough browser storage. Export a backup and free space."),
      );
    tx.onerror = () => {};
  });
}
export async function replaceRecords(records) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    try {
      store.clear();
      for (const [key, value] of records) store.put({ key, value });
    } catch (error) {
      tx.abort();
      reject(error);
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        tx.error || fail("Restore failed; existing workspace was preserved."),
      );
    tx.onerror = () => {};
  });
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const dataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
export async function recordsSnapshot() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("records").objectStore("records").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMedia(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    let error;
    const req = store.getAll(
      IDBKeyRange.bound("videoProjects/", "videoProjects/\uffff"),
    );
    req.onsuccess = () => {
      if (
        req.result.some((r) => JSON.stringify(r.value.document).includes(id))
      ) {
        error = fail("Remove this source from saved projects first.", 409);
        tx.abort();
      } else store.delete("media/" + id);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(error || tx.error);
    tx.onerror = () => {};
  });
}
export async function deleteProject(kind, id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite"),
      store = tx.objectStore("records");
    store.delete(kind + "/" + id);
    if (kind === "projects") {
      const req = store.getAllKeys(
        IDBKeyRange.bound(`versions/${id}/`, `versions/${id}/\uffff`),
      );
      req.onsuccess = () => req.result.forEach((key) => store.delete(key));
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => {};
  });
}
