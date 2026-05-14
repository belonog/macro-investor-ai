# Regime Agent Implementation Progress

## Task 1: Define Regime Schemas
- [x] Step 1: Add Regime Quadrants and Snapshot Schemas to `src/data/types.ts`
- [x] Step 2: Add tests for new schemas in `tests/types.test.ts`
- [x] Step 3: Run tests and commit (`feat: add RegimeSnapshot schema and quadrants`)

## Task 2: Setup SQLite Persistence
- [x] Step 1: Create Database Wrapper in `src/agents/db.ts`
- [x] Step 2: Write tests for database logging in `tests/db.test.ts`
- [x] Step 3: Run tests and commit (`feat: implement sqlite persistence for regime history`)

## Task 3: Create System Prompt
- [ ] Step 1: Write the prompt text in `src/prompts/regime_system.txt`
- [ ] Step 2: Commit (`docs: add regime agent system prompt`)

## Task 4: Implement Regime Agent
- [ ] Step 1: Implement the evaluateRegime function in `src/agents/regimeAgent.ts`
- [ ] Step 2: Add mocked tests in `tests/regimeAgent.test.ts`
- [ ] Step 3: Run tests and commit (`feat: implement regime agent with Gemini integration`)
