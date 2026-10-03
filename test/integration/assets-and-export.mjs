// Asset tagging / similar assets (real implementations, mock OpenRouter) and the glTF storyboard export.
import { call, check, summary, png, base } from "./lib.mjs";
const uniq = Date.now();
const signup = async (tag) => (await call("POST", "/api/auth/signup", { email: `${tag}${uniq}@example.com`, name: tag, password: "password123" })).json.token;
const token = await signup("assets");
const other = await signup("assetsother");
const pid = (await call("POST", "/api/projects", { title: "Assets Project" }, token)).json.id;

const mkAsset = async (filename, tags, category = "Characters") =>
  (await call("POST", `/api/projects/${pid}/assets`, { filename, mimeType: "image/png", fileData: png, thumbnailData: png, category, tags }, token)).json;
const bluey = await mkAsset("bluey-rig.png", "bluey, rig");
const bingo = await mkAsset("bingo-rig.png", "bingo, rig");
const kitchen = await mkAsset("kitchen.png", "", "Backgrounds");
const doc = (await call("POST", `/api/projects/${pid}/assets`, { filename: "notes.pdf", mimeType: "application/pdf", fileData: "data:application/pdf;base64,JVBERi0=", tags: "" }, token)).json;

// --- similar assets
let r = await call("GET", `/api/assets/${bluey.id}/similar`, undefined, token);
check("similar ok", r.status === 200 && Array.isArray(r.json.items), r);
check("similar finds the asset sharing a tag", r.json.items.map((i) => i.id).includes(bingo.id), r.json);
check("similar excludes self and unrelated assets", !r.json.items.some((i) => i.id === bluey.id || i.id === kitchen.id), r.json);
check("similar includes a thumbnail and no file payload", r.json.items[0]?.thumbnailData?.startsWith("data:image") && !("fileData" in r.json.items[0]), r.json.items[0]);
r = await call("GET", `/api/assets/${bluey.id}/similar`, undefined, other);
check("similar forbidden for non-members", r.status === 403, r);
r = await call("GET", `/api/assets/999999/similar`, undefined, token);
check("similar 404 for missing asset", r.status === 404, r);
r = await call("GET", `/api/assets/${bluey.id}/similar`);
check("similar requires auth", r.status === 401, r);

// --- auto-tag
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, {}, token);
check("auto-tag without a key explains how to enable it", r.status === 400 && /OpenRouter/.test(r.json.message), r);
// "mock/text-only" rejects image input, so this also proves the fallback to the next model works.
await call("POST", `/api/projects/${pid}/ai/key`, { key: "sk-real-key", model: "mock/text-only" }, token);
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, {}, other);
check("auto-tag forbidden for non-members", r.status === 403, r);
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, {}, token);
check("auto-tag tags untagged images", r.status === 200 && r.json.tagged === 1 && r.json.failed === 0, r);
const tagged = r.json.results?.[0];
check("auto-tag only touched the untagged image", tagged?.id === kitchen.id, r.json);
check("auto-tag normalises and stores model tags", tagged?.tags === "mock tag, cartoon, kitchenp", tagged);
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, {}, token);
check("auto-tag is a no-op once everything is tagged", r.status === 200 && r.json.tagged === 0 && r.json.results.length === 0, r);
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, { assetIds: [bluey.id, doc.id] }, token);
check("explicit ids merge with existing tags and skip non-images", r.status === 200 && r.json.tagged === 1 && r.json.results[0].tags.startsWith("bluey, rig, mock tag"), r.json);
r = await call("POST", `/api/projects/${pid}/assets/auto-tag`, { assetIds: Array.from({ length: 13 }, (_, i) => i + 1) }, token);
check("auto-tag caps batch size", r.status === 400, r);

