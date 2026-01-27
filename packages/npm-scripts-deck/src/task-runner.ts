import * as vscode from "vscode";
import type { RunResult, CancelResult, TaskResult, ProviderNotifiers } from "vscode-streamdeck-integration";

interface RunningTask {
  scriptId: string;
  execution: vscode.TaskExecution;
}

interface CreateTaskRunnerParams {
  notifiers: ProviderNotifiers;
}

interface TaskRunner {
  run(scriptId: string, packageJsonUri: vscode.Uri): Promise<RunResult>;
  cancel(scriptId: string): Promise<CancelResult>;
  getRunningScriptIds(): Set<string>;
  disposables: vscode.Disposable[];
}

function generateTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTaskRunner({ notifiers }: CreateTaskRunnerParams): TaskRunner {
  const runningTasks = new Map<string, RunningTask>();
  const canceledTaskIds = new Set<string>();
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.tasks.onDidEndTaskProcess((event) => {
      const taskExecution = event.execution;
      const taskId = taskExecution.task.definition.taskId;

      if (typeof taskId !== "string") return;

      const runningTask = runningTasks.get(taskId);
      if (!runningTask) return;

      runningTasks.delete(taskId);

      const wasCanceled = canceledTaskIds.has(taskId);
      canceledTaskIds.delete(taskId);

      const result: TaskResult = wasCanceled ? "canceled" : event.exitCode === 0 ? "success" : "error";
      notifiers.notifyTaskComplete({ scriptId: runningTask.scriptId, result });
    })
  );

  function getRunningScriptIds(): Set<string> {
    const ids = new Set<string>();
    for (const task of runningTasks.values()) {
      ids.add(task.scriptId);
    }
    return ids;
  }

  async function run(scriptId: string, packageJsonUri: vscode.Uri): Promise<RunResult> {
    const packageDir = vscode.Uri.joinPath(packageJsonUri, "..");
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(packageJsonUri);
    if (!workspaceFolder) {
      return { success: false, message: "No workspace folder" };
    }

    const taskId = generateTaskId();

    const taskDefinition: vscode.TaskDefinition = {
      type: "npm",
      script: scriptId,
      taskId,
    };

    const task = new vscode.Task(
      taskDefinition,
      workspaceFolder,
      scriptId,
      "npm",
      new vscode.ShellExecution(`npm run ${scriptId}`, { cwd: packageDir.fsPath })
    );

    try {
      const execution = await vscode.tasks.executeTask(task);
      runningTasks.set(taskId, { scriptId, execution });
      return { success: true, taskId };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to execute task",
      };
    }
  }

  async function cancel(scriptId: string): Promise<CancelResult> {
    let cancelled = false;
    for (const [taskId, task] of runningTasks) {
      if (task.scriptId === scriptId) {
        canceledTaskIds.add(taskId);
        task.execution.terminate();
        cancelled = true;
      }
    }
    if (cancelled) {
      return { success: true };
    }
    return { success: false, message: "Failed" };
  }

  return {
    run,
    cancel,
    getRunningScriptIds,
    disposables,
  };
}
