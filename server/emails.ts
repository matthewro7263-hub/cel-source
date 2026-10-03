// Email templates. Every user-supplied value goes through esc() before it reaches HTML.
import type { MailMessage } from "./mailer";

export const esc = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, bodyHtml: string, button?: { label: string; url: string }, footer = ""): string {
  const btn = button
    ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#111827;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${esc(button.label)}</a></p>
       <p style="font-size:12px;color:#6b7280;word-break:break-all">Or paste this link into your browser:<br>${esc(button.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="font-size:20px;font-weight:800;margin:0 0 20px">Cel</p>
    <h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
    <div style="font-size:15px;line-height:1.55">${bodyHtml}</div>
    ${btn}
    ${footer ? `<p style="font-size:12px;color:#6b7280;margin-top:24px">${footer}</p>` : ""}
  </div></body></html>`;
}

export function passwordResetEmail(to: string, name: string, url: string, hours: number): MailMessage {
  return {
    to,
    subject: "Reset your Cel password",
    text: `Hi ${name},\n\nUse this link to choose a new Cel password (valid for ${hours} hour${hours === 1 ? "" : "s"}):\n\n${url}\n\nIf you didn't ask for this, you can ignore this email; your password hasn't changed.`,
    html: layout("Reset your password", `<p>Hi ${esc(name)}, use the button below to choose a new password. The link works once and expires in ${hours} hour${hours === 1 ? "" : "s"}.</p>`,
      { label: "Choose a new password", url },
      "If you didn't ask for this, you can ignore this email; your password hasn't changed."),
  };
}

export function passwordChangedEmail(to: string, name: string): MailMessage {
  return {
    to,
    subject: "Your Cel password was changed",
    text: `Hi ${name},\n\nYour Cel password was just changed and every other device was signed out. If this wasn't you, reset your password right away from the sign-in page.`,
    html: layout("Your password was changed", `<p>Hi ${esc(name)}, your Cel password was just changed and every other device was signed out.</p><p>If this wasn't you, reset your password right away from the sign-in page.</p>`),
  };
}

export function projectInviteEmail(opts: { to: string; name: string; inviter: string; project: string; role: string; url: string; setPasswordUrl?: string }): MailMessage {
  const action = opts.setPasswordUrl ? "Set your password to join" : "Open the project";
  const url = opts.setPasswordUrl ?? opts.url;
  return {
    to: opts.to,
    subject: `${opts.inviter} invited you to "${opts.project}" on Cel`,
    text: `Hi ${opts.name},\n\n${opts.inviter} added you to the project "${opts.project}" on Cel as ${opts.role}.\n\n${action}: ${url}${opts.setPasswordUrl ? "\n\nThis link works once and expires in 7 days." : ""}`,
    html: layout(`You're invited to ${opts.project}`,
      `<p>Hi ${esc(opts.name)}, <strong>${esc(opts.inviter)}</strong> added you to <strong>${esc(opts.project)}</strong> on Cel as <strong>${esc(opts.role)}</strong>.</p>${opts.setPasswordUrl ? "<p>Your account is ready; just choose a password. The link works once and expires in 7 days.</p>" : ""}`,
      { label: action, url }),
  };
}

export function commissionRequestEmail(opts: { to: string; artist: string; clientName: string; clientEmail: string; type: string; budget: string; description: string; url: string }): MailMessage {
  const excerpt = opts.description.length > 400 ? `${opts.description.slice(0, 400)}…` : opts.description;
  return {
    to: opts.to,
    subject: `New commission request from ${opts.clientName}`,
    text: `Hi ${opts.artist},\n\n${opts.clientName} <${opts.clientEmail}> sent a commission request.\n\nType: ${opts.type}\nBudget: ${opts.budget}\n\n${excerpt}\n\nOpen your queue: ${opts.url}\n\n(You can turn these emails off in Settings.)`,
    html: layout("New commission request",
      `<p><strong>${esc(opts.clientName)}</strong> (${esc(opts.clientEmail)}) sent you a request.</p>
       <p style="color:#4b5563">${esc(opts.type)} · ${esc(opts.budget)}</p>
       <blockquote style="margin:16px 0;padding:12px 16px;background:#f4f4f5;border-radius:10px;white-space:pre-wrap">${esc(excerpt)}</blockquote>`,
      { label: "Open your queue", url: opts.url },
      "You can turn these emails off in Settings."),
  };
}
