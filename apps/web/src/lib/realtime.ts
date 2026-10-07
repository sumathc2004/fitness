'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * One shared Socket.IO connection per tab. WebSockets can't go through the Next.js rewrite proxy, so the browser connects to the API
 * origin directly (NEXT_PUBLIC_SOCKET_URL, default: same host on port 4000). Auth rides on the session cookie, which is shared across ports.
 */
function connection(): Socket {
  socket ??= io(process.env.NEXT_PUBLIC_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:4000`, { withCredentials: true, transports: ['polling', 'websocket'], reconnectionDelayMax: 10_000 });
  return socket;
}

/** Subscribes to a live event for the lifetime of the component. Pages still work (via polling/refresh) if the socket can't connect. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = connection();
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    return () => { s.off(event, fn); };
  }, [event]);
}
