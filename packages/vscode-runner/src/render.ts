import type { KeyAction } from "@elgato/streamdeck";
import type { SlotData, TaskResult } from "./types";
import {
  getAllKeyActions,
  getSlotDataBySlotIndex,
  getSlotIndexFromKeyAction,
} from "./slot";

export type OverlayState = TaskResult | undefined;

function getOverlayImage(overlay: TaskResult): string {
  switch (overlay) {
    case "success":
      return "imgs/success.svg";
    case "canceled":
      return "imgs/canceled.svg";
    case "error":
      return "imgs/error.svg";
  }
}

export async function renderButton(
  keyAction: KeyAction,
  slotData: SlotData | undefined,
  overlay?: OverlayState
): Promise<void> {
  await keyAction.setTitle("");

  if (overlay) {
    await keyAction.setImage(getOverlayImage(overlay));
    return;
  }

  if (!slotData) {
    await keyAction.setImage("imgs/transparent.svg");
    return;
  }

  if (slotData.status === "running") {
    await keyAction.setImage("imgs/running.svg");
  } else {
    await keyAction.setImage(slotData.svg);
  }
}

export async function renderAllButtons(): Promise<void> {
  const keyActions = getAllKeyActions();

  for (const keyAction of keyActions) {
    const slotIndex = getSlotIndexFromKeyAction(keyAction);
    if (slotIndex === undefined) continue;
    const slotData = getSlotDataBySlotIndex(slotIndex);
    await renderButton(keyAction, slotData);
  }
}
