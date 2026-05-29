"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { LiveUpdate } from "@/types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useSessionWebSocket(sessionId: string | null) {
  const [update, setUpdate] = useState<LiveUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send keep-alive ping every 20 seconds
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 20000);
    };

    ws.onmessage = (e) => {
      try {
        const data: LiveUpdate = JSON.parse(e.data);
        setUpdate(data);
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [connect]);

  return { update, connected };
}
