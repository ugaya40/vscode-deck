import type { WebSocket } from "ws";
import type { SlotData, SlotStatus, RunResult, CancelResult, TaskResult, TaskCompleteEvent } from "./provider-types";

export type { SlotData, SlotStatus, RunResult, CancelResult, TaskResult, TaskCompleteEvent };

export interface RegisterMessage {
  type: "register";
  windowId: string;
}

export interface FocusMessage {
  type: "focus";
  windowId: string;
}

export interface BlurMessage {
  type: "blur";
  windowId: string;
}

export interface ChangeMessage {
  type: "change";
  windowId: string;
}

export interface DisconnectMessage {
  type: "disconnect";
  windowId: string;
}

export interface SlotsResponseMessage {
  type: "slotsResponse";
  requestId: string;
  items: SlotData[];
}

export interface RunResponseMessage {
  type: "runResponse";
  requestId: string;
  result: RunResult;
}

export interface CancelResponseMessage {
  type: "cancelResponse";
  requestId: string;
  result: CancelResult;
}

export interface TaskCompleteForwardMessage {
  type: "taskCompleteForward";
  windowId: string;
  slotDataId: string;
  result: TaskResult;
}

export type FollowerToLeaderMessage =
  | RegisterMessage
  | FocusMessage
  | BlurMessage
  | ChangeMessage
  | DisconnectMessage
  | SlotsResponseMessage
  | RunResponseMessage
  | CancelResponseMessage
  | TaskCompleteForwardMessage;

export interface GetSlotsMessage {
  type: "getSlots";
  requestId: string;
}

export interface RunMessage {
  type: "run";
  requestId: string;
  slotDataId: string;
}

export interface CancelMessage {
  type: "cancel";
  requestId: string;
  slotDataId: string;
}

export type LeaderToFollowerMessage = GetSlotsMessage | RunMessage | CancelMessage;

export interface WindowInfo {
  windowId: string;
  ws: WebSocket;
}

export interface RefreshMessage {
  type: "refresh";
}

export interface TaskCompleteMessage {
  type: "taskComplete";
  slotDataId: string;
  result: TaskResult;
}

export interface ActivateMessage {
  type: "activate";
}

export interface DeactivateMessage {
  type: "deactivate";
}

export type StreamDeckMessage = RefreshMessage | TaskCompleteMessage | ActivateMessage | DeactivateMessage;
