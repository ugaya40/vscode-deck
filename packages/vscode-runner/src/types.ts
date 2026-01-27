export interface HandshakeResponse {
  token: string;
}

export type SlotStatus = "idle" | "running";

export type TaskResult = "success" | "error" | "canceled";

export interface SlotData {
  scriptId: string;
  svg: string;
  status: SlotStatus;
}

export interface ListResponse {
  items: SlotData[];
}

export interface RunRequest {
  slotDataId: string;
}

export interface RunResponse {
  success: boolean;
  message?: string;
  taskId?: string;
}

export interface CancelResponse {
  success: boolean;
  message?: string;
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
