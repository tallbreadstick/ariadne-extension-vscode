# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are CSIT undergraduate students at Cebu Institute of Technology – University (CIT-U) enrolled in project-based Java web development courses. They write Java in VS Code, often under academic integrity rules, and need to find and understand security flaws in code they themselves authored.

Instructors, researchers, and capstone evaluators may read session or trend data. They are not a co-audience of the extension UI.

## Product Purpose

Ariadne is a student-first VS Code extension that performs real-time, diagnostic-only static application security testing (SAST) on student-written Java. It surfaces findings in the editor and panels, and can explain a finding in structured plain language via GitHub Copilot.

Success is that a student can see a real vulnerability in their own code, understand why it matters, and independently research and fix it — without the tool writing, suggesting, or completing code for them.

## Positioning

Ariadne is not a professional SAST suite and not an AI coding assistant. Neighboring tools generate or complete code; Ariadne is constrained never to do that, so students remain sole authors of their work. Detection is diagnostic. Explanation is conceptual (issue, security implication, concept pointer), not a patch.

## Operating Context

Students work inside VS Code on Java coursework. The extension activates on Java files, spawns the `ariadne` scanner as a local child process, and updates as they edit.

Product surfaces in the extension:

- Editor: severity-coded diagnostics, decorations, hover with an “Ask Ariadne” action
- Bottom panel: Active Vulnerabilities and Session Metrics webviews
- Sidebar: Account (GitHub sign-in) webview
- Command palette and status bar
- Optional “Ask Ariadne” feedback panel (Copilot-backed)
- Terms of use panel

The scanner binary is a separate private Rust engine. This public extension repo talks to it only through a local stdio bridge. Students (or a lab image) must have the `ariadne` CLI available; the extension does not embed the engine.

Ask Ariadne requires GitHub Copilot access and a GitHub OAuth sign-in inside VS Code. Scanning itself does not.

Session history is workspace-scoped VS Code storage, not an external database. Cross-workspace and class-level dashboards are out of scope.

## Capabilities and Constraints

Confirmed:

- Real-time Java SAST via the local `ariadne` session process (OWASP Top 10 / CWE Top 25 class patterns).
- Inline diagnostics, Active Vulnerabilities, Session Metrics, status bar, and optional Copilot explanations.
- LLM output is a three-section explanation only. The product must never generate, suggest, complete, or display code fixes.
- Java-only detection for this capstone. Other languages are deferred.
- VS Code is the only product surface. Webviews, editor chrome, hover, status bar, and commands — not a standalone website, mobile app, or other IDE.
- Explanations require GitHub Copilot sign-in. Detection does not.
- Trends and session metrics report observed scanner behavior only. They must not claim student intent, learning, understanding, permanent remediation, or semantic security from scan data alone.
- This extension repo is public. Do not commit private scanner URLs, internals, or proprietary rule logic.
- Source sent to Copilot is limited to vulnerability metadata plus the active file for explanation context.

Undecided / out of scope for this record:

- Instructor dashboard and aggregated class metrics
- Multi-language scanning
- Cross-session longitudinal tracking across workspaces
- Bundling or auto-downloading the scanner binary as part of install

## Brand Commitments

- Product name: **Ariadne**
- Extension display name: `ariadne`; package `ariadne-extension-vscode`
- Identity assets: `media/shield.svg`, `media/shield-light.svg` (activity-bar / product mark)
- Voice: student-first, diagnostic, conceptual. Plain language. No “here is the fix” posture.
- Academic integrity is a brand and product constraint, not a slogan: no code in explanations or UI.

## Evidence on Hand

Real, in-repo:

- Shipped MVP: detection, diagnostic presentation, Ask Ariadne, session tracking
- Capstone / SRS-derived decisions in `docs/ai/decisions.md` and `docs/ai/project-context.md`
- Existing webview HTML builders under `src/modules/*/views/`
- Shield marks under `media/`

Must not fabricate:

- Testimonials, named customers, adoption numbers, pricing, licensing, or third-party press
- Claims that scan trends prove learning, intent, or that code is semantically secure
- Public documentation of private scanner internals

## Product Principles

1. **Students remain the authors.** The product finds and explains; it never writes the student’s code.
2. **Teach the concept, not the patch.** Explanations exist so the student can learn and fix independently.
3. **Stay in the editor they already use.** Ariadne lives in VS Code; it does not become another tool to configure.
4. **Observe code, do not narrate the student.** Metrics and trends describe scanner-observed code behavior only.
5. **Protect the public/private split.** The extension is public; scanner proprietary logic stays out of this repo.

## Accessibility & Inclusion

WCAG 2.2 AA is a required product standard for webview and HTML surfaces.

Also follow VS Code webview and workbench accessibility conventions (theme tokens, keyboard access, contrast against the user’s editor theme) so the extension remains usable inside light and dark VS Code themes.
