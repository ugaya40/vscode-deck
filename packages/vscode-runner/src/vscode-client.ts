import streamDeck from "@elgato/streamdeck";
import { WebSocket } from "ws";
import type {
  HandshakeResponse,
  ListResponse,
  SlotData,
  RunResponse,
  CancelResponse,
  StreamDeckMessage,
  TaskResult,
} from "./types";

export interface VSCodeClientConfig {
  port: number;
  onRefresh: () => void;
  onTaskComplete: (id: string, result: TaskResult) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDisconnect: () => void;
}

export interface VSCodeClient {
  connect(): Promise<SlotData[]>;
  disconnect(): void;
  fetchSlots(): Promise<SlotData[]>;
  runCommand(id: string): Promise<RunResponse>;
  cancelCommand(id: string): Promise<CancelResponse>;
}

export function createVSCodeClient(config: VSCodeClientConfig): VSCodeClient {
  const { port, onRefresh, onTaskComplete, onActivate, onDeactivate, onDisconnect } = config;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let token: string | undefined;
  let ws: WebSocket | undefined;

  async function handshake(): Promise<string> {
    const res = await fetch(`${baseUrl}/handshake`);
    if (!res.ok) {
      throw new Error(`Handshake failed: ${res.status}`);
    }
    const data = (await res.json()) as HandshakeResponse;
    return data.token;
  }

  async function fetchSlots(): Promise<SlotData[]> {
    if (!token) {
      throw new Error("Not connected");
    }
    const res = await fetch(`${baseUrl}/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`List failed: ${res.status}`);
    }
    const data = (await res.json()) as ListResponse;
    return data.items;
  }

  async function runCommand(slotDataId: string): Promise<RunResponse> {
    if (!token) {
      throw new Error("Not connected");
    }
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slotDataId }),
    });
    if (!res.ok) {
      throw new Error(`Run failed: ${res.status}`);
    }
    return (await res.json()) as RunResponse;
  }

  async function cancelCommand(slotDataId: string): Promise<CancelResponse> {
    if (!token) {
      throw new Error("Not connected");
    }
    const res = await fetch(`${baseUrl}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slotDataId }),
    });
    if (!res.ok) {
      throw new Error(`Cancel failed: ${res.status}`);
    }
    return (await res.json()) as CancelResponse;
  }

  function connectWebSocket(): void {
    streamDeck.logger.info(`[VSCodeClient] Connecting WebSocket to ${wsUrl}`);
    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      streamDeck.logger.info(`[VSCodeClient] WebSocket connected`);
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as StreamDeckMessage;
        streamDeck.logger.info(`[VSCodeClient] Received message: ${message.type}`);
        if (message.type === "refresh") {
          onRefresh();
        } else if (message.type === "taskComplete") {
          onTaskComplete(message.slotDataId, message.result);
        } else if (message.type === "activate") {
          onActivate();
        } else if (message.type === "deactivate") {
          onDeactivate();
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("close", () => {
      streamDeck.logger.info(`[VSCodeClient] WebSocket closed`);
      ws = undefined;
      onDisconnect();
    });

    ws.on("error", (err) => {
      streamDeck.logger.error(`[VSCodeClient] WebSocket error: ${err}`);
    });
  }

  async function connect(): Promise<SlotData[]> {
    token = await handshake();
    const slots = await fetchSlots();
    connectWebSocket();
    return slots;
  }

  function disconnect(): void {
    if (ws) {
      ws.close();
      ws = undefined;
    }
    token = undefined;
  }

  return {
    connect,
    disconnect,
    fetchSlots: fetchSlots,
    runCommand,
    cancelCommand,
  };
}
