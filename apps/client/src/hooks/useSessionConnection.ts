import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

import { getSessionSnapshot } from '../api';
import type { RegisterMessage, RoomSnapshot, SocketStatus } from '../types';

type UseSessionConnectionParams = {
  code: string | null;
  registerPayload?: RegisterMessage;
};

type SessionConnection = {
  state: RoomSnapshot | null;
  status: SocketStatus;
  lastError: string | null;
  sendBuzz: () => void;
};

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL as string | undefined;
const DEV_API_PORT = import.meta.env.VITE_API_PORT as string | undefined;

function normalizeBaseUrl(base: string, wsProtocol: 'ws:' | 'wss:') {
  if (base.startsWith('ws://') || base.startsWith('wss://')) {
    return base.replace(/\/$/, '');
  }

  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base.replace(/^http/, 'ws').replace(/\/$/, '');
  }

  return `${wsProtocol}//${base.replace(/\/$/, '')}`;
}

function getSocketUrl(code: string) {
  const { protocol, hostname, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

  if (WS_BASE_URL) {
    const normalized = normalizeBaseUrl(WS_BASE_URL, wsProtocol);
    return `${normalized}/ws/${code}`;
  }

  if (import.meta.env.DEV) {
    const port = DEV_API_PORT ?? '3000';
    return `${wsProtocol}//${hostname}:${port}/ws/${code}`;
  }

  return `${wsProtocol}//${host}/ws/${code}`;
}

export function useSessionConnection(params: UseSessionConnectionParams): SessionConnection {
  const [status, setStatus] = useState<SocketStatus>('idle');
  const [state, setState] = useState<RoomSnapshot | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const hasReceivedStateRef = useRef(false);

  const registerPayload = params.registerPayload;
  const code = params.code;
  const shouldConnect = Boolean(code && registerPayload);

  const socketUrl = useMemo(() => {
    if (!code || !registerPayload) {
      return null;
    }
    return getSocketUrl(code);
  }, [code, registerPayload]);

  useEffect(() => {
    if (!shouldConnect) {
      setStatus('idle');
      setState(null);
      hasReceivedStateRef.current = false;
    }
  }, [shouldConnect]);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: false,
    shouldReconnect: () => true,
    reconnectAttempts: Infinity,
    reconnectInterval: 1500,
    retryOnError: true,
    onError: () => setLastError('Connection error'),
  }, shouldConnect);

  useEffect(() => {
    if (!shouldConnect) {
      setStatus('idle');
      return;
    }

    switch (readyState) {
      case ReadyState.CONNECTING:
      case ReadyState.UNINSTANTIATED:
        setStatus('connecting');
        break;
      case ReadyState.OPEN:
        setStatus('open');
        setLastError(null);
        break;
      default:
        setStatus('closed');
        break;
    }
  }, [readyState, shouldConnect]);

  useEffect(() => {
    if (!shouldConnect || !code) {
      return;
    }

    hasReceivedStateRef.current = false;
    let cancelled = false;

    getSessionSnapshot(code)
      .then((snapshot) => {
        if (!cancelled && !hasReceivedStateRef.current) {
          setState(snapshot);
        }
      })
      .catch(() => {
        if (!cancelled && !hasReceivedStateRef.current) {
          setLastError('Unable to load latest session state');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, shouldConnect]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN && registerPayload) {
      sendJsonMessage(registerPayload);
    }
  }, [readyState, registerPayload, sendJsonMessage]);

  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }

    try {
      const payload = lastJsonMessage as unknown as { type: string; payload?: RoomSnapshot; message?: string };
      if (payload.type === 'state' && payload.payload) {
        hasReceivedStateRef.current = true;
        setState(payload.payload);
        setLastError(null);
      }

      if (payload.type === 'error') {
        setLastError(payload.message ?? 'Unexpected error');
      }
    } catch (error) {
      console.error('Failed to process websocket payload', error);
    }
  }, [lastJsonMessage]);

  const sendBuzz = useCallback(() => {
    if (readyState !== ReadyState.OPEN) {
      return;
    }

    sendJsonMessage({ type: 'buzz' });
  }, [readyState, sendJsonMessage]);

  return useMemo(
    () => ({
      state,
      status,
      lastError,
      sendBuzz,
    }),
    [lastError, sendBuzz, state, status],
  );
}
