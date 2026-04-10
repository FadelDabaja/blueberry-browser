import { app } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface AppSettings {
  provider: string;
  model: string;
  apiKey: string;
  theme: "light" | "dark" | "system";
  integrationProvider: "local" | "notion" | "linear" | "jira";
  integrationApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  model: "",
  apiKey: "",
  theme: "system",
  integrationProvider: "local",
  integrationApiKey: "",
};

export class SettingsManager {
  private settings: AppSettings;
  private filePath: string;

  constructor() {
    this.filePath = join(app.getPath("userData"), "settings.json");
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (existsSync(this.filePath)) {
        const data = readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
        console.warn("Settings file has invalid structure, using defaults");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    this.save();
    return this.getSettings();
  }
}
