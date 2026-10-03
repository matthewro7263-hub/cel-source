// wouter's stock hash hook treats everything after "#" as the path, so "#/reset-password?token=abc" never
// matches the "/reset-password" route (and its navigate() moves the query out of the hash entirely).
// This wrapper keeps "?query" inside the hash, which is what the app's links, emailed links and
// hashQueryParam() all expect: the matched path excludes the query and useSearch() returns it.
import { useSyncExternalStore } from "react";
import { useHashLocation as stockHashLocation } from "wouter/use-hash-location";

const subscribe = (callback: () => void) => {
  addEventListener("hashchange", callback);
  return () => removeEventListener("hashchange", callback);
};

const hashSearch = () => {
  const hash = location.hash;
  const i = hash.indexOf("?");
  return i === -1 ? "" : hash.slice(i);
};

export function navigate(to: string, { replace = false, state = null }: { replace?: boolean; state?: unknown } = {}) {
  const oldURL = location.href;
  const url = new URL(oldURL);
  url.hash = to.startsWith("/") ? to : `/${to}`;
  history[replace ? "replaceState" : "pushState"](state, "", url.href);
  dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: url.href }));
}

export function useHashLocation(options?: { ssrPath?: string }): [string, typeof navigate] {
  const [location] = stockHashLocation(options);
  return [location.split("?")[0], navigate];
}
useHashLocation.hrefs = (href: string) => "#" + href;

function useHashSearch() {
  return useSyncExternalStore(subscribe, hashSearch, () => "");
}
useHashLocation.searchHook = useHashSearch;
