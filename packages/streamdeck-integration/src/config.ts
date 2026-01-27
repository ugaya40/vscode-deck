import * as vscode from "vscode";

export interface ProviderConfig {
  enabled?: boolean;
  maxSlots?: number;
  order?: number;
}

export type ProvidersConfig = Record<string, ProviderConfig>;

export interface ConfigManager {
  providersConfig: () => ProvidersConfig;
  onDidChange: vscode.Event<void>;
  dispose: () => void;
}

export function createConfigManager(): ConfigManager {
  const changeEmitter = new vscode.EventEmitter<void>();

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("streamdeck.providers")) {
      changeEmitter.fire();
    }
  });

  function providersConfig(): ProvidersConfig {
    const config = vscode.workspace.getConfiguration("streamdeck");
    return config.get<ProvidersConfig>("providers", {});
  }

  return {
    providersConfig,
    onDidChange: changeEmitter.event,
    dispose: () => {
      configChangeDisposable.dispose();
      changeEmitter.dispose();
    },
  };
}
