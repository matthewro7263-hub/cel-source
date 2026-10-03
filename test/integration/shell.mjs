// The document shell users and link-preview crawlers see before any JavaScript runs.
import { call, check, summary, base } from "./lib.mjs";

const html = await (await fetch(`${base}/`)).text();
check("shell has a title and description", /<title>Cel/.test(html) && /name="description"/.test(html));
check("APP_URL placeholders are filled in (absolute social-preview URLs)", !html.includes("%APP_URL%") && html.includes('content="https://cel.test/og-image.png"') && html.includes('rel="canonical" href="https://cel.test/"'), html.match(/og:image"[^>]*/)?.[0]);
const viewport = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? "";
check("viewport doesn't block pinch-zoom", /width=device-width/.test(viewport) && !/maximum-scale|user-scalable/.test(viewport), viewport);
check("Google Fonts are no longer requested", !/fonts\.googleapis|fonts\.gstatic/.test(html));
const rid = (await fetch(`${base}/health`)).headers.get("x-request-id");
check("every response carries a request id", /^[0-9a-f-]{36}$/.test(rid ?? ""), rid);
check("a sane inbound request id is reused for correlation", (await fetch(`${base}/health`, { headers: { "x-request-id": "render-abc12345" } })).headers.get("x-request-id") === "render-abc12345");
check("a hostile inbound request id is replaced", /^[0-9a-f-]{36}$/.test((await fetch(`${base}/health`, { headers: { "x-request-id": "bad id\twith spaces" } })).headers.get("x-request-id") ?? ""));
const badJson = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
check("malformed JSON is a clean 400, not a 500", badJson.status === 400, badJson.status);
check("noscript fallback present", /<noscript>/.test(html));

const asset = async (path) => { const r = await fetch(`${base}${path}`); return { status: r.status, type: r.headers.get("content-type") ?? "", cache: r.headers.get("cache-control") ?? "", len: Number(r.headers.get("content-length") ?? 0), body: r }; };
for (const [path, type] of [["/favicon.svg", /svg/], ["/favicon.png", /png/], ["/apple-touch-icon.png", /png/], ["/icon-192.png", /png/], ["/icon-512.png", /png/], ["/og-image.png", /png/]]) {
  const a = await asset(path);
  check(`${path} is served as an image (no more favicon 404)`, a.status === 200 && type.test(a.type) && a.len > 100, a);
}
const manifestRes = await asset("/manifest.webmanifest");
const manifest = await manifestRes.body.json().catch(() => null);
check("web manifest is valid JSON with a name and start_url", manifestRes.status === 200 && manifest?.name === "Cel" && !!manifest.start_url, manifestRes);
let iconsOk = true;
for (const icon of manifest?.icons ?? []) iconsOk &&= (await asset(icon.src)).status === 200;
check("every manifest icon exists", iconsOk && manifest?.icons?.length >= 2, manifest?.icons);
const robots = await (await fetch(`${base}/robots.txt`)).text();
check("robots.txt keeps crawlers out of the API", /Disallow: \/api\//.test(robots), robots);

// Bundled fonts: referenced by the built stylesheet, served same-origin and cached forever.
const css = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
const cssText = css ? await (await fetch(`${base}${css}`)).text() : "";
const fontUrl = cssText.match(/url\((\/assets\/geist-latin-wght-normal[^)]+\.woff2)\)/)?.[1];
check("built CSS bundles Geist", !!fontUrl, css);
if (fontUrl) {
  const f = await asset(fontUrl);
  check("bundled font is served with long-lived caching", f.status === 200 && /immutable/.test(f.cache) && /font|octet/.test(f.type), f);
}
check("an unknown file path 404s instead of returning the app shell", (await asset("/definitely-missing.png")).status === 404);
const deep = await fetch(`${base}/reset-password?token=abc123`, { redirect: "manual" });
check("path-style deep links redirect to their hash route (query preserved)", deep.status === 302 && deep.headers.get("location") === "/#/reset-password?token=abc123", { status: deep.status, location: deep.headers.get("location") });
check("assets are referenced with absolute URLs so deep paths can't break them", /<script[^>]+src="\/assets\//.test(html) && !/(src|href)="\.\/assets/.test(html), html.match(/<script[^>]*>/)?.[0]);

// Public config the client reads before sign-in.
const cfg = await call("GET", "/api/config");
check("config exposes email + contact and (because the suite seeds demo data) demo creds", cfg.status === 200 && cfg.json.emailEnabled === true && cfg.json.demo?.email === "matthew@cel.app" && "contactEmail" in cfg.json, cfg);
check("config never leaks secrets", !/secret|key|token/i.test(JSON.stringify(cfg.json)), cfg.json);

process.exit(summary() ? 1 : 0);
