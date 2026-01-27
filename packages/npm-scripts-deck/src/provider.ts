import * as vscode from "vscode";
import type { SlotProvider, ProviderNotifiers, RunResult, CancelResult } from "vscode-streamdeck-integration";
import { createNsDeckRegistry } from "./ns-deck-registry.js";
import { createScriptCache } from "./script-cache.js";
import { createTaskRunner } from "./task-runner.js";

interface CreateProviderParams {
  notifiers: ProviderNotifiers;
  log: (message: string) => void;
}

export async function createNpmScriptsProvider({
  notifiers,
  log,
}: CreateProviderParams): Promise<{ provider: SlotProvider; disposables: vscode.Disposable[] }> {
  const nsDeckRegistry = await createNsDeckRegistry({ log });
  const scriptCache = createScriptCache({ notifiers, log, nsDeckRegistry });
  const taskRunner = createTaskRunner({ notifiers });

  const provider: SlotProvider = {
    id: "npm-scripts",
    isActive: scriptCache.isActive,
    getSlots: () => {
      const runningScriptIds = taskRunner.getRunningScriptIds();
      return scriptCache.getSlots(runningScriptIds);
    },
    run: async (scriptId: string): Promise<RunResult> => {
      const packageJsonUri = scriptCache.getCurrentPackageJson();
      if (!packageJsonUri) {
        return { success: false, message: "No package.json found" };
      }
      return taskRunner.run(scriptId, packageJsonUri);
    },
    cancel: (scriptId: string): Promise<CancelResult> => taskRunner.cancel(scriptId),
  };

  return {
    provider,
    disposables: [...nsDeckRegistry.disposables, ...scriptCache.disposables, ...taskRunner.disposables],
  };
}
