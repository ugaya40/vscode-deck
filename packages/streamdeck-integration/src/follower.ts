import { WebSocket } from "ws";
import type {
  LeaderToFollowerMessage,
  FollowerToLeaderMessage,
} from "./types";
import type { ProviderRegistry } from "./provider-registry";
import { log } from "./log";

export interface FollowerConfig {
  port: number;
  windowId: string;
  onDisconnect: () => void;
  providerRegistry: ProviderRegistry;
}

export interface Follower {
  connect: () => Promise<void>;
  stop: () => void;
  notifyFocus: () => void;
  notifyBlur: () => void;
  notifyChange: () => void;
}

export function createFollower(config: FollowerConfig): Follower {
  const { port, windowId, onDisconnect, providerRegistry } = config;

  let ws: WebSocket | undefined;
  let intentionalClose = false;
  let hasConnected = false;
  let providerChangeDisposable: { dispose: () => void } | undefined;
  let taskCompleteDisposable: { dispose: () => void } | undefined;

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${port}/ws/internal`;
      ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        ws?.close();
        reject(new Error("Connection timeout"));
      }, 100);

      ws.on("open", () => {
        clearTimeout(timeout);
        hasConnected = true;
        log(`[Follower] Connected to leader`);
        sendMessage({ type: "register", windowId });

        providerChangeDisposable = providerRegistry.onDidChange(() => {
          notifyChange();
        });

        taskCompleteDisposable = providerRegistry.onTaskComplete((event) => {
          sendMessage({
            type: "taskCompleteForward",
            windowId,
            slotDataId: event.scriptId,
            result: event.result,
          });
        });

        resolve();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(
            data.toString()
          ) as LeaderToFollowerMessage;
          handleMessage(message);
        } catch (err) {
          log(`[Follower] Failed to parse message: ${err}`);
        }
      });

      ws.on("close", () => {
        if (providerChangeDisposable) {
          providerChangeDisposable.dispose();
          providerChangeDisposable = undefined;
        }
        if (taskCompleteDisposable) {
          taskCompleteDisposable.dispose();
          taskCompleteDisposable = undefined;
        }
        if (hasConnected && !intentionalClose) {
          log("[Follower] Disconnected from leader");
          onDisconnect();
        }
      });
    });
  }

  function stop(): void {
    intentionalClose = true;
    if (providerChangeDisposable) {
      providerChangeDisposable.dispose();
      providerChangeDisposable = undefined;
    }
    if (taskCompleteDisposable) {
      taskCompleteDisposable.dispose();
      taskCompleteDisposable = undefined;
    }
    if (ws) {
      sendMessage({ type: "disconnect", windowId });
      ws.close();
      ws = undefined;
    }
    hasConnected = false;
    intentionalClose = false;
  }

  function notifyFocus(): void {
    sendMessage({ type: "focus", windowId });
  }

  function notifyBlur(): void {
    sendMessage({ type: "blur", windowId });
  }

  function notifyChange(): void {
    sendMessage({ type: "change", windowId });
  }

  async function handleMessage(message: LeaderToFollowerMessage): Promise<void> {
    switch (message.type) {
      case "getSlots":
        sendMessage({
          type: "slotsResponse",
          requestId: message.requestId,
          items: providerRegistry.getAggregatedSlots(windowId),
        });
        break;

      case "run":
        try {
          const result = await providerRegistry.runCommand(message.slotDataId);
          sendMessage({
            type: "runResponse",
            requestId: message.requestId,
            result,
          });
        } catch (err) {
          sendMessage({
            type: "runResponse",
            requestId: message.requestId,
            result: {
              success: false,
              message: err instanceof Error ? err.message : "Unknown error",
            },
          });
        }
        break;

      case "cancel":
        try {
          const result = await providerRegistry.cancelCommand(message.slotDataId);
          sendMessage({
            type: "cancelResponse",
            requestId: message.requestId,
            result,
          });
        } catch (err) {
          sendMessage({
            type: "cancelResponse",
            requestId: message.requestId,
            result: {
              success: false,
              message: err instanceof Error ? err.message : "Unknown error",
            },
          });
        }
        break;
    }
  }

  function sendMessage(message: FollowerToLeaderMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  return {
    connect,
    stop,
    notifyFocus,
    notifyBlur,
    notifyChange,
  };
}
