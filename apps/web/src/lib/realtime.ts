'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Where the Socket.IO server lives. WebSockets can't go through the Next.js rewrite proxy, so the browser connects to the API
 * origin directly. NEXT_PUBLIC_SOCKET_URL wins; in development it defaults to the same host on port 4000. A production build
 * without NEXT_PUBLIC_SOCKET_URL (e.g. Vercel, where the API is serverless and has no socket server) doesn't connect at all —
 * pages fall back to their polling.
 */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV === 'development' ? 'same-host:4000' : '');

/** One shared Socket.IO connection per tab (null when real-time is disabled). Auth rides on the session cookie, shared across ports. */
function connection(): Socket | null {
  if (!SOCKET_URL) return null;
  const url = SOCKET_URL === 'same-host:4000' ? `${window.location.protocol}//${window.location.hostname}:4000` : SOCKET_URL;
  socket ??= io(url, { withCredentials: true, transports: ['polling', 'websocket'], reconnectionDelayMax: 10_000 });
  return socket;
}

/** Subscribes to a live event for the lifetime of the component. Pages still work (via polling/refresh) if the socket can't connect. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = connection();
    if (!s) return;
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    return () => { s.off(event, fn); };
  }, [event]);
}
