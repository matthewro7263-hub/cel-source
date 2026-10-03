import type { ReactNode } from "react";
import { Link } from "wouter";
import { CelLogo } from "@/components/CelLogo";
import { useAppConfig } from "@/lib/config";

// Plain-language policies that describe what this app actually does (see server/ for the details).
// They are a starting point, not legal advice: the person running this deployment should review them,
// set CONTACT_EMAIL, and adjust anything that differs from how they host it.

const UPDATED = "3 October 2026";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { data: config } = useAppConfig();
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-3xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-display font-extrabold text-xl">
          <CelLogo size={24} /> Cel
        </Link>
        <nav className="flex gap-5 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
          {children}
          <h2>Contact</h2>
          <p>
            {config?.contactEmail ? (
              <>Questions or requests about this page: <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>.</>
            ) : (
              <>Questions or requests about this page: contact whoever runs this Cel workspace.</>
            )}
          </p>
        </article>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy">
      <p>
        Cel is a production tool for animators. This page explains what it stores about you, who else sees it, and how to remove it.
        We don't sell your data, show ads, or use analytics or tracking scripts.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> your name, email address and an avatar colour. Your password is never stored; only a salted, one-way hash (scrypt) of it.</li>
        <li><strong>Your work:</strong> everything you add to a project: scripts, storyboard panels, assets, audio, comments, scenes, notes and snapshots.</li>
        <li><strong>Commissions:</strong> when someone fills in your public commission form, their name, email, request and any reference image are saved to your queue.</li>
        <li><strong>Sign-in on your device:</strong> a sign-in token and a copy of your profile are kept in your browser's local storage so you stay signed in. There are no tracking cookies. Signing out, or changing your password, invalidates the token.</li>
      </ul>

      <h2>Who else can see it</h2>
      <ul>
        <li><strong>Project members</strong> you invite can see that project. Anyone with a project's <em>share link</em> can view what you've chosen to share while sharing is switched on; turn it off in Project Settings to revoke it.</li>
        <li><strong>The service providers that run Cel,</strong> only as needed to operate it:
          <ul>
            <li>The hosting provider and database that store your data.</li>
            <li>Cloud file storage (Cloudflare R2), if the operator has enabled it, for larger uploads.</li>
            <li>An email provider (Resend), if enabled, to send password-reset links, project invitations and commission notifications.</li>
            <li><strong>OpenRouter and the AI model provider you pick,</strong> only if you add your own API key and use an AI feature. The text or image you send to that feature (for example a script passage, or an asset thumbnail when auto-tagging) is forwarded to them. Your key is stored encrypted and is used only for your project's requests.</li>
            <li><strong>Discord,</strong> if a project owner adds a webhook, which then receives that project's activity notifications.</li>
          </ul>
        </li>
      </ul>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>Items you delete go to the project's <strong>Trash</strong> and are permanently removed after 30 days, or immediately if you delete them from Trash.</li>
        <li>Deleting a <strong>project</strong> removes it and everything in it straight away.</li>
        <li>You can <strong>delete your account</strong> in Settings. That permanently removes the projects you own (including ones shared with others), your commissions, uploads and personal records. Comments you left in other people's projects remain but are credited to "Deleted user".</li>
        <li>Copies may persist in the hosting provider's routine backups for a limited time after deletion.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Connections are encrypted in transit, passwords are hashed, API keys are encrypted at rest, password-reset links are single-use and expire after an hour, and sign-in attempts are rate limited.
        No system is perfectly secure; if you find a problem, please tell us using the contact below.
      </p>

      <h2>Children</h2>
      <p>Cel isn't intended for children under 13, and we don't knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If this page changes in a way that matters, we'll update the date above and, for significant changes, tell signed-in users.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use">
      <p>By creating an account or using Cel you agree to these terms. They're short on purpose.</p>

      <h2>Your account</h2>
      <p>
        Keep your password private and your details accurate. You're responsible for activity on your account.
        Tell us if you think it's been compromised; changing your password signs out every other device.
      </p>

      <h2>Your work stays yours</h2>
      <p>
        You own what you upload and create. You give Cel permission to store it, process it (for example generating thumbnails or exports) and show it to the people you choose to share it with, solely to run the service for you.
        You promise you have the right to upload it.
      </p>

      <h2>What you can't do</h2>
      <ul>
        <li>Upload anything illegal, or that infringes someone else's rights.</li>
        <li>Use Cel to harass people, send spam (including through the commission form or invitations), or distribute malware.</li>
        <li>Probe, overload or break the service, or get around its limits or access controls.</li>
        <li>Use someone else's account, or share an AI API key you aren't allowed to use.</li>
      </ul>

      <h2>Commissions and clients</h2>
      <p>
        Cel helps you track commission requests. Agreements, payments and delivery are between you and your client; Cel isn't a party to them and doesn't process payments.
      </p>

      <h2>AI features</h2>
      <p>
        AI features run through your own OpenRouter key. You pay your provider directly, and their terms apply to what you send them.
        AI output can be wrong; check it before relying on it.
      </p>

      <h2>The service</h2>
      <p>
        Cel is provided <strong>as is</strong> while in beta. We work to keep it reliable, but it may change, have downtime, or lose data despite our efforts, so keep your own copies of anything important (you can export projects as a ZIP at any time).
        To the extent the law allows, we aren't liable for indirect or consequential losses.
      </p>

      <h2>Ending things</h2>
      <p>
        You can delete your account whenever you like in Settings. We may suspend or remove accounts that break these terms or put the service or other people at risk.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; if the change is significant we'll tell you. Continuing to use Cel after a change means you accept it.</p>
    </LegalLayout>
  );
}
