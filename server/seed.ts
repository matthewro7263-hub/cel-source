import { storage, hashPassword, genToken } from "./storage";
import { users, scenes as scenesTable, storyboardPanels as panelsTable } from "@shared/schema";

// Generate pastel SVG panels as data URLs
function svgPanel(bg: string, text: string, sub: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${bg}" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect width="800" height="450" fill="url(#g)"/>
    <g fill="rgba(0,0,0,0.15)">
      <circle cx="160" cy="200" r="46"/>
      <rect x="120" y="240" width="80" height="120" rx="6"/>
    </g>
    <g fill="rgba(255,255,255,0.85)" font-family="ui-sans-serif, system-ui" font-weight="600">
      <text x="40" y="60" font-size="28">${text}</text>
      <text x="40" y="98" font-size="18" font-weight="400" fill="rgba(255,255,255,0.7)">${sub}</text>
    </g>
  </svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

export async function seedIfEmpty() {
  const allUsers = await storage._db.select().from(users);
  if (allUsers.length > 0) return;

  console.log("[seed] creating demo data...");

  const matthew = await storage.createUser({
    email: "matthew@cel.app",
    name: "Matthew",
    passwordHash: hashPassword("celdemo"),
    avatarColor: "#6E4FE8",
  });

  // collaborator
  const collab = await storage.createUser({
    email: "sam@cel.app",
    name: "Sam Rivera",
    passwordHash: hashPassword("celdemo"),
    avatarColor: "#E8744F",
  });

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  const project = await storage.createProject({
    ownerId: matthew.id,
    title: "Bluey Fan Animation — The Lost Toy",
    description:
      "A short fan animation following Bingo searching for her favourite plushie around the Heeler house. ~90 seconds. 2D Moho rigs with hand-drawn FX.",
    coverColor: "#6E4FE8",
    deadline: deadline.toISOString().slice(0, 10),
    status: "active",
    shareToken: "demo" + genToken(12),
    shareEnabled: true,
  });
  await storage.addMember({ projectId: project.id, userId: matthew.id, role: "owner" });
  await storage.addMember({ projectId: project.id, userId: collab.id, role: "editor" });

  // Script
  await storage.createScript({
    projectId: project.id,
    title: "Episode 1 — The Lost Toy",
    content:
      `# The Lost Toy

**INT. HEELER LOUNGEROOM — DAY**

Bingo flips couch cushions in a panic. Bluey watches from the doorway, arms crossed.

**BLUEY**
Bingo, what're you *doing*?

**BINGO**
*(muffled, head under cushion)*
I can't find Floppy! He was right here!

Bluey grins — game on.

**BLUEY**
Right. New game. *Detectives.*

---

**Notes for animation:**
- Bingo's panic should feel kinetic — heavy squash & stretch
- Bluey's reveal beat: hold for 6 frames, then a confident step in
- Hand-drawn dust puffs when cushions land`,
  });

  // Storyboard with 4 panels
  const sb = await storage.createStoryboard({ projectId: project.id, title: "Opening Scene — Lounge Search" });
  const panels = [
    { bg: "#F4D9C7", text: "Panel 1", sub: "Wide — lounge room, Bingo mid-flip" },
    { bg: "#C7DCF4", text: "Panel 2", sub: "Close on Bingo's worried face" },
    { bg: "#D6C7F4", text: "Panel 3", sub: "Bluey appears in doorway" },
    { bg: "#C7F4D9", text: "Panel 4", sub: "Two-shot — 'New game. Detectives.'" },
  ];
  for (const [i, p] of panels.entries()) {
    await storage.createPanel({
      storyboardId: sb.id,
      orderIdx: i,
      imageData: svgPanel(p.bg, p.text, p.sub),
      caption: p.sub,
      dialogue: i === 1 ? "I can't find Floppy!" : i === 3 ? "New game. Detectives." : "",
    });
  }

  // Animatic — YouTube short
  await storage.createAnimatic({
    projectId: project.id,
    title: "Rough animatic v0.2",
    videoData: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    notes: "Placeholder animatic using Big Buck Bunny opening — replace once thumbnail boards are timed.",
  });

  // Scenes
  const scenesData = [
    { number: "1A", title: "Bingo searches the couch", status: "done", days: 2 },
    { number: "1B", title: "Bluey appears in doorway", status: "final", days: 5 },
    { number: "2A", title: "Detective montage", status: "animatic", days: 8 },
    { number: "2B", title: "Floppy reveal", status: "storyboard", days: 10 },
    { number: "3A", title: "Hug + button gag", status: "script", days: 13 },
  ];
  for (const s of scenesData) {
    const d = new Date();
    d.setDate(d.getDate() + s.days);
    await storage.createScene({
      projectId: project.id,
      number: s.number,
      title: s.title,
      description: "",
      status: s.status,
      deadline: d.toISOString().slice(0, 10),
      assigneeId: matthew.id,
    });
  }

  // a comment
  await storage.createComment({
    projectId: project.id,
    sceneId: null,
    authorId: collab.id,
    body: "Loving the energy on 1A — maybe push the cushion-throw arc a frame slower for the impact pose?",
  });

  // v4storage alias preserved for downstream legacy seed blocks
  const v4storage = storage as any;

  // Seed weekly challenge prompts (idempotent)
  try {
    const { challenge_prompts } = require("../shared/challenge_schema");
    const existing = await storage._db.select().from(challenge_prompts);
    if (!existing || existing.length === 0) {
      const now = new Date().toISOString();
      await storage._db.insert(challenge_prompts).values([
        { weekNumber: 1, title: "Draw a character from behind", body: "Draw a character entirely from behind, conveying their mood or intent purely through posture and silhouette.", createdAt: now },
        { weekNumber: 2, title: "12-frame walk cycle in stepped 2s", body: "Animate a basic walk cycle using only 6 unique drawings, held for 2 frames each.", createdAt: now },
        { weekNumber: 3, title: "1-color silhouette study", body: "Create a composition using only one solid color and the background to define the form.", createdAt: now },
        { weekNumber: 4, title: "Hand expressions sheet", body: "Fill a page with 10 different hand poses that tell a story without seeing the face.", createdAt: now },
        { weekNumber: 5, title: "Bluey-style watercolor sky", body: "Paint a bright, optimistic sky background using watercolor techniques (digital or traditional) inspired by Bluey's art direction.", createdAt: now },
        { weekNumber: 6, title: "Tight character lineup in your style", body: "Draw a clean, tight lineup of 3-5 characters showing size relationships and distinct silhouettes.", createdAt: now },
      ]);
    }
  } catch (e) {
    console.error("[seed] challenge_prompts seed failed:", e);
  }

  // ===== SAMPLE ASSETS =====
  // 1. Character PNG — a colored SVG as data URL
  const bingoChrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280">
    <defs><radialGradient id="bg" cx="50%" cy="40%" r="55%"><stop offset="0%" stop-color="#F0A0D0"/><stop offset="100%" stop-color="#C06090"/></radialGradient></defs>
    <rect width="200" height="280" fill="url(#bg)" rx="16"/>
    <!-- simplified character figure -->
    <ellipse cx="100" cy="80" rx="40" ry="44" fill="#F4C87A"/>
    <ellipse cx="82" cy="72" rx="10" ry="14" fill="#E86040" transform="rotate(-8,82,72)"/>
    <ellipse cx="118" cy="72" rx="10" ry="14" fill="#E86040" transform="rotate(8,118,72)"/>
    <circle cx="100" cy="78" r="30" fill="#F4C87A"/>
    <circle cx="89" cy="74" r="4" fill="#3A2010"/>
    <circle cx="111" cy="74" r="4" fill="#3A2010"/>
    <ellipse cx="100" cy="85" rx="6" ry="4" fill="#E0705A"/>
    <!-- body -->
    <rect x="72" y="110" width="56" height="80" rx="14" fill="#F0A060"/>
    <!-- legs -->
    <rect x="76" y="186" width="22" height="55" rx="10" fill="#F4C87A"/>
    <rect x="102" y="186" width="22" height="55" rx="10" fill="#F4C87A"/>
    <text x="100" y="268" font-family="system-ui" font-size="11" fill="rgba(255,255,255,0.85)" text-anchor="middle" font-weight="600">Bingo Rig v2.moho</text>
  </svg>`;
  const bingoDataUrl = "data:image/svg+xml;base64," + Buffer.from(bingoChrSvg).toString("base64");

  await storage.createAsset({
    projectId: project.id,
    category: "Characters",
    filename: "bingo-character-rig.png",
    mimeType: "image/png",
    fileData: bingoDataUrl,
    thumbnailData: bingoDataUrl,
    notes: "Main character rig for Bingo. All layers named. Mouth shapes A-H included.",
    tags: "bingo,character,rig,moho",
    uploaderId: matthew.id,
  });

  // 2. Moho file placeholder (not an image — shows icon card)
  const mohoPlaceholder = "data:application/octet-stream;base64," + Buffer.from("MOHO_PLACEHOLDER").toString("base64");
  await storage.createAsset({
    projectId: project.id,
    category: "Characters",
    filename: "bluey-character-rig.moho",
    mimeType: "application/x-moho",
    fileData: mohoPlaceholder,
    thumbnailData: null,
    notes: "Bluey main rig. Uses mouth shapes library v3.",
    tags: "bluey,character,rig,moho",
    uploaderId: matthew.id,
  });

  // ===== SAMPLE COMMISSION =====
  await storage.createCommission({
    ownerUserId: matthew.id,
    clientName: "Sophie Chen",
    clientEmail: "sophie.chen@example.com",
    type: "Animation - 2D",
    description: "Looking for a 30-second animated intro for my YouTube channel about cooking. Style should be warm and whimsical — think Studio Ghibli meets MasterChef. Would love a character version of me (red curly hair, apron) doing something fun in the kitchen.",
    referenceImage: null,
    deadline: new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
    budgetRange: "$150-$500",
    status: "new",
    notes: "",
  });

  // ===== SAMPLE RENDER =====
  // Get first scene (1A)
  const allScenes = await storage._db.select().from(scenesTable);
  if (allScenes.length > 0) {
    await storage.createRender({
      sceneId: allScenes[0].id,
      label: "Preview pass v1",
      status: "done",
      software: "Moho",
      durationSeconds: 124, // 2m04s
      fileUrl: "https://example.com/renders/scene1a-preview-v1.mp4",
      notes: "Low-res preview for timing check. Full res pending.",
    });
  }

  // ===== ANIMATIC PROJECT v2 (seed) =====
  // Use the storyboard panels we just created
  const allPanels = await storage._db.select().from(panelsTable);
  const sampleAnimatic = await storage.createAnimaticProject({
    projectId: project.id,
    title: "Lost Toy — Opening Sequence Cut",
    fps: 24,
    totalDurationMs: 8000,
  });
  // getAnimaticProject returns full assembly with tracks
  const fullAnimatic = (await storage.getAnimaticProject(sampleAnimatic.id))!;
  const panelTrack = fullAnimatic.tracks.find((t) => t.kind === "panel");
  if (panelTrack && allPanels.length >= 4) {
    // Place 4 panel clips at 0, 2000, 4000, 6000ms
    for (let i = 0; i < 4; i++) {
      await storage.createClip({
        trackId: panelTrack.id,
        startMs: i * 2000,
        durationMs: 2000,
        sourceKind: "panel_ref",
        sourceId: allPanels[i].id,
        audioDataUrl: null,
        label: allPanels[i].caption || `Panel ${i + 1}`,
        fadeInMs: 0,
        fadeOutMs: 0,
        volume: "1.0",
      });
    }
  }

  // ===== v4 seed data =====
  // v4 inbox items (3)
  if (typeof (storage as any).createInboxItem === "function") {
    await (storage as any).createInboxItem({
      userId: matthew.id,
      title: "Sketch panel for scene 2A",
      body: "Add a rough sketch of the detective montage opening shot so timing can be reviewed.",
      kind: "task",
      pinned: false,
      archivedAt: null,
    });
    await (storage as any).createInboxItem({
      userId: matthew.id,
      title: "Sophie's commission — follow up on reference images",
      body: "Client said she'd send photo references for the kitchen scene. Check email.",
      kind: "note",
      pinned: true,
      archivedAt: null,
    });
    await (storage as any).createInboxItem({
      userId: matthew.id,
      title: "Render 2B overnight",
      body: "Start the Blender render for scene 2B before bed. Use OptiX denoiser.",
      kind: "task",
      pinned: false,
      archivedAt: null,
    });
  }

  // v4 tags (2)
  let urgentTagId: number | null = null;
  let polishTagId: number | null = null;
  if (typeof (storage as any).createTag === "function") {
    const urgentTag = await (storage as any).createTag({ name: "urgent", color: "#EF4444", userId: matthew.id });
    urgentTagId = urgentTag?.id ?? null;
    const polishTag = await (storage as any).createTag({ name: "polish", color: "#F59E0B", userId: matthew.id });
    polishTagId = polishTag?.id ?? null;
  }

  // v4 tag assignment — tag scene 1 as urgent
  const allScenesSeed = await storage._db.select().from(scenesTable);
  if (urgentTagId && allScenesSeed.length > 0 && typeof (storage as any).createTagAssignment === "function") {
    await (storage as any).createTagAssignment({ tagId: urgentTagId, entityKind: "scene", entityId: allScenesSeed[0].id });
  }

  // v4 panel pin (1) — pin on panel 1 (use current schema: body + authorId)
  const allPanelsSeed = await storage._db.select().from(panelsTable);
  if (allPanelsSeed.length > 0 && typeof (storage as any).createPanelPin === "function") {
    try {
      await (storage as any).createPanelPin({
        panelId: allPanelsSeed[0].id,
        authorId: matthew.id,
        xPercent: 30,
        yPercent: 45,
        body: "Push Bingo's ear shape here \u2014 feels a bit stiff",
      });
    } catch (e) {
      console.warn("[seed] panel_pins skipped:", (e as Error).message);
    }
  }

  // v4 achievement unlock — first_project for matthew
  try {
    if (typeof (storage as any).unlockAchievement === "function") {
      await (storage as any).unlockAchievement(matthew.id, "first_project");
      await (storage as any).unlockAchievement(matthew.id, "first_scene");
    }
  } catch (e: any) { console.warn("[seed] achievements skipped:", e?.message); }

  // v4 commission line items (2) on Sophie's commission
  const allCommissions = await (storage as any).listCommissions ? await (storage as any).listCommissions(matthew.id) : [];
  const sophieCommission = allCommissions[0];
  try {
    if (sophieCommission && typeof (storage as any).createCommissionLineItem === "function") {
      await (storage as any).createCommissionLineItem({
        commissionId: sophieCommission.id,
        description: "Character design + 3 expressions",
        quantity: 1,
        unitPriceCents: 8000,
      });
      await (storage as any).createCommissionLineItem({
        commissionId: sophieCommission.id,
        description: "30-second 2D animation",
        quantity: 1,
        unitPriceCents: 25000,
      });
    }
  } catch (e: any) { console.warn("[seed] line items skipped:", e?.message); }

  console.log("[seed] done. demo login: matthew@cel.app / celdemo");
}
