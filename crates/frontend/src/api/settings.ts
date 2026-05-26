import { client } from "./client";
import type { SystemSettings } from "./types";

export const settingsApi = {
  getSettings(): Promise<SystemSettings> {
    return client.get<SystemSettings>("/settings");
  },
};
