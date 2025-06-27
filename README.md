# Obsidian Webhooks Plugin

The Obsidian Webhooks plugin connects your Obsidian vault to the internet of things, allowing you to capture ideas and automate your notes from external services like IFTTT, Zapier, or custom webhooks. Append content to specific notes based on incoming webhook data.

## Installation

### From Obsidian Community Plugins (Recommended)

Once the plugin is approved and released:

1.  Open Obsidian's settings.
2.  Go to **Community plugins**.
3.  Ensure **Restricted mode** is **off**.
4.  Click **Browse** and search for "Webhook Plugin".
5.  Click **Install**, then **Enable**.

### Using BRAT (for beta testing or pre-release versions)

1.  Install the [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2.  Open BRAT's configuration (via commands or settings).
3.  Click **Add Beta plugin**.
4.  Enter the repository path for this plugin: `[Your GitHub Username]/obsidian-webhooks` (Replace `[Your GitHub Username]` with the actual username if different from 'Stephen Solka' or if you are testing a fork).
5.  Enable the plugin in the **Community plugins** tab.

### Manual Installation

1.  Download `main.js`, `manifest.json`, and `styles.css` (if present) from the [latest release](https://github.com/your-repo/obsidian-webhooks/releases) (Replace `your-repo` with the actual repository path).
2.  In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
3.  Create a new folder named `obsidian-webhooks`.
4.  Copy the downloaded files into this new folder.
5.  Reload Obsidian (or disable and re-enable the plugin if it was previously installed).
6.  Enable the plugin in the **Community plugins** tab.

## Configuration

1.  After installing and enabling the plugin, open Obsidian's settings.
2.  Navigate to the **Webhook Plugin** settings tab.
3.  Go to [https://obsidian-buffer.web.app](https://obsidian-buffer.web.app) to sign up for the companion service and generate a login token.
4.  Copy the generated token from the website.
5.  Paste this token into the "Login Token" field in the plugin settings within Obsidian.
6.  (Optional) Configure other settings like "Trigger on Load" or "New Line Type" as needed.

## How to Use

The core idea is to get a webhook URL from the [obsidian-buffer.web.app](https://obsidian-buffer.web.app) service and use it in other applications or automation services to send data to your Obsidian notes.

### Example Use Cases:

*   Add quick thoughts to your notes by talking to your Google Assistant.
*   Capture a note every time you like a song on Spotify.
*   Log an entry when you react to a Slack message with a specific emoji.
*   Integrate with any service that can send a POST request to a webhook.

### Setting up an Example Rule (e.g., Spotify to Obsidian via IFTTT)

1.  Ensure the plugin is configured with your token (see **Configuration** above).
2.  On the [obsidian-buffer.web.app](https://obsidian-buffer.web.app) service website, obtain your unique webhook URL.
3.  Go to IFTTT (or a similar service like Zapier).
4.  Create a new Applet/Zap:
    *   **If This:** Choose your trigger service (e.g., Spotify, "New saved track").
    *   **Then That:** Choose the "Webhooks" action, specifically "Make a web request".
5.  Configure the webhook action:
    *   **URL:** Paste the webhook URL obtained from `obsidian-buffer.web.app`.
    *   **Method:** `POST`
    *   **Content Type:** `text/plain` (or `application/json` if sending structured data; ensure your parsing logic on `obsidian-buffer.web.app` or the plugin handles it). For simple text appends, `text/plain` is fine.
    *   **Body:** Compose the content you want to append to your note. You can use ingredients/variables from the trigger service. For example, to append details of a saved Spotify track:
        ```
        - [[{{ArtistName}}]] [[{{AlbumName}}]] - {{TrackName}}
        ```
        (Note: The exact variable names like `{{ArtistName}}` depend on the service, e.g., IFTTT's Spotify ingredients.)
6.  Save and enable your Applet/Zap. When the trigger event occurs, the data will be sent to your webhook URL, processed by `obsidian-buffer.web.app`, and then relayed to your Obsidian plugin to be appended to the specified note.

## Compatibility

*   Requires Obsidian version **0.9.12** or newer (as per `manifest.json`).
*   This plugin works on both desktop and mobile versions of Obsidian.

## Troubleshooting

*   **No data appearing in notes:**
    *   Verify your token is correctly copied into the plugin settings.
    *   Check the `obsidian-buffer.web.app` service for any error messages or logs (if available).
    *   Ensure the webhook URL is correct in your external service (IFTTT, Zapier, etc.).
    *   Check Obsidian's developer console (Ctrl+Shift+I or Cmd+Option+I) for any errors related to the plugin.
*   **Incorrect formatting:**
    *   Adjust the "New Line Type" setting in the plugin if you experience issues with line breaks.

## License

This plugin is released under the [MIT License](LICENSE).
