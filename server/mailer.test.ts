import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { appLink, appUrl, mailConfigured, sendMail } from "./mailer";
import { commissionRequestEmail, esc, passwordResetEmail, projectInviteEmail } from "./emails";

const realFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

describe("mailer", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_URL;
    delete process.env.MAIL_FROM;
  });

  test("skips (without throwing) when no API key is configured", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    expect(mailConfigured()).toBe(false);
    expect(await sendMail({ to: "a@b.co", subject: "Hi", text: "body" })).toEqual({ sent: false, reason: "not_configured" });
    log.mockRestore();
  });

  test("never prints message bodies (single-use links) in production", async () => {
    process.env.NODE_ENV = "production";
    const log = spyOn(console, "log").mockImplementation(() => {});
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await sendMail({ to: "a@b.co", subject: "Reset", text: "https://secret-link" });
    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-link");
    log.mockRestore(); warn.mockRestore();
  });

  test("posts to Resend with auth, sender and a single-line subject", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Cel <hi@example.com>";
    let captured: any;
    globalThis.fetch = (async (url: any, init: any) => { captured = { url, init, body: JSON.parse(init.body) }; return new Response("{}", { status: 200 }); }) as any;
    const result = await sendMail({ to: "a@b.co", subject: "Line one\r\nBcc: evil@x.co", text: "t", html: "<p>t</p>" });
    expect(result).toEqual({ sent: true });
    expect(captured.url).toBe("https://api.resend.com/emails");
    expect(captured.init.headers.Authorization).toBe("Bearer re_test");
    expect(captured.body).toMatchObject({ from: "Cel <hi@example.com>", to: ["a@b.co"], subject: "Line one Bcc: evil@x.co", html: "<p>t</p>" });
  });

  test("reports failure instead of throwing when Resend rejects or the network drops", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const err = spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = (async () => new Response('{"message":"bad"}', { status: 422 })) as any;
    expect(await sendMail({ to: "a@b.co", subject: "x", text: "t" })).toEqual({ sent: false, reason: "failed" });
    globalThis.fetch = (async () => { throw new Error("socket hang up"); }) as any;
    expect(await sendMail({ to: "a@b.co", subject: "x", text: "t" })).toEqual({ sent: false, reason: "failed" });
    err.mockRestore();
  });

  test("builds hash-router links from APP_URL", () => {
    process.env.APP_URL = "https://cel.example.com/";
    expect(appUrl()).toBe("https://cel.example.com");
    expect(appLink("/reset-password?token=abc")).toBe("https://cel.example.com/#/reset-password?token=abc");
  });
});

describe("email templates", () => {
  test("esc neutralises HTML", () => {
    expect(esc(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
  });

  test("user-supplied text can't inject markup", () => {
    const mail = commissionRequestEmail({ to: "a@b.co", artist: "A", clientName: `<img src=x onerror=alert(1)>`, clientEmail: "c@d.co", type: "Other", budget: "Discuss", description: "<b>hi</b>", url: "https://x/#/commissions" });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("<b>hi</b>");
    expect(mail.html).toContain("&lt;img");
  });

  test("reset email carries the link in both parts and states the expiry", () => {
    const mail = passwordResetEmail("a@b.co", "Ada", "https://x/#/reset-password?token=t", 1);
    expect(mail.text).toContain("https://x/#/reset-password?token=t");
    expect(mail.html).toContain("https://x/#/reset-password?token=t");
    expect(mail.text).toContain("1 hour");
  });

  test("invite for a new account links to set-password, otherwise to the project", () => {
    const base = { to: "a@b.co", name: "Ada", inviter: "Matt", project: "Lost Toy", role: "editor", url: "https://x/#/projects/1" };
    expect(projectInviteEmail({ ...base, setPasswordUrl: "https://x/#/reset-password?token=z" }).text).toContain("reset-password?token=z");
    expect(projectInviteEmail(base).text).toContain("https://x/#/projects/1");
  });
});
