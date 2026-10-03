/** Public origin of this deployment (no trailing slash): APP_URL, else Render's RENDER_EXTERNAL_URL, else localhost. */
export function appUrl(): string {
  const raw = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT ?? "5000"}`;
  return raw.replace(/\/+$/, "");
}

/** The client uses hash routing, so app links look like https://host/#/path. */
export function appLink(path: string): string {
  return `${appUrl()}/#${path.startsWith("/") ? path : `/${path}`}`;
}
