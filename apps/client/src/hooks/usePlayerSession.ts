import { useQuery } from '@tanstack/react-query';

import type { PlayerSession } from '../utils/playerSessionStorage';
import { loadPlayerSession } from '../utils/playerSessionStorage';

export function usePlayerSession(code: string | null) {
  return useQuery<PlayerSession | null>({
    queryKey: ['player-session', code],
    queryFn: async () => {
      if (!code) {
        return null;
      }

      return loadPlayerSession(code) ?? null;
    },
    enabled: Boolean(code),
    initialData: () => {
      if (!code) {
        return null;
      }

      return loadPlayerSession(code) ?? null;
    },
    staleTime: Infinity,
  });
}
