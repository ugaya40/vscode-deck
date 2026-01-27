import * as vscode from "vscode";
import { createSlotSvg, type ProviderNotifiers, type SlotData } from "vscode-streamdeck-integration";
import type { NsDeckRegistry, NsDeckEntry, NsDeckStyleRule } from "./ns-deck-registry.js";
import { findNearestPackageJson, getWorkspaceRootPackageJson } from "./package-json-locator.js";
import { getIconPathsForScript, getIconPathsByName, getColorForScript } from "./script-style.js";

function matchesStyleRule(scriptName: string, rule: NsDeckStyleRule): boolean {
  const pattern = rule.match;
  if (pattern.startsWith("/") && pattern.endsWith("/")) {
    const regexBody = pattern.slice(1, -1);
    try {
      return new RegExp(regexBody).test(scriptName);
    } catch {
      return false;
    }
  }
  return scriptName === pattern;
}

function findTextColorFromStyles(scriptName: string, styles: NsDeckStyleRule[] | undefined): string | undefined {
  if (!styles) return undefined;
  for (const rule of styles) {
    if (matchesStyleRule(scriptName, rule) && rule.textColor) {
      return rule.textColor;
    }
  }
  return undefined;
}

function findIconPathsFromStyles(scriptName: string, styles: NsDeckStyleRule[] | undefined): string | undefined {
  if (!styles) return undefined;
  for (const rule of styles) {
    if (matchesStyleRule(scriptName, rule) && rule.icon) {
      return getIconPathsByName(rule.icon);
    }
  }
  return undefined;
}

function splitByLength(text: string, maxLength: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    lines.push(text.slice(i, i + maxLength));
  }
  return lines;
}

type ScriptSlot = Omit<SlotData, "status">;

interface CreateScriptCacheParams {
  notifiers: ProviderNotifiers;
  log: (message: string) => void;
  nsDeckRegistry: NsDeckRegistry;
}

interface ScriptCache {
  isActive(): boolean;
  getSlots(runningScriptIds: Set<string>): SlotData[];
  getCurrentPackageJson(): vscode.Uri | undefined;
  disposables: vscode.Disposable[];
}

