# Spec v3 Migration: Remaining Tasks

## Phase 6: Orchestration & Automation
- [ ] **Task 6.1: Unified Flows**
    - [ ] Implement `src/flows/regimeCycle.ts`: macro fetch -> regime engine -> rebalancing.
    - [ ] Implement `src/flows/eodCheck.ts`: Flex fetch -> sync -> EOD monitor.
- [ ] **Task 6.2: Unified CLI**
    - [ ] Implement `src/cli.ts` using `commander`.
    - [ ] Commands: `rebalance`, `coherence`, `interpret`, `regime`, `add-position`, `set-indicator`.
- [ ] **Task 6.3: Scheduler**
    - [ ] Implement `src/scheduler.ts` using `node-cron`.

## Phase 7: Verification
- [ ] **Task 7.1: Full Test Suite**
    - [ ] Run `pnpm test` and ensure 100% pass rate.
- [ ] **Task 7.2: Provider Switching**
    - [ ] Verify `google` provider functionality.
    - [ ] Verify `anthropic` provider functionality.
