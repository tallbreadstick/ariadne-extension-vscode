# Ariadne for VS Code

Ariadne checks Java code for common security problems while you work. It marks the line, tells you what reached a dangerous call, and can explain the idea behind the finding.

It does not rewrite your file. The explanation is a short example to study, not a patch.

You need VS Code 1.107 or newer, a folder with Java source, and a GitHub account.

## Start

1. Install **Ariadne** from the Extensions view.
2. Open the **Ariadne** shield in the activity bar and sign in with GitHub.
3. Open your Java project. The first scan starts on its own.
4. Read the marks in the editor, or open **Active Vulnerabilities** in the bottom panel and jump to a line.

## What a finding shows

The description names the value in your code and the call or response it reached. Names and file paths are shown as code, for example `password` or `application.properties`.

If the finding says a word came from the sensitive-name list, that word matched `rules/_library.ariadne`. Rename the variable, or remove the word from that list if it is not actually a secret. Otherwise fix the exposure.

Highlights use a color for the severity. Turn them off from the Ariadne sidebar if you only want the panel. Scanning continues either way.

## Explain Vulnerability

**Explain Vulnerability** describes one finding: what the bug is, why it matters, a made-up example of the mistake, and a safer shape of that example. It is not a replacement for your file.

Open it from the finding in **Active Vulnerabilities**, from the link in the editor hover, or with **Ariadne: Explain Vulnerability** in the Command Palette. Explanations use GitHub Copilot.

## Commands

Open the Command Palette and search for **Ariadne**:

| Command | What it does |
|---|---|
| **Ariadne: Analyze** | Scan the project again |
| **Ariadne: Explain Vulnerability** | Explain the finding you opened it from |
| **Ariadne: Sign In to GitHub** | Sign in |
| **Ariadne: Open Panel** | Show the Ariadne panel |
| **Ariadne: Settings** | Open the sidebar settings |
| **Ariadne: Terms of Use** | Read the terms |
| **Ariadne: Privacy Policy** | Read the privacy policy |

## If a scan looks empty

Sign in from the sidebar, then run **Ariadne: Analyze**. If the marks are missing, turn **Highlights** on in the sidebar. After an update, run **Developer: Reload Window**.

## License

Proprietary. See [LICENSE](LICENSE).

Working on the extension itself: [dev.md](dev.md).
