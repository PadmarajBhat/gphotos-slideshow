import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  AmbientStatus,
  OFFLINE_STATUS,
  disconnectAmbient,
  fetchAmbientMedia,
  fetchAmbientStatus,
  startAmbientPairing,
} from '../api/ambient';

/** Poll quickly while the user is pairing, slowly once the frame is settled. */
const ACTIVE_POLL_MS = 3000;
const IDLE_POLL_MS = 60 * 1000;

/**
 * The helper keeps the media list fresh within Google's 240-requests-per-day
 * budget, so the browser just mirrors whatever the helper currently holds.
 */
const MEDIA_POLL_MS = 5 * 60 * 1000;

export function useAmbientPhotos() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery<AmbientStatus>({
    queryKey: ['ambientStatus'],
    queryFn: fetchAmbientStatus,
    initialData: OFFLINE_STATUS,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      // Poll quickly through every setup step, including 'unconfigured', so
      // creating .env is reflected without a restart or a manual refresh.
      const isSettingUp =
        phase === 'pairing' || phase === 'awaiting_sources' || phase === 'unconfigured';
      return isSettingUp ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    },
  });

  const status = statusQuery.data ?? OFFLINE_STATUS;
  const isReady = status.phase === 'ready' && status.itemCount > 0;

  const mediaQuery = useQuery({
    queryKey: ['ambientMedia', status.lastRefreshedAt],
    queryFn: fetchAmbientMedia,
    enabled: isReady,
    refetchInterval: MEDIA_POLL_MS,
    staleTime: MEDIA_POLL_MS,
  });

  const refreshStatus = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['ambientStatus'] }),
    [queryClient]
  );

  const connect = useCallback(async () => {
    const next = await startAmbientPairing();
    queryClient.setQueryData(['ambientStatus'], next);
    return next;
  }, [queryClient]);

  const disconnect = useCallback(async () => {
    const next = await disconnectAmbient();
    queryClient.setQueryData(['ambientStatus'], next);
    queryClient.removeQueries({ queryKey: ['ambientMedia'] });
    return next;
  }, [queryClient]);

  return {
    status,
    isHelperAvailable: status.phase !== 'offline',
    isReady,
    items: mediaQuery.data ?? [],
    isLoadingItems: isReady && mediaQuery.isPending,
    itemsError: mediaQuery.error instanceof Error ? mediaQuery.error.message : null,
    connect,
    disconnect,
    refreshStatus,
  };
}
