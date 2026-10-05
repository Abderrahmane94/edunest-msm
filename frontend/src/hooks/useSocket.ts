import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

/** Chat data that may have missed live updates while the socket was down. */
const LIVE_QUERY_KEYS = [['messages'], ['conversations'], ['staff-messages'], ['staff-conversations']];

/**
 * Hook to connect to the Socket.io server and listen for events.
 * Authenticates using the stored JWT access token.
 *
 * Phones drop the connection often (app in the background, network change)
 * and the socket is recreated when the access token is refreshed, so:
 * - listeners and joined rooms are remembered here and restored on every
 *   (re)connection — the server forgets rooms when a socket disconnects;
 * - it keeps trying to reconnect, and reconnects when the app comes back to
 *   the foreground;
 * - after a reconnection, chat data is refreshed to catch what was missed.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(new Map<string, Set<(...args: unknown[]) => void>>());
  const roomsRef = useRef(new Set<string>());
  const [isConnected, setIsConnected] = useState(false);
  // Exposed in state (not just a ref) so consumers re-run their listener
  // effects when the socket instance is replaced on reconnect.
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // Bumped whenever the access token changes (login / refresh) so the socket
  // reconnects with the fresh credential instead of holding a stale one.
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    const bump = () => setAuthEpoch((n) => n + 1);
    window.addEventListener('auth:token-refreshed', bump);
    window.addEventListener('auth:login', bump);
    return () => {
      window.removeEventListener('auth:token-refreshed', bump);
      window.removeEventListener('auth:login', bump);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    // Listeners registered before this socket existed (e.g. by a page, before
    // a token refresh replaced the socket).
    handlersRef.current.forEach((handlers, event) => handlers.forEach((h) => socket.on(event, h)));

    let connectedBefore = false;
    socket.on('connect', () => {
      setIsConnected(true);
      // Rooms (open conversations) are lost when a socket disconnects.
      roomsRef.current.forEach((room) => socket.emit('join', room));
      if (connectedBefore) {
        LIVE_QUERY_KEYS.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
      }
      connectedBefore = true;
    });

    // Back in the foreground: reconnect now rather than at the next retry.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // If the server rejects the token (e.g. it expired), refresh it via a
    // lightweight API call; the api-client emits `auth:token-refreshed` on
    // success, which re-runs this effect with the new token.
    socket.on('connect_error', (err) => {
      if (err.message.includes('token')) {
        // Token likely expired — refresh it. On success the api-client emits
        // `auth:token-refreshed`, which re-runs this effect with a fresh token.
        apiClient.refreshSession().catch(() => undefined);
      }
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setIsConnected(false);
    };
  }, [authEpoch]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = handlersRef.current.get(event) ?? new Set();
    handlers.add(handler);
    handlersRef.current.set(event, handlers);
    socketRef.current?.on(event, handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const joinRoom = useCallback((room: string) => {
    roomsRef.current.add(room);
    socketRef.current?.emit('join', room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    roomsRef.current.delete(room);
    socketRef.current?.emit('leave', room);
  }, []);

  return { socket: socketInstance, isConnected, on, emit, joinRoom, leaveRoom };
}
