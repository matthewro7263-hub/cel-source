import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

/**
 * Polls the participant count for a single challenge prompt every 30 seconds.
 * Only runs for speedrun prompts (enabled = isSpeedrun && window still open).
 */
export function useSpeedrunParticipants(
  promptId: number,
  enabled: boolean,
): { count: number; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/challenges/prompts", String(promptId), "participants"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled,
    refetchInterval: 30_000, // 30 seconds
    staleTime: 25_000,
  });

  return { count: data?.count ?? 0, isLoading };
}
