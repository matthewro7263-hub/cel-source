import { storage } from "./storage";

const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);

/**
 * Only real Discord webhook URLs are allowed. Anything else would let a project member make the
 * server POST to arbitrary hosts (SSRF against internal services / cloud metadata endpoints).
 */
export function isDiscordWebhookUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && DISCORD_HOSTS.has(url.hostname) && url.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

export async function notifyDiscord(projectId: number, title: string, description: string) {
  const project = await storage.getProject(projectId);
  if (!project) return;
  const webhookUrl = (project as any).dltDiscordWebhookUrl;
  if (!webhookUrl || typeof webhookUrl !== "string") return;

  if (!isDiscordWebhookUrl(webhookUrl)) return; // silently skip malformed / non-Discord URLs

  let colorInt = 0x9DD0FF;
  const brandColorStr = (project as any).cli_brandColor;
  if (brandColorStr && typeof brandColorStr === "string" && brandColorStr.startsWith("#") && brandColorStr.length >= 4) {
    const parsed = parseInt(brandColorStr.slice(1), 16);
    if (!isNaN(parsed)) colorInt = parsed;
  }

  // Truncate description to Discord's 4096-char embed limit
  const safeDesc = description.length > 4000 ? description.slice(0, 4000) + "\u2026" : description;

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      redirect: "manual", // never follow a redirect off Discord
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: title.slice(0, 256), // Discord title limit
          description: safeDesc,
          color: colorInt,
          timestamp: new Date().toISOString(),
          footer: { text: `Cel \u00b7 ${project.title}` }
        }]
      })
    });
    if (!resp.ok) {
      console.warn(`Discord webhook returned ${resp.status} for project ${projectId}`);
    }
  } catch (err) {
    console.error("Discord webhook fetch failed:", err);
  }
}
