# Custom Provider Development Guide

This guide explains how to develop custom Providers for Stream Deck Integration.

## Overview

A Provider is a VSCode extension that supplies button information to be displayed on Stream Deck. Stream Deck Integration acts as the host, aggregating button information from multiple Providers and sending it to Stream Deck.
Providers developed following this guide automatically support multiple VSCode instances through Stream Deck Integration's functionality.
Developers can write their VSCode extension as if targeting a single VSCode instance.

What you need to implement for a Provider is basically:

- Registration with Stream Deck Integration
- Implementation of `getSlots` function (corresponds to `/list`)
- Implementation of `run` function (corresponds to `/run`)
  - If your Provider has long-running tasks:
    - Implementation of `cancel` function (corresponds to `/cancel`)
    - Calling `notifyTaskComplete` to notify the Leader of task completion
- Calling `notifyChange` when the buttons to display on Stream Deck change for the current VSCode instance (notified to Stream Deck via Leader)

That's it.

While not required for implementation, if you want to understand the architecture including `/list`, `/run`, etc., see the [Architecture section in README](README.md#architecture).

## Prerequisites

- Node.js / npm
- Basic knowledge of VSCode extension development
- TypeScript (recommended)

## Setup

### package.json

```json
{
  "name": "your-provider",
  "displayName": "Your Provider",
  "publisher": "your-publisher",
  "engines": {
    "vscode": "^1.96.0"
  },
  "extensionDependencies": [
    "ugaya40.vscode-streamdeck-integration"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./dist/extension.js",
  "dependencies": {
    "vscode-streamdeck-integration": "^1.0.0"
  }
}
```

**Important points:**
- By specifying `ugaya40.vscode-streamdeck-integration` in `extensionDependencies`, Stream Deck Integration will be automatically installed
- To use type definitions, run:

```bash
npm install vscode-streamdeck-integration
```

## Implementation Flow

### extension.ts

```typescript
import * as vscode from "vscode";
import type { StreamDeckHostAPI } from "vscode-streamdeck-integration";
import { createYourProvider } from "./provider.js";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Get Stream Deck Integration extension
  const hostExtension = vscode.extensions.getExtension<StreamDeckHostAPI>(
    "ugaya40.vscode-streamdeck-integration"
  );

  if (!hostExtension) {
    console.error("Stream Deck Integration not found");
    return;
  }

  // Get the host API
  const hostAPI = await hostExtension.activate();

  // Register Provider
  const registration = await hostAPI.registerProvider((notifiers) =>
    createYourProvider({ notifiers })
  );

  // Add Disposable for unregistration
  context.subscriptions.push(registration);
}

export function deactivate(): void {}
```

### provider.ts

```typescript
import * as vscode from "vscode";
import {
  createSlotSvg,
  type SlotProvider,
  type ProviderNotifiers,
  type SlotData,
  type RunResult,
  type CancelResult,
} from "vscode-streamdeck-integration";

interface CreateProviderParams {
  notifiers: ProviderNotifiers;
}

export async function createYourProvider({
  notifiers,
}: CreateProviderParams): Promise<{
  provider: SlotProvider;
  disposables: vscode.Disposable[];
}> {
  const disposables: vscode.Disposable[] = [];

  // Initialization can be done here (async OK)

  const provider: SlotProvider = {
    // Provider ID (used in settings.json)
    // Important: Do not include colons (:)
    id: "your-provider",

    // Whether this Provider is active
    isActive(): boolean {
      // Example: Only active under certain conditions
      return true;
    },

    // Return the list of buttons to display on Stream Deck
    getSlots(): SlotData[] {
      return [
        {
          scriptId: "button-1",
          svg: createSlotSvg({
            lines: ["Button 1"],
            textColor: "#FFFFFF",
          }),
          status: "idle",
        },
        {
          scriptId: "button-2",
          svg: createSlotSvg({
            lines: ["Button 2"],
            textColor: "#00FF00",
          }),
          status: "idle",
        },
      ];
    },

    // Handler when a button is pressed
    async run(scriptId: string): Promise<RunResult> {
      // Short-running task example
      try {
        // Execute processing based on scriptId
        await vscode.commands.executeCommand("your.command");
        return { success: true };
      } catch (err) {
        return { success: false, message: String(err) };
      }
    },

    // Cancel handler (optional)
    async cancel(scriptId: string): Promise<CancelResult> {
      return { success: true };
    },
  };

  return { provider, disposables };
}
```

## SlotData

Structure representing button information.

```typescript
interface SlotData {
  scriptId: string;   // Unique button ID **Do not include colons (`:`)**
  svg: string;        // Button image (SVG data URI)
  status: SlotStatus; // "idle" | "running"
}
```

- `scriptId`: Identifier passed to `run()` and `cancel()`. **Do not include colons (`:`)**
- `svg`: Generate with `createSlotSvg()` or specify custom SVG
- `status`: Set to `"running"` to show the button in running state

## createSlotSvg

Helper function to easily generate button images.

```typescript
interface CreateSlotSvgOptions {
  iconPaths?: string;    // SVG path elements
  lines: string[];       // Display text (up to 3 lines)
  color?: string;        // Background color
  textColor?: string;    // Text color (default: #FFFFFF)
  iconGlow?: boolean;    // Icon glow effect
  textAlign?: "center" | "left";  // Text alignment
}
```

### Examples

```typescript
// Text only
createSlotSvg({
  lines: ["build"],
  textColor: "#FFFFFF",
});

// With icon
import { Play } from "lucide-static";
createSlotSvg({
  iconPaths: Play,
  lines: ["dev"],
  textColor: "#22C55E",
});

// With background color
createSlotSvg({
  lines: ["test"],
  color: "#3B82F6",
  textColor: "#FFFFFF",
});
```

## Notifications

### notifyChange

Call when the button list changes. Stream Deck button display will be updated.

```typescript
// Example: Watch file changes and update buttons
const watcher = vscode.workspace.createFileSystemWatcher("**/package.json");
watcher.onDidChange(() => {
  // Rebuild button data (update content returned by getSlots())
  refreshButtonData();
  notifiers.notifyChange();
});
disposables.push(watcher);
```

* `refreshButtonData()` is a function implemented by each Provider.

### notifyTaskComplete

Call when a long-running task completes.

```typescript
interface TaskCompleteEvent {
  scriptId: string;    // Button ID of completed task (SlotData.scriptId)
  result: TaskResult;  // "success" | "error" | "canceled"
}

notifiers.notifyTaskComplete({
  scriptId: "button-1",
  result: "success",
});
```

## Task Types

### Short-running Tasks

Tasks that complete immediately. Return results via `run()` return value. For tasks that definitely finish quickly, such as executing shortcuts.

```typescript
async run(scriptId: string): Promise<RunResult> {
  await vscode.commands.executeCommand("editor.action.formatDocument");
  return { success: true };
}
```

### Long-running Tasks

Tasks that take time to execute. `run()` returns a taskId immediately, and calls `notifyTaskComplete()` on completion. Build tasks and similar should be long-running tasks.

```typescript
const runningTasks = new Map<string, { scriptId: string; execution: vscode.TaskExecution }>();
const canceledScriptIds = new Set<string>();

// taskId generation example
function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async run(scriptId: string): Promise<RunResult> {
  const taskId = generateTaskId();

  // Get vscode.Task corresponding to scriptId (implement per Provider)
  const task = createVscodeTask(scriptId);
  const execution = await vscode.tasks.executeTask(task);
  runningTasks.set(taskId, { scriptId, execution });

  // Return immediately (enters running state)
  return { success: true, taskId };
}

async cancel(scriptId: string): Promise<CancelResult> {
  for (const [taskId, task] of runningTasks) {
    if (task.scriptId === scriptId) {
      canceledScriptIds.add(scriptId);
      task.execution.terminate();
      return { success: true };
    }
  }
  return { success: false, message: "Task not found" };
}

// On task completion (in a separate event handler)
vscode.tasks.onDidEndTaskProcess((event) => {
  // Logic to get scriptId from runningTasks is omitted
  const wasCanceled = canceledScriptIds.has(scriptId);
  canceledScriptIds.delete(scriptId);

  const result = wasCanceled ? "canceled" : event.exitCode === 0 ? "success" : "error";
  notifiers.notifyTaskComplete({
    scriptId,
    result,
  });
});
```

* `createVscodeTask()`, `runningTasks`, `canceledScriptIds` are implemented and managed by each Provider. See [Npm Scripts Deck](https://github.com/ugaya40/vscode-deck/tree/main/packages/npm-scripts-deck) for implementation examples.

**Important**: Returning a `taskId` makes it a long-running task; not returning one makes it a short-running task.

## isActive

`isActive()` returns whether this Provider should display buttons.

```typescript
isActive(): boolean {
  // Example: Only active when a specific file is open
  const editor = vscode.window.activeTextEditor;
  return editor?.document.fileName.endsWith(".json") ?? false;
}
```

- `true`: Buttons are displayed
- `false`: This Provider's buttons are not displayed

Evaluated on VSCode window focus changes and when `notifyChange()` is called.

## Complete Example

For a real implementation example, see the [NPM Scripts Deck](https://github.com/ugaya40/vscode-deck/tree/main/packages/npm-scripts-deck) source code.

## Type Definitions

All types can be imported from the `vscode-streamdeck-integration` package:

```typescript
import type {
  SlotData,
  SlotStatus,
  SlotProvider,
  SlotProviderFactory,
  SlotProviderFactoryResult,
  ProviderNotifiers,
  CreateSlotSvgOptions,
  RunResult,
  CancelResult,
  TaskResult,
  TaskCompleteEvent,
  StreamDeckHostAPI,
} from "vscode-streamdeck-integration";
```
