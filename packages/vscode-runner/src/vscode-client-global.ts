import type { VSCodeClient } from "./vscode-client";

export let vscodeClient: VSCodeClient | undefined;

export function setVSCodeClient(nextClient: VSCodeClient | undefined): void {
  vscodeClient = nextClient;
}
