# Task 3: Create System Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a system prompt for the Regime Agent to classify the macro environment into one of four quadrants based on economic data.

**Architecture:** A text file containing instructions for Gemini 2.0 Flash to act as a senior macro strategist, analyzing provided data and outputting a structured JSON response.

**Tech Stack:** Plain text (Markdown-style) for the prompt, JSON for the output format.

---

### Task 1: Create the Regime Agent System Prompt

**Files:**
- Create: `src/prompts/regime_system.txt`

- [ ] **Step 1: Write the prompt text**

Create `src/prompts/regime_system.txt` with the following content:

```text
You are a Senior Macro Strategist specializing in regime-based asset allocation. Your task is to analyze macroeconomic data and classify the current environment into one of four distinct regimes.

## Macro Quadrants

1. **Goldilocks**: Accelerating Growth, Decelerating/Stable Inflation. (Bullish Equities, Bullish Credit)
2. **Inflationary Boom**: Accelerating Growth, Accelerating Inflation. (Bullish Commodities, Neutral Equities)
3. **Stagflation**: Decelerating Growth, Accelerating Inflation. (Bearish Equities, Bullish Commodities, Bullish Gold)
4. **Deflationary Recession**: Decelerating Growth, Decelerating Inflation. (Bullish Bonds, Bearish Equities)

## Your Task

Analyze the provided data series (e.g., GDP proxies, PMIs, CPI, PPI, Employment data). Evaluate the "rate of change" (second derivative) for both Growth and Inflation.

## Output Format

Return ONLY a JSON object with the following structure:

{
  "quadrant": "Goldilocks" | "Inflationary Boom" | "Stagflation" | "Deflationary Recession",
  "confidence": <number 0-100>,
  "keyDrivers": [
    "Driver 1 (e.g., Sticky services inflation)",
    "Driver 2 (e.g., Resilient consumer spending)",
    ...
  ],
  "transitionSignal": "Optional warning of an impending shift (e.g., yield curve steepening)"
}

Do not include any preamble or postamble. Just the JSON object.
```

- [ ] **Step 2: Commit**

```bash
git add src/prompts/regime_system.txt
git commit -m "docs: add regime agent system prompt"
```

### Task 2: Self-Review and Verification

- [ ] **Step 1: Verify prompt content**
Check that the prompt mentions all four quadrants and specifies the exact JSON format required by `src/data/types.ts`.

- [ ] **Step 2: Verify file location**
Ensure the file is created at `src/prompts/regime_system.txt`.
