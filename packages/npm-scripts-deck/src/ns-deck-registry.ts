import * as vscode from "vscode";

export interface NsDeckStyleRule {
  match: string;
  textColor?: string;
  icon?: string;
}

export interface NsDeckConfig {
  scripts?: string[];
  styles?: NsDeckStyleRule[];
  separator?: string | false;
}

export interface NsDeckEntry {
  configUri: vscode.Uri;
  packageJsonUri: vscode.Uri;
  config: NsDeckConfig;
}

export interface NsDeckRegistry {
  entries(): NsDeckEntry[];
  hasAnyConfig(): boolean;
  findByActiveFile(fileUri: vscode.Uri): NsDeckEntry | undefined;
  onDidChange: vscode.Event<void>;
  disposables: vscode.Disposable[];
}

interface CreateNsDeckRegistryParams {
  log: (message: string) => void;
}

export async function createNsDeckRegistry({ log }: CreateNsDeckRegistryParams): Promise<NsDeckRegistry> {
  const disposables: vscode.Disposable[] = [];
  let registryEntries: NsDeckEntry[] = [];

  const onDidChangeEmitter = new vscode.EventEmitter<void>();
  disposables.push(onDidChangeEmitter);

  async function parseNsDeckConfig(uri: vscode.Uri): Promise<NsDeckConfig> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(content.toString()) as NsDeckConfig;
    } catch {
      return {};
    }
  }

  async function buildRegistry(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      registryEntries = [];
      onDidChangeEmitter.fire();
      return;
    }

    const nsDeckFiles = await vscode.workspace.findFiles("**/ns-deck.json", "**/node_modules/**");
    const entries: NsDeckEntry[] = [];

    for (const configUri of nsDeckFiles) {
      const config = await parseNsDeckConfig(configUri);
      const dirUri = vscode.Uri.joinPath(configUri, "..");
      const packageJsonUri = vscode.Uri.joinPath(dirUri, "package.json");

      try {
        await vscode.workspace.fs.stat(packageJsonUri);
        entries.push({ configUri, packageJsonUri, config });
        log(`[NsDeckRegistry] Found: ${configUri.fsPath}`);
      } catch {
        log(`[NsDeckRegistry] Skipped (no package.json): ${configUri.fsPath}`);
      }
    }

    registryEntries = entries;
    log(`[NsDeckRegistry] Registry built: ${entries.length} entries`);
    onDidChangeEmitter.fire();
  }

  function findByActiveFile(fileUri: vscode.Uri): NsDeckEntry | undefined {
    if (registryEntries.length === 0) {
      return undefined;
    }

    const filePath = fileUri.fsPath;
    let bestMatch: NsDeckEntry | undefined;
    let bestMatchLength = -1;

    for (const entry of registryEntries) {
      const dirPath = vscode.Uri.joinPath(entry.configUri, "..").fsPath;
      if (filePath.startsWith(dirPath) && dirPath.length > bestMatchLength) {
        bestMatch = entry;
        bestMatchLength = dirPath.length;
      }
    }

    return bestMatch;
  }

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/ns-deck.json");
  disposables.push(fileWatcher);
  disposables.push(fileWatcher.onDidChange(() => buildRegistry()));
  disposables.push(fileWatcher.onDidCreate(() => buildRegistry()));
  disposables.push(fileWatcher.onDidDelete(() => buildRegistry()));

  await buildRegistry();

  return {
    entries: () => registryEntries,
    hasAnyConfig: () => registryEntries.length > 0,
    findByActiveFile,
    onDidChange: onDidChangeEmitter.event,
    disposables,
  };
}
