import { App, PluginSettingTab, Setting } from "obsidian";
import { Auth, getAuth, signInWithCustomToken, signOut, Unsubscribe } from "firebase/auth";
import ObsidianWebhooksPlugin, { MyPluginSettings, NewLineType } from "./main"; // Assuming NewLineType and MyPluginSettings will be exported from main.ts

export class WebhookSettingTab extends PluginSettingTab {
  plugin: ObsidianWebhooksPlugin;
  auth: Auth;
  authObserver: Unsubscribe;

  constructor(oApp: App, plugin: ObsidianWebhooksPlugin) {
    super(oApp, plugin);
    this.plugin = plugin;
    this.auth = getAuth(this.plugin.firebase);
    this.authObserver = this.auth.onAuthStateChanged(() => this.display()); // Simplified display call
  }

  hide(): void {
    if (this.authObserver) { // Check if authObserver is initialized
      this.authObserver();
    }
  }

  display(): void {
    // if (!this) { // This check is generally not needed within a class method
    //   return;
    // }

    let { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for webhooks" });
    containerEl
      .createEl("p", { text: "Generate login tokens at " })
      .createEl("a", {
        text: "Obsidian Webhooks",
        href: "https://obsidian-buffer.web.app",
      });

    if (this.plugin.settings.error) {
      containerEl.createEl("p", {
        text: `Error: ${this.plugin.settings.error}`, // Added "Error:" prefix for clarity
      });
    }

    if (this.auth.currentUser) {
      new Setting(containerEl)
        .setName(`Logged in as ${this.auth.currentUser.email}`)
        .addButton((button) => {
          button
            .setButtonText("Logout")
            .setCta()
            .onClick(async () => { // Removed evt parameter as it's not used
              try {
                await signOut(this.auth);
                this.plugin.settings.error = undefined;
              } catch (err: any) { // Explicitly type err
                this.plugin.settings.error = err.message;
              } finally {
                await this.plugin.saveSettings();
                this.display();
              }
            });
        });
      new Setting(containerEl)
        .setName("New Line")
        .setDesc("Add new lines between incoming notes")
        .addDropdown((dropdown) => {
          dropdown.addOption("none", "No new lines");
          dropdown.addOption("windows", "Windows style newlines (\\r\\n)"); // Added EOL characters for clarity
          dropdown.addOption("unixMac", "Unix/Mac style newlines (\\n)"); // Added EOL characters for clarity

          const { newLineType } = this.plugin.settings;
          if (newLineType === NewLineType.Windows) {
            dropdown.setValue("windows");
          } else if (newLineType === NewLineType.UnixMac) {
            dropdown.setValue("unixMac");
          } else { // Default to "none" if undefined or any other value
            dropdown.setValue("none");
          }

          dropdown.onChange(async (value) => {
            if (value === "none") {
              this.plugin.settings.newLineType = undefined;
            } else if (value === "windows") {
              this.plugin.settings.newLineType = NewLineType.Windows;
            } else if (value === "unixMac") {
              this.plugin.settings.newLineType = NewLineType.UnixMac;
            }
            await this.plugin.saveSettings();
            // No need to call this.display() here as dropdown change doesn't visually affect other settings immediately
            // However, if other parts of the settings depended on this, it would be necessary.
            // For now, let's keep it to avoid re-rendering the entire tab on a simple dropdown change.
            // If a visual feedback is desired, a more targeted update or a full display() call can be made.
          });
        });
      return; // Return early as the rest of the settings are for non-logged-in users
    }

    new Setting(containerEl).setName("Webhook login token").addText((text) =>
      text
        .setPlaceholder("Paste your token")
        .setValue(this.plugin.settings.token)
        .onChange(async (value) => {
          // console.log("Secret: " + value); // Avoid logging secrets in production/final code
          this.plugin.settings.token = value;
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
      .setName("Login")
      .setDesc("Exchanges webhook token for authentication") // Corrected "authenication"
      .addButton((button) => {
        button
          .setButtonText("Login")
          .setCta()
          .onClick(async () => { // Removed evt parameter
            try {
              await signInWithCustomToken(
                this.auth,
                this.plugin.settings.token
              );
              this.plugin.settings.token = ""; // Clear token after successful login
              this.plugin.settings.error = undefined;
            } catch (err: any) { // Explicitly type err
              this.plugin.settings.error = err.message;
            } finally {
              await this.plugin.saveSettings();
              this.display(); // Refresh display to show logged-in state or error
            }
          });
      });
  }
}
