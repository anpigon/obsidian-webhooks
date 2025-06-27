import { App, Notice, Plugin } from "obsidian";
import {
  getAuth,
  Unsubscribe,
} from "firebase/auth";
import { FirebaseApp } from "firebase/app";
import {
  DataSnapshot,
  getDatabase,
  goOffline,
  goOnline,
  onValue,
  ref,
} from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "shared/firebase";
import { WebhookSettingTab } from "./settingTab"; // Import the new class

// Export NewLineType and MyPluginSettings for use in settingTab.ts
export enum NewLineType {
  Windows = 1,
  UnixMac = 2,
}

export interface MyPluginSettings {
  token: string;
  frequency: string;
  triggerOnLoad: boolean;
  error?: string;
  newLineType?: NewLineType;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  token: "",
  frequency: "0", // manual by default
  triggerOnLoad: true,
  newLineType: undefined,
};

export default class ObsidianWebhooksPlugin extends Plugin {
  settings: MyPluginSettings;
  firebase: FirebaseApp;
  // loggedIn: boolean; // This property was not used, consider removing if not needed elsewhere
  authUnsubscribe: Unsubscribe;
  valUnsubscribe: Unsubscribe;

  async onload() {
    // eslint-disable-next-line no-console
    console.log("loading plugin");
    await this.loadSettings();
    this.firebase = app; // Initialize Firebase app
    this.authUnsubscribe = getAuth(this.firebase).onAuthStateChanged((user) => {
      if (this.valUnsubscribe) {
        this.valUnsubscribe();
      }
      if (user) {
        const db = getDatabase(this.firebase);
        const buffer = ref(db, `buffer/${user.uid}`);
        this.valUnsubscribe = onValue(buffer, async (data) => {
          try {
            await goOffline(db);
            await this.onBufferChange(data);
          } finally {
            await goOnline(db);
          }
        });
      }
    });

    this.addSettingTab(new WebhookSettingTab(this.app, this));
  }

  async onBufferChange(data: DataSnapshot) {
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
      // eslint-disable-next-line no-console
      console.error("Error processing webhook events:", err);
    }
  }

  async wipe(value: unknown) {
    const functions = getFunctions(this.firebase);
    const wipeCallable = httpsCallable(functions, "wipe");
    await wipeCallable(value);
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
      // eslint-disable-next-line no-console
      console.error("Path is not in expected format:", pathOrArr);
      new Notice("Error applying event: Path is invalid.");
      return;
    }

    path = path.replace(/\/+$/, "");
    if (!path) {
      // eslint-disable-next-line no-console
      console.error("Path is empty after normalization.");
      new Notice("Error applying event: Path cannot be empty.");
      return;
    }

    const dirPath = this.app.vault.adapter.getParentPath(path);

    if (dirPath && dirPath !== "." && dirPath !== path) {
      const dirExists = await fs.exists(dirPath, false);
      if (!dirExists) {
        try {
          await fs.mkdir(dirPath);
        } catch (e: any) {
           // eslint-disable-next-line no-console
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
            // eslint-disable-next-line no-console
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
       // eslint-disable-next-line no-console
      console.error(`Failed to write to file ${path}:`, e);
      new Notice(`Error: Could not write to file ${path}.`);
    }
  }

  onunload() {
    // eslint-disable-next-line no-console
    console.log("unloading plugin");
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
    if (this.valUnsubscribe) {
      this.valUnsubscribe();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
