/** Prefix an absolute app path with the static base (`/` locally, `/folio/` on GitHub Pages). */
export function withBase(path = "/") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!path || path === "/") return `${base}/` || "/";
  if (path.startsWith("#")) return `${base}/${path}`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}

export function routerBasename() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base || undefined;
}
