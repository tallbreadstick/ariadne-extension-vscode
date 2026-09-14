# Common Vulnerabilities — Literature Justification Guide

What to search for to support the threshold values K = 2 (entry) and G = 2 (graduation) and the session-count reset on graduation re-entry.

---

## 1. Mastery Learning Frameworks

**Justifies:** G = 2 (consecutive clean sessions to graduate) and session-count reset (clean slate after demonstrated mastery).

**What to look for:**

- **Bloom's Mastery Learning (1968, 1984)** — Bloom's model requires students to demonstrate mastery on a topic before progressing. Look for how mastery is operationalized: typically repeated correct performance on formative assessments. The key parallel is that a single correct performance is insufficient — the learner must demonstrate consistency.
  - Search: `"mastery learning" Bloom threshold criterion`
  - Search: `"mastery learning" consecutive correct performance`

- **Leitner Spaced Repetition System (1972)** — Flashcard-based learning where cards "graduate" to the next box after being answered correctly N consecutive times (typically 2–3). A wrong answer sends the card back to box 1 (analogous to our session-count reset on graduation revocation).
  - Search: `Leitner system spaced repetition consecutive correct`
  - Search: `Leitner box promotion threshold`

- **Criterion-Referenced Mastery Thresholds** — Educational measurement research on how many consecutive correct demonstrations are needed to infer mastery. Studies often settle on 2–3 as the practical minimum.
  - Search: `criterion-referenced mastery threshold consecutive`
  - Search: `minimum trials mastery determination`

---

## 2. Spaced Repetition and the Spacing Effect

**Justifies:** G = 2 (spaced across sessions, not within one session) and why session boundaries matter more than observation counts.

**What to look for:**

- **Ebbinghaus Forgetting Curve (1885)** — The foundational work on memory decay over time. Relevant because our graduation requires clean sessions *spaced over time*, not just consecutive scans within one sitting.
  - Search: `Ebbinghaus forgetting curve spaced practice`

- **Spacing Effect in Skill Acquisition** — Studies showing that demonstrating a skill across spaced intervals (vs. massed practice) is a stronger indicator of durable learning. This supports using session boundaries (spaced intervals) rather than scan counts (massed within one session).
  - Search: `spacing effect skill retention interval`
  - Search: `distributed practice vs massed practice learning`

- **Cepeda et al. (2006)** — Meta-analysis on optimal spacing intervals for learning. Look for findings on how many spaced repetitions are needed for retention.
  - Search: `Cepeda spacing effect meta-analysis optimal interval`

---

## 3. Pattern Detection and Minimum Sample Size

**Justifies:** K = 2 (minimum occurrences to establish a pattern).

**What to look for:**

- **Repeated Error Analysis in Education** — Studies on how educators distinguish systematic errors (knowledge gaps) from random slips. The general finding: a single error is a slip; repeated errors indicate a misconception.
  - Search: `systematic error vs random slip repeated occurrence education`
  - Search: `error pattern identification minimum frequency`

- **Formative Assessment and Error Classification** — Research on how many occurrences of the same error type are needed before intervening. Look for thresholds used in adaptive learning systems.
  - Search: `formative assessment error recurrence threshold intervention`
  - Search: `adaptive learning system error frequency trigger`

- **Statistical Pattern Recognition Minimum** — The argument that N = 2 is the mathematical minimum to establish a non-singleton pattern. One event is an observation; two events with the same characteristic constitute a pattern.
  - Search: `minimum observations pattern detection behavioral`

---

## 4. Adaptive Learning Systems and Threshold Calibration

**Justifies:** K and G as configurable policy constants subject to empirical tuning.

**What to look for:**

- **Knowledge Tracing Models (Corbett & Anderson, 1995)** — Bayesian Knowledge Tracing uses learned probability thresholds (typically P(L) >= 0.95) to determine mastery. The specific threshold is configurable and tuned per-domain. This parallels our K and G being configurable constants.
  - Search: `Bayesian Knowledge Tracing mastery threshold configurable`
  - Search: `Corbett Anderson knowledge tracing`

- **Item Response Theory (IRT) in Adaptive Testing** — How adaptive tests determine when a student has demonstrated enough evidence of mastery/non-mastery. The number of items needed is domain-specific and calibrated.
  - Search: `item response theory minimum items mastery classification`

- **Threshold Tuning in Educational Data Mining** — Studies that explicitly discuss how thresholds for learning metrics are set and validated. Look for acknowledgments that initial thresholds are heuristic and refined empirically.
  - Search: `educational data mining threshold calibration learning analytics`
  - Search: `learning analytics configurable threshold empirical validation`

---

## 5. Security Education and Vulnerability Awareness

**Justifies:** The Common Vulnerabilities concept itself — tracking recurring vulnerability types as a learning signal.

**What to look for:**

- **Secure Coding Education Feedback Loops** — Studies on how students learn from repeated exposure to vulnerability feedback. Look for findings on how many exposures are needed before students internalize prevention.
  - Search: `secure coding education repeated vulnerability feedback`
  - Search: `student vulnerability awareness security training`

- **SAST Tool Adoption in Education** — Studies on static analysis tools used in educational settings. Look for how tools surface recurring issues and whether students learn to prevent them over time.
  - Search: `static analysis tool education student learning vulnerability`
  - Search: `SAST educational feedback loop`

- **Bandi et al. (2019)** — Referenced in the Ariadne capstone proposal. Structured feedback produces better learning outcomes. Supports the pedagogical value of the Common Vulnerabilities panel.
  - Search: `structured security feedback student learning outcomes`

- **Perry et al. (2023)** — On AI-assisted coding producing less secure code. Supports the diagnostic-only approach and why students need awareness of recurring vulnerability types.
  - Search: `AI code generation security vulnerability student`

---

## 6. Regression and Relapse in Skill Acquisition

**Justifies:** Session-count reset on graduation revocation (clean slate after relapse).

**What to look for:**

- **Skill Regression / Relapse Models** — Studies on how learners who have demonstrated mastery can regress. Look for how relapse is handled in competency-based education: does a single relapse erase all progress, or is a fresh assessment period given?
  - Search: `skill regression relapse competency-based education`
  - Search: `mastery learning regression reassessment`

- **Leitner System Box Reset** — Specifically how the Leitner system handles a wrong answer on a "mastered" card: it goes back to box 1 and must re-demonstrate mastery from scratch. This directly parallels the session-count reset.
  - Search: `Leitner system wrong answer reset box one`

- **Behavioral Extinction and Spontaneous Recovery (Pavlov)** — In behavioral psychology, an extinguished behavior can spontaneously recover. A single recovery event doesn't mean the extinction failed — it requires re-observation to determine if the behavior has truly returned.
  - Search: `spontaneous recovery extinction single occurrence behavioral`

---

## Summary: What Each Literature Category Justifies

| Parameter / Mechanism | Primary Literature Category |
|---|---|
| **K = 2** (entry) | Pattern detection minimum (§3), Repeated error analysis (§3), Formative assessment thresholds (§3) |
| **G = 2** (graduation) | Mastery learning (§1), Spaced repetition (§2), Criterion-referenced thresholds (§1) |
| **Session-count reset** | Leitner box reset (§1, §6), Skill regression models (§6), Spontaneous recovery (§6) |
| **K, G as configurable** | Knowledge Tracing (§4), EDM threshold calibration (§4) |
| **Common Vulnerabilities concept** | Security education feedback (§5), SAST in education (§5) |
