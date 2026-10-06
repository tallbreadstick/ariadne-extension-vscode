# Ariadne for VS Code

Ariadne is a student-first security assistant for Java projects in VS Code. It scans your code for common vulnerabilities, highlights issues inline, and explains what went wrong in plain language.

## Requirements

| Requirement | Notes |
|---|---|
| [Visual Studio Code](https://code.visualstudio.com/) | **1.107 or newer** |
| A Java workspace | Open a folder that contains `.java` source files |
| GitHub account | Required to sign in and run scans |
| Supported OS | Linux, Windows, or macOS (see **Core** below) |

On first scan, Ariadne downloads the scanner for your computer from the [latest Ariadne release](https://github.com/tallbreadstick/ariadne-binaries/releases). Leave **Auto** enabled in the sidebar unless you need a specific build.

## Install

1. Obtain the packaged `.vsix` file for this release.
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **Extensions: Install from VSIX...** and select the file.
4. Reload VS Code if prompted.

## Quick start

1. Click the **Ariadne** shield icon in the activity bar (left sidebar).
2. Sign in with **GitHub** when prompted.
3. Open a folder that contains Java source files.
4. Wait for the first scan to finish — the status bar and bottom panel update as findings arrive.
5. Click a highlighted line in the editor or open **ARIADNE (ACTIVE VULNERABILITIES)** in the bottom panel to review issues.

## Sidebar (activity bar)

The Ariadne sidebar is organized into sections:

- **Sign in** — Connect your GitHub account. Scanning, custom rules, and AI explanations require an active session.
- **Sessions** — View session-related options and status.
- **Core** — Control editor highlights, whether the bottom panel opens on startup, **Auto** scanner selection, operating system, and scanner binary.
- **Scripting** — Manage `.ariadne` rule files when present in your workspace.

### Core settings

| Option | What it does |
|---|---|
| **Highlights** | Show or hide colored marks on vulnerable code in the editor. Turning highlights off does not stop scanning. |
| **Open panel on startup** | Open the Ariadne bottom panel when the extension activates. |
| **Auto** | Automatically pick the scanner build for this computer (recommended). |
| **Operating system / binary** | Choose a specific platform or build when Auto is off. |

## Bottom panel

Open the **Ariadne** area in the bottom panel bar:

| Panel | Purpose |
|---|---|
| **ARIADNE (ACTIVE VULNERABILITIES)** | Browse current findings, filter by severity, and jump to code |
| **SESSION METRICS** | See counts, trends, and session progress over time |

## In the editor

After a scan completes:

- **Highlights** — Vulnerable lines are marked with a severity-colored background and an end-of-line label.
- **Hover** — Point at highlighted code for a short summary and a link to **Ask Ariadne**.
- **Status bar** — A summary of active issues appears in the VS Code status bar.

Findings appear in the Ariadne panels, not the standard Problems panel.

## Ask Ariadne

**Ask Ariadne** opens an explanation panel for a selected finding. It describes the issue, why it matters, and which security concept to study — it does not provide code fixes or completions.

Ways to open it:

- Click **Ask Ariadne** from a finding in the **Active Vulnerabilities** panel.
- Use the link in the editor hover popup.
- Run **Ariadne: Ask Ariadne** from the Command Palette.

Explanations use Gemini Flash through your GitHub Copilot allowance. Ensure Copilot is available in your VS Code setup.

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for **Ariadne**:

| Command | Description |
|---|---|
| **Ariadne: Analyze** | Run a full analysis on the workspace |
| **Ariadne: Ask Ariadne** | Open the AI explanation panel for a finding |
| **Ariadne: Sign In to GitHub** | Open the sign-in panel |
| **Ariadne: Open Panel** | Focus the Ariadne bottom panel |
| **Ariadne: Settings** | Open Ariadne settings in the sidebar |
| **Ariadne: Terms of Use** | View terms of use |
| **Ariadne: Privacy Policy** | View the privacy policy |

## VS Code settings

You can also adjust behavior under **File → Preferences → Settings** (search for **Ariadne**):

| Setting | Default | Purpose |
|---|---|---|
| `ariadne.executable` | `"ariadne"` | Optional path to a local scanner binary. Leave the default to use the binary selected in the sidebar **Core** section. |
| `ariadne.notifications.level` | `"milestones"` | Popup notification verbosity: `milestones`, `all`, or `quiet`. |
| `ariadne.autoScan.intervalMinutes` | `60` | Minutes between automatic full scans (2–180). |

Most day-to-day options — highlights, scanner selection, sign-in — are in the **Ariadne** sidebar rather than the Settings UI.

## Notifications

Ariadne can show toast notifications when findings change (new issues, fixes, recurrences, and similar milestones). Set **Notifications** to **quiet** in settings if you prefer to check the panels and status bar only.

## Troubleshooting

| Problem | What to try |
|---|---|
| Extension asks you to sign in | Open the Ariadne sidebar and complete GitHub sign-in. |
| No findings after opening a Java project | Run **Ariadne: Analyze** from the Command Palette. Check for a scanner download notification. |
| Scanner or download errors | In the sidebar **Core** section, confirm **Auto** is on or pick the correct OS and binary. |
| Highlights missing | Turn **Highlights** on in the sidebar **Core** section. |
| Stale results after an update | Reload the VS Code window (**Developer: Reload Window**). |
| Ask Ariadne fails | Confirm GitHub sign-in and that Copilot is available in VS Code. |

## License

Proprietary. Users may install and run it during data collection. See [LICENSE](LICENSE).
