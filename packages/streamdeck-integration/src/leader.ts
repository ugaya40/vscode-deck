import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import type {
  SlotData,
  RunResult,
  CancelResult,
  WindowInfo,
  FollowerToLeaderMessage,
  LeaderToFollowerMessage,
  StreamDeckMessage,
} from "./types";
import type { ProviderRegistry } from "./provider-registry";
import { createTokenManager, extractBearerToken } from "./token";
import { log } from "./log";

export interface LeaderConfig {
  port: number;
  ownWindowId: string;
  providerRegistry: ProviderRegistry;
}

export interface Leader {
  start: () => Promise<void>;
  stop: () => void;
  notifyFocus: (windowId: string) => Promise<void>;
  notifyBlur: (windowId: string) => Promise<void>;
}

export function createLeader(config: LeaderConfig): Leader {
  const { port, ownWindowId, providerRegistry } = config;

  let httpServer: http.Server | undefined;
  let followerWsServer: WebSocketServer | undefined;
  let streamDeckWsServer: WebSocketServer | undefined;
  const followers = new Map<string, WindowInfo>();
  const streamDeckClients = new Set<WebSocket>();
  let currentWindowId: string | undefined;
  let lastActivateState: boolean | undefined;
  const pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
  const tokenManager = createTokenManager();
  let providerChangeDisposable: { dispose: () => void } | undefined;
  let taskCompleteDisposable: { dispose: () => void } | undefined;

  async function start(): Promise<void> {
    await startHttpServer();
    startWebSocketServer();

    providerChangeDisposable = providerRegistry.onDidChange(async () => {
      if (currentWindowId === ownWindowId) {
        await updateActivateState();
        notifyStreamDeck({ type: "refresh" });
      }
    });

    taskCompleteDisposable = providerRegistry.onTaskComplete((event) => {
      notifyStreamDeck({
        type: "taskComplete",
        slotDataId: `${ownWindowId}:${event.scriptId}`,
        result: event.result,
      });
    });
  }

  function stop(): void {
    if (providerChangeDisposable) {
      providerChangeDisposable.dispose();
      providerChangeDisposable = undefined;
    }
    if (taskCompleteDisposable) {
      taskCompleteDisposable.dispose();
      taskCompleteDisposable = undefined;
    }
    if (followerWsServer) {
      followerWsServer.close();
      followerWsServer = undefined;
    }
    if (streamDeckWsServer) {
      streamDeckWsServer.close();
      streamDeckWsServer = undefined;
    }
    if (httpServer) {
      httpServer.close();
      httpServer = undefined;
    }
    followers.clear();
    streamDeckClients.clear();
    pendingRequests.clear();
    tokenManager.clear();
  }

  async function notifyFocus(windowId: string): Promise<void> {
    log(`[Leader] Focus: ${windowId}`);
    currentWindowId = windowId;
    await updateActivateState();
    notifyStreamDeck({ type: "refresh" });
  }

  async function notifyBlur(windowId: string): Promise<void> {
    log(`[Leader] Blur: ${windowId}`);
    if (currentWindowId === windowId) {
      currentWindowId = undefined;
    }
    await updateActivateState();
  }

  async function handleFollowerDisconnect(windowId: string): Promise<void> {
    log(`[Leader] Follower disconnected: ${windowId}`);
    followers.delete(windowId);
    if (currentWindowId === windowId) {
      currentWindowId = undefined;
      await updateActivateState();
      notifyStreamDeck({ type: "refresh" });
    }
  }

  async function fetchSlotsFromWindow(
    windowId: string,
    onError: () => SlotData[]
  ): Promise<SlotData[]> {
    if (windowId === ownWindowId) {
      return providerRegistry.getAggregatedSlots(ownWindowId);
    }
    const followerInfo = followers.get(windowId);
    if (!followerInfo) {
      return onError();
    }
    try {
      return await requestFromFollower<SlotData[]>(followerInfo.ws, {
        type: "getSlots",
        requestId: generateRequestId(),
      });
    } catch {
      return onError();
    }
  }

  async function getCurrentSlots(): Promise<SlotData[]> {
    if (currentWindowId === undefined) {
      return [];
    }
    return fetchSlotsFromWindow(currentWindowId, () => []);
  }

  async function updateActivateState(): Promise<void> {
    const slots = await getCurrentSlots();
    const hasSlots = slots.length > 0;
    const shouldActivate = currentWindowId !== undefined && hasSlots;

    if (shouldActivate !== lastActivateState) {
      lastActivateState = shouldActivate;
      if (shouldActivate) {
        log(`[Leader] Sending activate (currentWindow: ${currentWindowId}, hasSlots: ${hasSlots})`);
        notifyStreamDeck({ type: "activate" });
      } else {
        log(`[Leader] Sending deactivate (currentWindow: ${currentWindowId}, hasSlots: ${hasSlots})`);
        notifyStreamDeck({ type: "deactivate" });
      }
    }
  }

  function startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      httpServer = http.createServer((req, res) => {
        handleHttpRequest(req, res);
      });

      httpServer.on("error", reject);

      httpServer.listen(port, "127.0.0.1", () => {
        log(`[Leader] HTTP server listening on port ${port}`);
        resolve();
      });
    });
  }

  function startWebSocketServer(): void {
    if (!httpServer) return;

    followerWsServer = new WebSocketServer({ noServer: true });
    streamDeckWsServer = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;

      if (pathname === "/ws/internal") {
        followerWsServer!.handleUpgrade(request, socket, head, (ws) => {
          followerWsServer!.emit("connection", ws, request);
        });
      } else if (pathname === "/ws") {
        streamDeckWsServer!.handleUpgrade(request, socket, head, (ws) => {
          streamDeckWsServer!.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    followerWsServer.on("connection", (ws: WebSocket) => {
      log("[Leader] New follower connection");

      ws.on("message", async (data: Buffer) => {
        try {
          const message = JSON.parse(
            data.toString()
          ) as FollowerToLeaderMessage;
          await handleFollowerMessage(ws, message);
        } catch (err) {
          log(`[Leader] Failed to parse message: ${err}`);
        }
      });

      ws.on("close", async () => {
        for (const [windowId, info] of followers) {
          if (info.ws === ws) {
            await handleFollowerDisconnect(windowId);
            break;
          }
        }
      });
    });

    streamDeckWsServer.on("connection", async (ws: WebSocket) => {
      log("[Leader] New Stream Deck connection");
      streamDeckClients.add(ws);

      const slots = await getCurrentSlots();
      const shouldActivate = currentWindowId !== undefined && slots.length > 0;
      if (shouldActivate) {
        log(`[Leader] Sending initial activate to new client`);
        ws.send(JSON.stringify({ type: "activate" }));
      }

      ws.on("close", () => {
        log("[Leader] Stream Deck disconnected");
        streamDeckClients.delete(ws);
      });
    });

    log("[Leader] WebSocket servers started");
  }

  function notifyStreamDeck(message: StreamDeckMessage): void {
    const data = JSON.stringify(message);
    for (const client of streamDeckClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  async function handleFollowerMessage(
    ws: WebSocket,
    message: FollowerToLeaderMessage
  ): Promise<void> {
    switch (message.type) {
      case "register":
        log(`[Leader] Registered follower: ${message.windowId}`);
        followers.set(message.windowId, {
          windowId: message.windowId,
          ws,
        });
        break;

      case "focus":
        await notifyFocus(message.windowId);
        break;

      case "blur":
        await notifyBlur(message.windowId);
        break;

      case "change":
        if (message.windowId === currentWindowId) {
          log(`[Leader] Change notification from: ${message.windowId}`);
          await updateActivateState();
          notifyStreamDeck({ type: "refresh" });
        }
        break;

      case "disconnect":
        await handleFollowerDisconnect(message.windowId);
        break;

      case "slotsResponse":
      case "runResponse":
      case "cancelResponse": {
        const pending = pendingRequests.get(message.requestId);
        if (pending) {
          pendingRequests.delete(message.requestId);
          if (message.type === "slotsResponse") {
            pending.resolve(message.items);
          } else {
            pending.resolve(message.result);
          }
        }
        break;
      }

      case "taskCompleteForward":
        notifyStreamDeck({
          type: "taskComplete",
          slotDataId: `${message.windowId}:${message.slotDataId}`,
          result: message.result,
        });
        break;
    }
  }

  async function handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    res.setHeader("Content-Type", "application/json");

    try {
      if (url.pathname === "/handshake" && req.method === "GET") {
        handleHandshake(res);
      } else if (url.pathname === "/list" && req.method === "GET") {
        if (!validateRequest(req, res)) return;
        await handleList(res);
      } else if (url.pathname === "/run" && req.method === "POST") {
        if (!validateRequest(req, res)) return;
        await handleRun(req, res);
      } else if (url.pathname === "/cancel" && req.method === "POST") {
        if (!validateRequest(req, res)) return;
        await handleCancel(req, res);
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      log(`[Leader] Error handling request: ${err}`);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  function validateRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): boolean {
    const token = extractBearerToken(req.headers.authorization);
    if (!token || !tokenManager.validate(token)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return false;
    }
    return true;
  }

  function handleHandshake(res: http.ServerResponse): void {
    const token = tokenManager.generate();
    res.end(JSON.stringify({ token }));
  }

  async function handleList(res: http.ServerResponse): Promise<void> {
    const items = await getCurrentSlots();
    res.end(JSON.stringify({ items }));
  }

  async function handleRun(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await readRequestBody(req);
    try {
      const { slotDataId } = JSON.parse(body) as { slotDataId: string };
      const result = await runCommandOnWindow(slotDataId);
      res.end(JSON.stringify(result));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, message: "Invalid request" }));
    }
  }

  async function handleCancel(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await readRequestBody(req);
    try {
      const { slotDataId } = JSON.parse(body) as { slotDataId: string };
      const result = await cancelCommandOnWindow(slotDataId);
      res.end(JSON.stringify(result));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, message: "Invalid request" }));
    }
  }

  function getTargetWindowId(slotDataId: string): string | undefined {
    const firstColonIndex = slotDataId.indexOf(":");
    if (firstColonIndex === -1) return undefined;
    return slotDataId.slice(0, firstColonIndex);
  }

  async function runCommandOnWindow(slotDataId: string): Promise<RunResult> {
    const targetWindowId = getTargetWindowId(slotDataId);
    if (!targetWindowId) {
      return { success: false, message: "Invalid slotDataId format" };
    }

    if (targetWindowId === ownWindowId) {
      return providerRegistry.runCommand(slotDataId);
    }

    const followerInfo = followers.get(targetWindowId);
    if (!followerInfo) {
      return { success: false, message: "Window not found" };
    }

    try {
      return await requestFromFollower<RunResult>(followerInfo.ws, {
        type: "run",
        requestId: generateRequestId(),
        slotDataId,
      });
    } catch (err) {
      log(`[Leader] Failed to run command on follower: ${err}`);
      return { success: false, message: "Failed to execute command" };
    }
  }

  async function cancelCommandOnWindow(slotDataId: string): Promise<CancelResult> {
    const targetWindowId = getTargetWindowId(slotDataId);
    if (!targetWindowId) {
      return { success: false, message: "Invalid slotDataId format" };
    }

    if (targetWindowId === ownWindowId) {
      return providerRegistry.cancelCommand(slotDataId);
    }

    const followerInfo = followers.get(targetWindowId);
    if (!followerInfo) {
      return { success: false, message: "Window not found" };
    }

    try {
      return await requestFromFollower<CancelResult>(followerInfo.ws, {
        type: "cancel",
        requestId: generateRequestId(),
        slotDataId,
      });
    } catch (err) {
      log(`[Leader] Failed to cancel command on follower: ${err}`);
      return { success: false, message: "Failed to cancel command" };
    }
  }

  function requestFromFollower<T>(
    ws: WebSocket,
    message: LeaderToFollowerMessage
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(message.requestId);
        reject(new Error("Request timeout"));
      }, 5000);

      pendingRequests.set(message.requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      ws.send(JSON.stringify(message));
    });
  }

  return {
    start,
    stop,
    notifyFocus,
    notifyBlur,
  };
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
