import { useQuery } from '@tanstack/react-query';

import type { PlayerSession } from '../utils/playerSessionStorage';
import { loadPlayerSession } from '../utils/playerSessionStorage';

export function usePlayerSession(code: string | null, playerId: string | null) {
  return useQuery<PlayerSession | null>({
    queryKey: ['player-session', code, playerId],
    queryFn: async () => {
      if (!code || !playerId) {
        return null;
      }

      return loadPlayerSession(code, playerId) ?? null;
    },
    enabled: Boolean(code && playerId),
    initialData: () => {
      if (!code || !playerId) {
        return null;
      }

      return loadPlayerSession(code, playerId) ?? null;
    },
    staleTime: Infinity,
  });
}
