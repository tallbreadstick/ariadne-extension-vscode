# ariadne-extension-vscode — Developer Guide

VS Code extension for **Ariadne** — inline security diagnostics, vulnerability panels, session metrics, and an optional “Ask Ariadne” feedback panel powered by GitHub Copilot.

The scanner binary is downloaded from the [latest Ariadne release](https://github.com/tallbreadstick/ariadne-binaries/releases) the first time a scan runs. **Auto** in the sidebar Core section picks the build for this computer. You can choose a specific build there.

End-user installation and usage instructions live in [README.md](README.md).

## Install (development)

Supported hosts are the builds published on that release (Linux, Windows, and macOS).

For the data-collection release, install the packaged `.vsix` with **Extensions: Install from VSIX...**. Leave Core set to **Auto** unless you need a different build.

## Prerequisites

| Requirement | Version / notes |
|---|---|
| [Node.js](https://nodejs.org/) | LTS or **22.x** (matches `@types/node` in `package.json`) |
| npm | Bundled with Node.js |
| [Visual Studio Code](https://code.visualstudio.com/) | **1.107+** |
| OS | A published Ariadne scanner build for this computer (downloaded on first scan) |

## Install dependencies

Open a terminal in **`ariadne-extension-vscode`** (this folder):

```powershell
cd path\to\ariadne\ariadne-extension-vscode
npm install
```

This installs TypeScript, esbuild, ESLint, and other dev dependencies listed in `package.json`.

## Compile the extension

```powershell
npm run compile
```

This runs, in order:

1. `npm run check-types` — TypeScript type-check (`tsc --noEmit`)
2. `npm run lint` — ESLint on `src/`
3. `node esbuild.js` — bundles `src/extension.ts` to `dist/extension.js`

You must compile (or run watch mode) before launching the extension. VS Code loads `./dist/extension.js` as the extension entry point.

### Watch mode (optional, while developing)

Recompiles automatically when you save files:

```powershell
npm run watch
```

This runs esbuild and TypeScript in parallel. The default **Run Extension** launch config uses the watch task as its pre-launch build.

## Run and debug in VS Code

1. Open the **`ariadne-extension-vscode`** folder in VS Code (File → Open Folder).
2. Ensure dependencies are installed and the project has been compiled at least once (`npm install`, `npm run compile`).
3. Confirm `ariadne` is available:

   ```powershell
   ariadne --help
   ```

4. Press **F5** or go to **Run and Debug** → select **Run Extension** → click the green play button.

VS Code opens a second window titled **Extension Development Host**. That window loads this extension from your workspace.

5. In the Extension Development Host, open a folder containing **Java** source files (File → Open Folder). The extension activates on Java files and starts `ariadne session` in the background.

### Launch configuration

The repo includes `.vscode/launch.json`:

- **Configuration:** `Run Extension`
- **Type:** `extensionHost`
- **Pre-launch task:** default build task (`watch` — runs esbuild + TypeScript watchers)

If F5 fails with a missing build, run `npm run compile` once manually, then try again.

### Recommended VS Code extensions

See `.vscode/extensions.json` for suggested extensions (ESLint, esbuild problem matchers, etc.). VS Code may prompt you to install them when you open the folder.

## Extension behavior (reference)

See [README.md](README.md) for the full end-user guide. Quick reference:

### Commands (Command Palette: `Ctrl+Shift+P`)

| Command | Title | Description |
|---|---|---|
| `ariadne-extension-vscode.analyze` | **Ariadne: Analyze** | Run analysis on the workspace |
| `ariadne-extension-vscode.openFeedbackPanel` | **Ariadne: Ask Ariadne** | Open AI explanation panel for a finding |
| `ariadne-extension-vscode.helloWorld` | Hello World | Development stub |

### Panels

Open the **Ariadne** panel area in the bottom panel bar:

- **ARIADNE (ACTIVE VULNERABILITIES)** — current findings
- **SESSION METRICS** — counts and session stats

A colored highlight and a hover appear on vulnerable code after analysis. The Core highlights switch hides those editor marks without stopping the scan.

### Settings

Open **File → Preferences → Settings** and search for **Ariadne**, or edit `settings.json`:

Account, Sessions, Core, and Scripting live in the Ariadne side panel. Core is where highlights, opening the bottom panel on startup, Auto, the operating system, and the scanner binary are chosen. Turning highlights off hides editor marks and leaves scanning running.

| Setting | Default | Purpose |
|---|---|---|
| `ariadne.executable` | `"ariadne"` | Optional path to a local scanner binary. Leave the default to use the binary selected in the sidebar Core section. |
| `ariadne.notifications.level` | `"milestones"` | How many popup notifications Ariadne shows. |
| `ariadne.autoScan.intervalMinutes` | `60` | Minutes between automatic full scans. Minimum 2, maximum 180. |

GitHub sign-in is required to use the extension (scanning, rule scripts, and AI explanations). Explanations always use Gemini Flash via the user's Copilot allowance.

## npm scripts (reference)

| Script | Command | Purpose |
|---|---|---|
| `compile` | `npm run compile` | One-shot typecheck + lint + bundle |
| `watch` | `npm run watch` | Watch mode for development |
| `package` | `npm run package` | Production bundle (minified) |
| `lint` | `npm run lint` | ESLint only |
| `check-types` | `npm run check-types` | TypeScript check only |
| `test` | `npm test` | Extension tests (`vscode-test`) |
| `workflow` | `npm run workflow` | Agentic workflow CLI |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Extension fails to start / “cannot find module” | `dist/` not built | Run `npm run compile` |
| No findings / core errors in Debug Console | Scanner download or process failed | Check the notification and Debug Console; change Core in the sidebar or set `ariadne.executable` |
| Stale results after a new core release | Old scanner process still running | Reload the extension window |
| Ask Ariadne errors | Copilot auth failure | Check VS Code Copilot extension status |

Check **View → Output** or the **Debug Console** in the host that runs the extension for `[Ariadne Core]` stderr from the Rust process.

## Project structure

```
ariadne-extension-vscode/
├── src/
│   ├── extension.ts              ← activation entry point
│   └── modules/
│       ├── core/                 ← binary resolution
│       ├── detection/bridge/     ← IPC with scanner (spawn, messages, convert)
│       ├── presentation/         ← diagnostics, webviews, panels
│       ├── feedback/             ← Copilot "Ask Ariadne", auth, settings
│       ├── tracker/              ← status bar, session metrics, storage
│       └── rules/                ← .ariadne rule file support
├── scripts/                      ← workflow CLI tooling
├── docs/                         ← specs, plans, architecture, agent docs
├── dist/extension.js             ← built output (after compile)
├── package.json
└── .vscode/launch.json           ← F5 “Run Extension”
```

## License

Proprietary. Users may install and run it during data collection. See [LICENSE](LICENSE).

## See also

- [README.md](README.md) — end-user installation and usage
- Full-stack quick start — see the parent repository README
- Scanner core — see the scanner core documentation for building and installing the `ariadne` CLI
