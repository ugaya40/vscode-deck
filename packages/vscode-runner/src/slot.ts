import type { KeyAction } from "@elgato/streamdeck";
import { createDeviceContextFromKeyAction, type DeviceContext } from "./device-context";
import type { SlotData, SlotStatus } from "./types";

export type SlotEntry = {
  slotIndex: number;
  data?: SlotData;
  setData: (data: SlotData) => void;
  clearData: () => void;
};

function createSlotEntry(slotIndex: number): SlotEntry {
  const setData = (nextData: SlotData): void => {
    slotEntry.data = nextData;
  };
  const clearData = (): void => {
    slotEntry.data = undefined;
  };

  const slotEntry: SlotEntry = {
    slotIndex,
    setData,
    clearData,
  };

  return slotEntry;
}

let slotCount = 0;
const slotEntryBySlotIndex = new Map<number, SlotEntry>();
const slotIndexBySlotDataId = new Map<string, number>();
const deviceContextByDeviceId = new Map<string, DeviceContext>();

function getOrCreateSlotEntry(slotIndex: number): SlotEntry {
  const existing = slotEntryBySlotIndex.get(slotIndex);
  if (existing) return existing;
  const slotEntry = createSlotEntry(slotIndex);
  slotEntryBySlotIndex.set(slotIndex, slotEntry);
  return slotEntry;
}

function getOrCreateDeviceContext(keyAction: KeyAction): DeviceContext {
  const deviceId = keyAction.device.id;
  const existing = deviceContextByDeviceId.get(deviceId);
  if (existing) {
    existing.updateFromKeyAction(keyAction);
    return existing;
  }
  const deviceContext = createDeviceContextFromKeyAction(keyAction);
  deviceContextByDeviceId.set(deviceId, deviceContext);
  return deviceContext;
}

export function setSlotDataArray(items: SlotData[]): void {
  slotCount = items.length;
  slotIndexBySlotDataId.clear();

  for (let slotIndex = 0; slotIndex < items.length; slotIndex++) {
    const item = items[slotIndex];
    slotIndexBySlotDataId.set(item.scriptId, slotIndex);

    const slotEntry = getOrCreateSlotEntry(slotIndex);
    slotEntry.setData(item);
  }

  for (const slotIndex of slotEntryBySlotIndex.keys()) {
    if (slotIndex >= items.length) {
      slotEntryBySlotIndex.delete(slotIndex);
    }
  }
}

export function getSlotDataArray(): SlotData[] {
  const items: SlotData[] = [];
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    const slotEntry = slotEntryBySlotIndex.get(slotIndex);
    if (!slotEntry) continue;
    const data = slotEntry.data;
    if (!data) continue;
    items[slotIndex] = data;
  }
  return items;
}

export function getSlotDataBySlotIndex(slotIndex: number): SlotData | undefined {
  const slotEntry = slotEntryBySlotIndex.get(slotIndex);
  if (!slotEntry) return undefined;
  return slotEntry.data;
}

export function getSlotIndexBySlotDataId(slotDataId: string): number | undefined {
  return slotIndexBySlotDataId.get(slotDataId);
}

export function getSlotStatusBySlotDataId(slotDataId: string): SlotStatus | undefined {
  const slotIndex = slotIndexBySlotDataId.get(slotDataId);
  if (slotIndex === undefined) return undefined;
  const slotEntry = slotEntryBySlotIndex.get(slotIndex);
  if (!slotEntry) return undefined;
  return slotEntry.data?.status;
}

export function getSlotIndexFromKeyAction(
  keyAction: KeyAction
): number | undefined {
  const deviceContext = getOrCreateDeviceContext(keyAction);
  return deviceContext.getSlotIndexFromKeyAction(keyAction);
}

export function registerKeyAction(keyAction: KeyAction): void {
  const deviceContext = getOrCreateDeviceContext(keyAction);
  deviceContext.registerKeyAction(keyAction);
}

export function unregisterKeyAction(keyAction: KeyAction): void {
  const deviceId = keyAction.device.id;
  const deviceContext = deviceContextByDeviceId.get(deviceId);
  if (!deviceContext) return;
  deviceContext.unregisterKeyAction(keyAction);
  if (deviceContext.keyActionCount === 0) {
    deviceContextByDeviceId.delete(deviceId);
  }
}

export function getKeyActionsBySlotIndex(slotIndex: number): KeyAction[] {
  const keyActions: KeyAction[] = [];
  for (const deviceContext of deviceContextByDeviceId.values()) {
    const keyAction = deviceContext.getKeyActionBySlotIndex(slotIndex);
    if (keyAction) keyActions.push(keyAction);
  }
  return keyActions;
}

export function getAllKeyActions(): KeyAction[] {
  const keyActions: KeyAction[] = [];
  for (const deviceContext of deviceContextByDeviceId.values()) {
    keyActions.push(...deviceContext.getKeyActions());
  }
  return keyActions;
}
