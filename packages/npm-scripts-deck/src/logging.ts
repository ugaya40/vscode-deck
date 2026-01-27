import * as vscode from "vscode";

export function createLogger(name: string) {
  const channel = vscode.window.createOutputChannel(name);
  return {
    log(message: string): void {
      const timestamp = new Date().toISOString().slice(11, 23);
      channel.appendLine(`[${timestamp}] ${message}`);
    },
    dispose(): void {
      channel.dispose();
    },
    channel,
  };
}