export function createScriptCache({
  notifiers,
  log,
  nsDeckRegistry,
}: CreateScriptCacheParams): ScriptCache {
  let cachedScripts: ScriptSlot[] = [];
  let currentPackageJsonUri: vscode.Uri | undefined;
  let currentEntry: NsDeckEntry | undefined;
  const disposables: vscode.Disposable[] = [];

  async function loadScripts(): Promise<void> {
    if (!currentPackageJsonUri) {
      cachedScripts = [];
      notifiers.notifyChange();
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(currentPackageJsonUri);
      const packageJson = JSON.parse(content.toString()) as { scripts?: Record<string, string> };
      const scripts = packageJson.scripts ?? {};

      const allowedScripts = currentEntry?.config.scripts;
      const scriptNames = allowedScripts ?? Object.keys(scripts);

      const styles = currentEntry?.config.styles;
      const separator = currentEntry?.config.separator ?? false;

      cachedScripts = scriptNames
        .filter((scriptName) => scriptName in scripts)
        .map((scriptName) => {
          let lines: string[];
          let textAlign: "center" | "left";

          if (separator === false) {
            lines = splitByLength(scriptName, 7);
            textAlign = lines.length === 1 ? "center" : "left";
          } else {
            const parts = scriptName.split(separator);
            lines = parts.map((part, index) => (index < parts.length - 1 ? `${part}${separator}` : part));
            textAlign = "center";
          }

          const textColor = findTextColorFromStyles(scriptName, styles) ?? getColorForScript(scriptName);
          const iconPaths = findIconPathsFromStyles(scriptName, styles) ?? getIconPathsForScript(scriptName);
          return {
            scriptId: scriptName,
            svg: createSlotSvg({
              iconPaths,
              lines,
              textColor,
              textAlign,
              iconGlow: true,
            }),
          };
        });

      log(`[NPM Scripts] Loaded ${cachedScripts.length} scripts from ${currentPackageJsonUri.fsPath}`);
      notifiers.notifyChange();
    } catch (err) {
      log(`[NPM Scripts] Failed to load scripts: ${err}`);
      cachedScripts = [];
      notifiers.notifyChange();
    }
  }

  async function updateFromActiveEditorWithRegistry(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return false;
    }

    const fileUri = activeEditor.document.uri;
    if (fileUri.scheme !== "file") {
      return false;
    }

    const entry = nsDeckRegistry.findByActiveFile(fileUri);
    if (!entry) {
      currentPackageJsonUri = undefined;
      currentEntry = undefined;
      cachedScripts = [];
      notifiers.notifyChange();
      return false;
    }

    if (currentEntry && entry.configUri.toString() === currentEntry.configUri.toString()) {
      return true;
    }

    currentEntry = entry;
    currentPackageJsonUri = entry.packageJsonUri;
    log(`[NPM Scripts] Switched to ${entry.packageJsonUri.fsPath} (via ns-deck.json)`);
    await loadScripts();
    return true;
  }

  async function updateFromActiveEditorLegacy(): Promise<boolean> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return false;
    }

    const fileUri = activeEditor.document.uri;
    if (fileUri.scheme !== "file") {
      return false;
    }

    const packageJsonUri = await findNearestPackageJson(fileUri);
    if (!packageJsonUri) {
      return false;
    }

    if (currentPackageJsonUri && packageJsonUri.toString() === currentPackageJsonUri.toString()) {
      return true;
    }

    currentEntry = undefined;
    currentPackageJsonUri = packageJsonUri;
    log(`[NPM Scripts] Switched to ${packageJsonUri.fsPath}`);
    await loadScripts();
    return true;
  }

  async function updateFromActiveEditor(): Promise<boolean> {
    if (nsDeckRegistry.hasAnyConfig()) {
      return updateFromActiveEditorWithRegistry();
    }
    return updateFromActiveEditorLegacy();
  }

  function loadWorkspaceRootPackageJson(): void {
    const workspaceRoot = getWorkspaceRootPackageJson();
    if (!workspaceRoot) {
      cachedScripts = [];
      notifiers.notifyChange();
      return;
    }

    currentEntry = undefined;
    currentPackageJsonUri = workspaceRoot;
    log(`[NPM Scripts] Using workspace root: ${workspaceRoot.fsPath}`);
    loadScripts();
  }

  function handlePackageJsonChange(uri: vscode.Uri): void {
    if (currentPackageJsonUri && uri.toString() === currentPackageJsonUri.toString()) {
      loadScripts();
    }
  }

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/package.json");
  disposables.push(fileWatcher);
  disposables.push(fileWatcher.onDidChange(handlePackageJsonChange));
  disposables.push(fileWatcher.onDidCreate(handlePackageJsonChange));
  disposables.push(fileWatcher.onDidDelete(handlePackageJsonChange));

  disposables.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateFromActiveEditor();
    })
  );

  disposables.push(
    nsDeckRegistry.onDidChange(() => {
      log(`[NPM Scripts] NsDeckRegistry changed, re-evaluating...`);
      currentEntry = undefined;
      updateFromActiveEditor().then((found) => {
        if (!found && !nsDeckRegistry.hasAnyConfig()) {
          loadWorkspaceRootPackageJson();
        }
      });
    })
  );

  updateFromActiveEditor().then((found) => {
    if (!found && !nsDeckRegistry.hasAnyConfig()) {
      loadWorkspaceRootPackageJson();
    }
  });

  function isActive(): boolean {
    return cachedScripts.length > 0;
  }

  function getSlots(runningScriptIds: Set<string>): SlotData[] {
    return cachedScripts.map((slot) => ({
      ...slot,
      status: runningScriptIds.has(slot.scriptId) ? "running" : "idle",
    }));
  }

  function getCurrentPackageJson(): vscode.Uri | undefined {
    return currentPackageJsonUri;
  }

  return {
    isActive,
    getSlots,
    getCurrentPackageJson,
    disposables,
  };
}
