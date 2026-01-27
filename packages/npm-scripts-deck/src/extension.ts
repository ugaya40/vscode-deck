import * as vscode from "vscode";
import type { StreamDeckHostAPI } from "vscode-streamdeck-integration";
import { createLogger } from "./logging.js";
import { createNpmScriptsProvider } from "./provider.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = createLogger("NPM Scripts Provider");
  context.subscriptions.push(logger.channel);

  const hostExtension = vscode.extensions.getExtension<StreamDeckHostAPI>("ugaya40.vscode-streamdeck-integration");

  if (!hostExtension) {
    logger.log("[NPM Scripts] Host extension not found");
    return;
  }

  const hostAPI = await hostExtension.activate();
  const registration = await hostAPI.registerProvider((notifiers) =>
    createNpmScriptsProvider({
      notifiers,
      log: logger.log,
    })
  );

  context.subscriptions.push(registration);

  logger.log("[NPM Scripts] Registered");
}

export function deactivate(): void {}
