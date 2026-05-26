export interface CommsMessage {
  topic: string;
  data: unknown;
}

export interface DebugMessageData {
  id: string;
  z: string;
  name: string;
  topic: string;
  msg: string;
  format: string;
  timestamp: string;
}

export interface StatusMessageData {
  id: string;
  status: {
    fill: string;
    shape: string;
    text: string;
  };
}

export interface NotificationData {
  type: "success" | "warning" | "error" | "info";
  message: string;
  timestamp?: string;
}