// --- glTF export
const sceneId = (await call("POST", `/api/projects/${pid}/scenes`, { title: "Doorway", orderIdx: 0, status: "Todo" }, token)).json.id;
r = await call("GET", `/api/scenes/${sceneId}/export/gltf`, undefined, token);
check("gltf export with no panels -> 422", r.status === 422 && /no storyboard panels/i.test(r.json.message), r);
const sbId = (await call("POST", `/api/projects/${pid}/storyboards`, { title: "Board" }, token)).json.id;
const svg = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#8ecae6"/></svg>').toString("base64");
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, caption: "Wide", sceneId }, token);
check("panel can be created inside a scene", r.status === 200 && r.json.sceneId === sceneId, r);
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: svg, caption: "SVG panel" }, token);
const svgPanel = r.json.id;
check("panel starts unattached", r.json.sceneId === null, r);
r = await call("PATCH", `/api/panels/${svgPanel}`, { sceneId }, token);
check("panel can be attached to a scene afterwards", r.status === 200 && r.json.sceneId === sceneId, r);
r = await call("POST", `/api/storyboards/${sbId}/panels`, { imageData: png, caption: "other scene" }, token);
const otherScenePanel = r.json.id;
r = await call("PATCH", `/api/panels/${otherScenePanel}`, { sceneId: 999999 }, token);
check("panel can't be attached to a scene that isn't in the project", r.status === 400, r);
const foreignProject = (await call("POST", "/api/projects", { title: "Elsewhere" }, other)).json.id;
const foreignScene = (await call("POST", `/api/projects/${foreignProject}/scenes`, { title: "Foreign", orderIdx: 0, status: "Todo" }, other)).json.id;
r = await call("PATCH", `/api/panels/${otherScenePanel}`, { sceneId: foreignScene }, token);
check("panel can't be attached to someone else's scene", r.status === 400, r);
r = await call("PATCH", `/api/panels/${svgPanel}`, { sceneId: null }, token);
check("panel can be detached again", r.status === 200 && r.json.sceneId === null, r);
await call("PATCH", `/api/panels/${svgPanel}`, { sceneId }, token);
r = await fetch(`${base}/api/scenes/${sceneId}/export/gltf`, { headers: { authorization: "Bearer " + token } });
const raw = await r.text();
check("gltf export 200 with model content type", r.status === 200 && /model\/gltf\+json/.test(r.headers.get("content-type")), { status: r.status, raw: raw.slice(0, 200) });
check("gltf download filename", /filename="scene_1_Doorway\.gltf"/.test(r.headers.get("content-disposition") ?? ""), r.headers.get("content-disposition"));
check("gltf reports exported panels", r.headers.get("x-cel-panels-exported") === "2" && r.headers.get("x-cel-panels-skipped") === "0", Object.fromEntries(r.headers));
let gltf = {}; try { gltf = JSON.parse(raw); } catch {}
check("gltf has a camera + one plane per scene panel (not other scenes' panels)", gltf.nodes?.length === 3 && gltf.meshes?.length === 2, gltf.nodes);
check("gltf textures are raster images (SVG was converted to PNG)", gltf.images?.every((i) => /^image\/(png|jpeg)$/.test(i.mimeType) && i.uri.startsWith(`data:${i.mimeType};base64,`)), gltf.images?.map((i) => i.mimeType));
check("gltf keeps panel captions as extras", gltf.nodes?.[1]?.extras?.caption === "Wide" && gltf.nodes?.[2]?.extras?.caption === "SVG panel", gltf.nodes);
check("svg panel keeps its 16:9 aspect", Math.abs(gltf.nodes?.[2]?.scale?.[0] / gltf.nodes?.[2]?.scale?.[1] - 16 / 9) < 0.01, gltf.nodes?.[2]?.scale);
r = await call("GET", `/api/scenes/${sceneId}/export/gltf`, undefined, other);
check("gltf export forbidden for non-members", r.status === 403, r);
r = await call("GET", `/api/scenes/${sceneId}/export/gltf`);
check("gltf export requires auth", r.status === 401, r);
r = await call("GET", `/api/scenes/999999/export/gltf`, undefined, token);
check("gltf export 404 for missing scene", r.status === 404, r);
r = await call("POST", `/api/scenes/${sceneId}/gltf-stub`, undefined, token);
check("old stub endpoint is gone", r.status === 404, r);

process.exit(summary() ? 1 : 0);
