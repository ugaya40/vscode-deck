import * as vscode from "vscode";

let outputChannel: vscode.OutputChannel | undefined;

export function initLog(): void {
  outputChannel = vscode.window.createOutputChannel("Stream Deck Integration");
}

export function log(message: string): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  const formatted = `[${timestamp}] ${message}`;
  outputChannel?.appendLine(formatted);
}
