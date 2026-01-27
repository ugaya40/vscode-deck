import * as vscode from "vscode";

export async function findNearestPackageJson(fileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const workspaceRootPaths = workspaceFolders.map((folder) => folder.uri.fsPath);

  if (fileUri.fsPath.endsWith("package.json")) {
    return fileUri;
  }

  let currentDir = vscode.Uri.joinPath(fileUri, "..");

  while (true) {
    const packageJsonUri = vscode.Uri.joinPath(currentDir, "package.json");
    try {
      await vscode.workspace.fs.stat(packageJsonUri);
      return packageJsonUri;
    } catch {
      // not found
    }

    const parentDir = vscode.Uri.joinPath(currentDir, "..");
    if (parentDir.fsPath === currentDir.fsPath) {
      break;
    }

    const isInWorkspace = workspaceRootPaths.some(
      (root) => parentDir.fsPath.startsWith(root) || parentDir.fsPath === root
    );
    if (!isInWorkspace) {
      break;
    }

    currentDir = parentDir;
  }

  return undefined;
}

export function getWorkspaceRootPackageJson(): vscode.Uri | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  return vscode.Uri.joinPath(workspaceFolders[0].uri, "package.json");
}
