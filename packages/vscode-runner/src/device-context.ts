import type { KeyAction } from "@elgato/streamdeck";

export type DeviceContext = {
  deviceId: string;
  columns: number;
  getSlotIndexFromCoordinates: (row: number, column: number) => number;
  getSlotIndexFromKeyAction: (keyAction: KeyAction) => number | undefined;
  registerKeyAction: (keyAction: KeyAction) => void;
  unregisterKeyAction: (keyAction: KeyAction) => void;
  getKeyActionBySlotIndex: (slotIndex: number) => KeyAction | undefined;
  getKeyActions: () => KeyAction[];
  keyActionCount: number;
  updateFromKeyAction: (keyAction: KeyAction) => void;
};

export function createDeviceContextFromKeyAction(
  keyAction: KeyAction
): DeviceContext {
  const deviceId = keyAction.device.id;
  let columns = keyAction.device.size.columns;
  const keyActionsBySlotIndex = new Map<number, KeyAction>();

  const getSlotIndexFromCoordinates = (row: number, column: number): number => {
    return row * columns + column;
  };

  const getSlotIndexFromKeyAction = (
    keyAction: KeyAction
  ): number | undefined => {
    if (keyAction.device.id !== deviceId) return undefined;
    const coordinates = keyAction.coordinates;
    if (!coordinates) return undefined;
    return getSlotIndexFromCoordinates(coordinates.row, coordinates.column);
  };

  const registerKeyAction = (keyAction: KeyAction): void => {
    if (keyAction.device.id !== deviceId) return;
    const slotIndex = getSlotIndexFromKeyAction(keyAction);
    if (slotIndex === undefined) return;
    if (!keyActionsBySlotIndex.has(slotIndex)) {
      deviceContext.keyActionCount += 1;
    }
    keyActionsBySlotIndex.set(slotIndex, keyAction);
  };

  const unregisterKeyAction = (keyAction: KeyAction): void => {
    if (keyAction.device.id !== deviceId) return;
    const slotIndex = getSlotIndexFromKeyAction(keyAction);
    if (slotIndex === undefined) return;
    if (keyActionsBySlotIndex.delete(slotIndex)) {
      deviceContext.keyActionCount -= 1;
    }
  };

  const getKeyActionBySlotIndex = (
    slotIndex: number
  ): KeyAction | undefined => {
    return keyActionsBySlotIndex.get(slotIndex);
  };

  const getKeyActions = (): KeyAction[] => {
    return Array.from(keyActionsBySlotIndex.values());
  };

  const updateFromKeyAction = (keyAction: KeyAction): void => {
    if (keyAction.device.id !== deviceId) return;
    columns = keyAction.device.size.columns;
    deviceContext.columns = columns;
  };

  const deviceContext: DeviceContext = {
    deviceId,
    columns,
    getSlotIndexFromCoordinates,
    getSlotIndexFromKeyAction,
    registerKeyAction,
    unregisterKeyAction,
    getKeyActionBySlotIndex,
    getKeyActions,
    keyActionCount: 0,
    updateFromKeyAction,
  };

  return deviceContext;
}
