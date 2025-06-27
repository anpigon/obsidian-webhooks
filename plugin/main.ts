import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DataSnapshot } from "firebase/database"; // Only DataSnapshot might be needed directly by the plugin
import { User } from "firebase/auth"; // For type hinting
import { FirebaseService, FirebaseServiceHooks } from "./firebaseService";
import { WebhookSettingTab } from "./settingTab";

// Export NewLineType and MyPluginSettings for use in settingTab.ts
export enum NewLineType {
  Windows = 1,
  UnixMac = 2,
}

export interface MyPluginSettings {
  token: string;
  frequency: string; // Represents scheduling frequency, "0" for manual. Future versions might use cron-like strings or specific keywords.
  triggerOnLoad: boolean;
  error?: string;
  newLineType?: NewLineType; // User's preferred new line character type
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  token: "",
  frequency: "0", // manual by default
  triggerOnLoad: true,
  newLineType: undefined, // Defaults to Obsidian's standard new line handling
};

export default class ObsidianWebhooksPlugin extends Plugin {
  settings: MyPluginSettings;
  private firebaseService: FirebaseService;

  async onload() {
    console.log("loading plugin");
    await this.loadSettings();

    const firebaseHooks: FirebaseServiceHooks = {
      onAuthStateChanged: (user: User | null) => {
        // This logic remains in the plugin as it directly impacts plugin state/UI
        // If the FirebaseService handled buffer listener internally based on auth state,
        // this callback might become simpler or not needed here.
        // For now, we explicitly manage buffer listener from here based on user.
        if (!user) {
            // User logged out or not logged in initially
            // The service should internally clean up the buffer listener if user is null
        }
      },
      onBufferChange: async (data: DataSnapshot) => {
        await this.handleBufferChange(data);
      },
    };

    this.firebaseService = new FirebaseService(firebaseHooks);
    this.firebaseService.initializeAuthListener();

    this.addSettingTab(new WebhookSettingTab(this.app, this));
  }

  // Renamed from onBufferChange to avoid confusion with the hook name
  async handleBufferChange(data: DataSnapshot) {
    if (!data.hasChildren()) {
      return;
    }

    try {
      let last: unknown = undefined;
      let promiseChain = Promise.resolve();
      data.forEach((event) => {
        const val = event.val();
        last = val;
        promiseChain = promiseChain.then(() => this.applyEvent(val));
      });
      await promiseChain;
      if (last !== undefined) { // Ensure 'last' has a value before wiping
        await this.wipe(last);
      }
      new Notice("Notes updated by webhooks");
    } catch (err: any) {
      new Notice(`Error processing webhook events: ${err.toString()}`);
      console.error("Error processing webhook events:", err);
    }
  }

  async wipe(value: unknown) {
    await this.firebaseService.wipeData(value);
  }

  async applyEvent({
    data,
    path: pathOrArr,
  }: {
    data: string;
    path: string | Array<string>;
  }) {
    const fs = this.app.vault.adapter;
    let path: string;
    if (typeof pathOrArr === "string") {
      path = pathOrArr;
    } else if (Array.isArray(pathOrArr) && pathOrArr.length > 0) {
      path = pathOrArr[0];
    } else {
      console.error("Path is not in expected format:", pathOrArr);
      new Notice("Error applying event: Path is invalid.");
      return;
    }

    path = path.replace(/\/+$/, "");
    if (!path) {
      console.error("Path is empty after normalization.");
      new Notice("Error applying event: Path cannot be empty.");
      return;
    }

    const dirPathMatch = path.match(/^(.*)\//);
    const dirPath = dirPathMatch ? dirPathMatch[1] : "";

    if (dirPath && dirPath !== path) {
      const dirExists = await fs.exists(dirPath, false);
      if (!dirExists) {
        try {
          await fs.mkdir(dirPath);
        } catch (e: any) {
          console.error(`Failed to create directory ${dirPath}:`, e);
          new Notice(`Error: Could not create directory ${dirPath}.`);
          return;
        }
      }
    }

    let contentToAppend = data;
    let contentPrefix = "";

    if (this.settings.newLineType === NewLineType.UnixMac) {
      contentPrefix = "\n";
    } else if (this.settings.newLineType === NewLineType.Windows) {
      contentPrefix = "\r\n";
    }

    const fileExists = await fs.exists(path, false);
    let finalContent: string;

    if (fileExists) {
        const pathStat = await fs.stat(path);
        if (pathStat?.type === "folder") {
            new Notice(`Error: Path ${path} exists as a folder. Please use a file path.`);
            console.error(`Path name exists as a folder: ${path}`);
            return;
        }
        const existingContent = await fs.read(path);
        if (existingContent.length > 0 && contentPrefix) {
            finalContent = existingContent + contentPrefix + contentToAppend;
        } else if (existingContent.length > 0 && !contentPrefix) {
            finalContent = existingContent + "\n" + contentToAppend;
        } else {
            finalContent = existingContent + contentToAppend;
        }
    } else {
      let suffix = "";
      if (this.settings.newLineType === NewLineType.UnixMac) {
        suffix = "\n";
      } else if (this.settings.newLineType === NewLineType.Windows) {
        suffix = "\r\n";
      }
      // For new files, only add suffix if a specific newline type is chosen.
      // If 'none' is chosen, the raw data is written.
      // If a newline type IS chosen, the data is written followed by that newline.
      finalContent = contentToAppend + (this.settings.newLineType !== undefined ? suffix : "");
    }

    try {
      await fs.write(path, finalContent);
    } catch (e: any) {
      console.error(`Failed to write to file ${path}:`, e);
      new Notice(`Error: Could not write to file ${path}.`);
    }
  }

  onunload() {
    console.log("unloading plugin");
    if (this.firebaseService) {
      this.firebaseService.cleanupListeners();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
