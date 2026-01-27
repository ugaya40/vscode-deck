import * as vscode from "vscode";
import { createLeader, type Leader } from "./leader";
import { createFollower, type Follower } from "./follower";
import { createProviderRegistry, type ProviderRegistry } from "./provider-registry";
import type { StreamDeckHostAPI } from "./provider-types";
import { createConfigManager, type ConfigManager } from "./config";
import { initLog, log } from "./log";

export type { SlotData, SlotStatus, CreateSlotSvgOptions, SlotProvider, SlotProviderFactory, SlotProviderFactoryResult, ProviderNotifiers, RunResult, CancelResult, TaskResult, TaskCompleteEvent, StreamDeckHostAPI } from "./provider-types";

let selfAsLeader: Leader | undefined;
let selfAsFollower: Follower | undefined;
let windowId: string;
let port: number;
let providerRegistry: ProviderRegistry;
let configManager: ConfigManager;

export async function activate(
  context: vscode.ExtensionContext
): Promise<StreamDeckHostAPI> {
  initLog();

  const config = vscode.workspace.getConfiguration("streamdeck");
  port = config.get<number>("port", 52375);
  windowId = generateWindowId();
  configManager = createConfigManager();
  providerRegistry = createProviderRegistry(configManager);

  log(`[Extension] Starting with windowId: ${windowId}`);

  await tryBecomeLeaderOrFollower();
  await notifyCurrentFocusState();

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(async () => {
      await notifyCurrentFocusState();
    })
  );

  return {
    registerProvider: (factory) => providerRegistry.register(factory),
  };
}

export function deactivate(): void {
  cleanup();
}

function cleanup(): void {
  if (selfAsLeader) {
    selfAsLeader.stop();
    selfAsLeader = undefined;
  }
  if (selfAsFollower) {
    selfAsFollower.stop();
    selfAsFollower = undefined;
  }
  if (configManager) {
    configManager.dispose();
  }
}

async function notifyCurrentFocusState(): Promise<void> {
  if (vscode.window.state.focused) {
    if (selfAsFollower) {
      selfAsFollower.notifyFocus();
    } else if (selfAsLeader) {
      await selfAsLeader.notifyFocus(windowId);
    }
  } else {
    if (selfAsFollower) {
      selfAsFollower.notifyBlur();
    } else if (selfAsLeader) {
      await selfAsLeader.notifyBlur(windowId);
    }
  }
}

async function tryBecomeLeaderOrFollower(): Promise<void> {
  try {
    await tryConnectAsFollower();
  } catch {
    await becomeLeader();
  }
}

async function becomeLeader(showErrorOnFailure: boolean = true): Promise<void> {
  log(`[Extension] Becoming leader`);
  const newLeader = createLeader({
    port,
    ownWindowId: windowId,
    providerRegistry,
  });

  try {
    await newLeader.start();
    selfAsLeader = newLeader;
    log(`[Extension] Leader started successfully`);
  } catch (err) {
    log(`[Extension] Failed to start leader: ${err}`);
    if (showErrorOnFailure) {
      vscode.window.showErrorMessage(
        `Stream Deck Integration: Failed to start server on port ${port}. Please change the port in settings (streamdeck.port) and reload the window.`
      );
    }
    throw err;
  }
}

async function attemptReElection(): Promise<void> {
  const delay = Math.random() * 500;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const retryDelay = 200;

  while (true) {
    try {
      await becomeLeader(false);
      await notifyCurrentFocusState();
      return;
    } catch {
      log(`[Extension] Failed to become leader, retrying...`);
    }

    try {
      await tryConnectAsFollower();
      await notifyCurrentFocusState();
      return;
    } catch {
      log(`[Extension] Failed to connect as follower, retrying...`);
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
}

async function tryConnectAsFollower(): Promise<void> {
  const onDisconnect = async () => {
    selfAsFollower = undefined;
    log(`[Extension] Leader disconnected, attempting re-election`);
    try {
      await attemptReElection();
    } catch (err) {
      log(`[Extension] Re-election failed: ${err}`);
    }
  };

  const newFollower = createFollower({
    port,
    windowId,
    onDisconnect,
    providerRegistry,
  });

  await newFollower.connect();
  selfAsFollower = newFollower;
  log(`[Extension] Connected as follower`);
}

function generateWindowId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
