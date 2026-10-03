import { useQuery } from "@tanstack/react-query";

/** Public switches from GET /api/config (readable before sign-in). */
export interface AppConfig {
  /** Demo credentials, present only when the server seeded the demo account. */
  demo: { email: string; password: string } | null;
  /** Whether the server can send email (password reset, invites). */
  emailEnabled: boolean;
  /** Shown on the Privacy and Terms pages (CONTACT_EMAIL). */
  contactEmail: string | null;
}

export function useAppConfig() {
  return useQuery<AppConfig>({ queryKey: ["/api/config"], staleTime: Infinity, retry: 1 });
}
