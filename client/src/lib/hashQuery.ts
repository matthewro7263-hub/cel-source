/** Reads a query param from the hash route (#/reset-password?token=abc); window.location.search is unused with hash routing. */
export function hashQueryParam(param: string): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return null;
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(param);
}
