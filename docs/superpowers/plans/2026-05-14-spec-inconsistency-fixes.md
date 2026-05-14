# Spec Inconsistency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize and standardize `macro_investor_ai_specs.md` to resolve internal inconsistencies identified by code quality review.

**Architecture:** Documentation update to ensure alignment between Architecture diagrams, Directory Structure, Module Specifications, and naming conventions.

**Tech Stack:** Markdown

---

### Task 1: Synchronize Fetchers

**Files:**
- Modify: `macro_investor_ai_specs.md`

- [ ] **Step 1: Update Architecture Diagram (Section 2)**
    Add missing `FRED API` (already there) and ensure `BLS`, `EIA`, and `Polygon.io` are represented.

- [ ] **Step 2: Update Directory Structure (Section 4)**
    Ensure `blsFetcher.ts` and `eiaFetcher.ts` are listed under `src/data/fetchers/`.

- [ ] **Step 3: Add Module Specifications (Section 6)**
    Add missing specifications for `blsFetcher.ts`, `eiaFetcher.ts`, and `polygonFetcher.ts`.

- [ ] **Step 4: Commit**

```bash
git add macro_investor_ai_specs.md
git commit -m "docs: sync fetchers in spec"
```

### Task 2: Unify Naming & Standardize Paths

**Files:**
- Modify: `macro_investor_ai_specs.md`

- [ ] **Step 1: Rename "Regime Engine" to "Regime Detection Agent"**
    Standardize the name in Section 1.1 (Value Hierarchy), Section 2 (Architecture Diagram), and Section 6.3.

- [ ] **Step 2: Standardize Cache File Naming (camelCase)**
    Update all references of cache files to camelCase:
    - `macroSnapshot.json` (already camelCase)
    - `positionsSnapshot.json` (already camelCase)
    - `regimeLatest.json` (ensure consistent usage)
    - Rename `regime_latest.json` to `regimeLatest.json`.

- [ ] **Step 3: Standardize Paths to use `src/` prefix**
    Ensure all file paths consistently use the `src/` prefix (e.g., `src/agents/regimeAgent.ts`).

- [ ] **Step 4: Commit**

```bash
git add macro_investor_ai_specs.md
git commit -m "docs: unify naming and standardize paths in spec"
```

### Task 3: Fix Diagram Flow

**Files:**
- Modify: `macro_investor_ai_specs.md`

- [ ] **Step 1: Update Architecture Diagram Flow**
    Modify the ASCII diagram in Section 2 to show the data flow of the portfolio snapshot (from `IBKR Flex Reports`) reaching the `REBALANCING AGENT`.

- [ ] **Step 2: Commit**

```bash
git add macro_investor_ai_specs.md
git commit -m "docs: fix diagram flow in spec"
```
