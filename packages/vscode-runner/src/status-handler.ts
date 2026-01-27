import {
  getSlotIndexBySlotDataId,
  getKeyActionsBySlotIndex,
  getSlotDataBySlotIndex,
} from "./slot";
import type { TaskResult } from "./types";
import { renderButton } from "./render";

const RESULT_DISPLAY_DURATION = 2000;

let refreshCallback: (() => Promise<void>) | undefined;

export function setRefreshCallback(callback: () => Promise<void>): void {
  refreshCallback = callback;
}

export function triggerRefresh(): void {
  if (refreshCallback) {
    void refreshCallback();
  }
}

export function handleTaskComplete(slotDataId: string, result: TaskResult): void {
  const slotIndex = getSlotIndexBySlotDataId(slotDataId);
  if (slotIndex === undefined) return;

  const keyActions = getKeyActionsBySlotIndex(slotIndex);
  const slotData = getSlotDataBySlotIndex(slotIndex);

  for (const keyAction of keyActions) {
    void renderButton(keyAction, slotData, result);
  }

  setTimeout(() => {
    if (refreshCallback) {
      void refreshCallback();
    }
  }, RESULT_DISPLAY_DURATION);
}
