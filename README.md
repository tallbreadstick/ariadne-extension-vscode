# ariadne-extension-vscode

VS Code extension for **Ariadne** — inline security diagnostics, vulnerability panels, session metrics, and an optional “Ask Ariadne” feedback panel powered by GitHub Copilot.

This extension does **not** embed the analysis engine. It spawns the **`ariadne`** CLI in session mode. Install the scanner binary first — see the scanner core documentation for Rust/Cargo setup.

```powershell
# From the scanner core repository
cargo install --path .
```

## Prerequisites

| Requirement | Version / notes |
|---|---|
| [Node.js](https://nodejs.org/) | LTS or **22.x** (matches `@types/node` in `package.json`) |
| npm | Bundled with Node.js |
| [Visual Studio Code](https://code.visualstudio.com/) | **1.107+** |
| `ariadne` on PATH | From `cargo install --path .` in scanner core |

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

## Using the extension

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

Inline squiggles and hovers appear on vulnerable lines after analysis.

## Settings

Open **File → Preferences → Settings** and search for **Ariadne**, or edit `settings.json`:

| Setting | Default | Purpose |
|---|---|---|
| `ariadne.executable` | `"ariadne"` | Path to the scanner binary |
| `ariadne.copilot.model` | `""` | Override Copilot model selection |

Authentication is handled via the VS Code Copilot extension SDK.

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
| No findings / core errors in Debug Console | `ariadne` not on PATH | Install scanner via cargo |
| Stale results after core changes | Old binary still installed | Reinstall scanner binary, reload window |
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

## See also

- Full-stack quick start — see the parent repository README
- Scanner core — see the scanner core documentation for building and installing the `ariadne` CLI
