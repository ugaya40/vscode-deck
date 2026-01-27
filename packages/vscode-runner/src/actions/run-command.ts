import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import {
  registerKeyAction,
  unregisterKeyAction,
  getSlotDataBySlotIndex,
  getSlotIndexFromKeyAction,
} from "../slot";
import { vscodeClient } from "../vscode-client-global";
import { handleTaskComplete, triggerRefresh } from "../status-handler";
import { renderButton } from "../render";

@action({ UUID: "com.ugaya40.vscode-runner.run-command" })
export class RunCommandAction extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const keyAction = ev.action as KeyAction;
    registerKeyAction(keyAction);

    const slotIndex = getSlotIndexFromKeyAction(keyAction);
    if (slotIndex === undefined) return;
    const slotData = getSlotDataBySlotIndex(slotIndex);
    await renderButton(keyAction, slotData);
  }

  override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
    const keyAction = ev.action as KeyAction;
    unregisterKeyAction(keyAction);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const keyAction = ev.action as KeyAction;
    const slotIndex = getSlotIndexFromKeyAction(keyAction);
    if (slotIndex === undefined) return;
    const slotData = getSlotDataBySlotIndex(slotIndex);
    if (!slotData) return;
    if (!vscodeClient) return;

    if (slotData.status === "running") {
      try {
        await vscodeClient.cancelCommand(slotData.scriptId);
        triggerRefresh();
      } catch {
        handleTaskComplete(slotData.scriptId, "error");
      }
    } else {
      try {
        const result = await vscodeClient.runCommand(slotData.scriptId);
        if (result.taskId) {
          triggerRefresh();
        } else {
          handleTaskComplete(slotData.scriptId, result.success ? "success" : "error");
        }
      } catch {
        handleTaskComplete(slotData.scriptId, "error");
      }
    }
  }
}
