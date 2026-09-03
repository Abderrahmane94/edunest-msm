import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

/**
 * Hook to connect to the Socket.io server and listen for events.
 * Authenticates using the stored JWT access token.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

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
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
      setIsConnected(false);
    };
  }, [authEpoch]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const joinRoom = useCallback((room: string) => {
    socketRef.current?.emit('join', room);
  }, []);

  const leaveRoom = useCallback((room: string) => {
    socketRef.current?.emit('leave', room);
  }, []);

  return { socket: socketInstance, isConnected, on, emit, joinRoom, leaveRoom };
}
