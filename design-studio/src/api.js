export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const result = await response
    .json()
    .catch(() => ({ error: "Server is unavailable. Please try again." }));
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Request failed"), {
      status: response.status,
    });
  return result;
}
export const projectView = (p) => ({
  ...p.meta,
  id: p.id,
  title: p.title,
  document: p.document,
  revision: p.revision,
  width: p.document.width,
  height: p.document.height,
  edited: "Edited " + new Date(p.updatedAt).toLocaleDateString(),
  meta: p.meta,
});
export async function saveProject(project) {
  const payload = {
    title: project.title,
    document: project.document,
    meta: project.meta || {
      style: project.style || "ideas",
      text: project.text || "",
      sub: project.sub || "",
      color: project.color || "#eee8dd",
      type: project.type || "Design",
      detail: project.detail || "Design",
    },
    ...(project.revision ? { revision: project.revision } : {}),
  };
  const { project: saved } = await api(
    project.revision ? "/projects/" + project.id : "/projects",
    {
      method: project.revision ? "PUT" : "POST",
      body: JSON.stringify(payload),
    },
  );
  return projectView(saved);
}
export async function uploadAsset(file) {
  const body = new FormData();
  body.append("file", file);
  return (await api("/assets", { method: "POST", body })).asset;
}
