# FitHub testing report

Generated from the verification run beginning 2026-10-07T23:17:18.105Z and ending 2026-10-07T23:17:32.930Z.

## Execution

| Check | Result | Evidence / prerequisite |
| --- | --- | --- |
| core | passed | 258/258 passing in 16 files |
| jest | blocked | [Execution log](../artifacts/jest.log) |
| integration | blocked | [Execution log](../artifacts/integration.log) |
| typecheck | blocked | [Execution log](../artifacts/typecheck.log) |
| lint | blocked | [Execution log](../artifacts/lint.log) |
| database-static | passed | [Execution log](../artifacts/database-static.log) |
| syntax | passed | [Execution log](../artifacts/syntax.log) |
| production-config | blocked | [Execution log](../artifacts/production-config.log) |
| production-dependencies | blocked | [Execution log](../artifacts/production-dependencies.log) |
| production-android-export | blocked | [Execution log](../artifacts/production-android-export.log) |
| production-ios-export | blocked | [Execution log](../artifacts/production-ios-export.log) |
| maestro | not-run | Requires a provisioned test backend, installed development build and running device. Set FITHUB_RUN_E2E=1 to execute. |
| database-integration | not-run | Rollback-only SQL suites require a migrated local Supabase/PostgreSQL instance and psql. Set FITHUB_TEST_DATABASE_URL to execute. |

Jest/RNTL inventory: 62 test files. Jest suites have not been executed successfully in this environment.

The dependency-free core runner includes behavioral tests, real SQLite persistence tests and static source/SQL contract checks. Its passing count is not Jest coverage, component verification or PostgreSQL execution.

## Coverage

| Dimension | Measured | Gate | Status |
| --- | --- | --- | --- |
| All dimensions | Not measured | 70% | Not established |

Jest enforces 70% statements, branches, functions and lines across application source, including screens and adapters. Only tests, fixtures, declaration files and type directories are excluded. No production feature is excluded to raise coverage. Empty V8 reports from VM-loaded modules are discarded; a displayed 100% on zero tracked files is not valid coverage. A configured gate is not proof the target has been reached.

## Critical Maestro scenarios

| Flow | Assertions |
| --- | --- |
| 01 authentication | Register a fresh user, reach Home, log out, log in again, reach Home |
| 02 workout | Create template, choose seeded exercise, configure/save, start, log set, finish, verify summary, save |
| 03 challenge | Create public challenge, creator enrollment, leave/rejoin, verify membership and leaderboard position |
| 04 measurements | Create metric measurement, verify history, return to dashboard and verify latest weight |

Device execution status: not-run. Auth, networking, storage, notifications and database are not mocked in Maestro. Scenario definitions are not passing E2E results.

## Scope and limitations

New Jest tests exercise real form validation, password visibility, busy/error states, exercise selection, unit switching, durable-session invariants, threshold rules and multi-service workflows. Client integration tests replace repository/network boundaries, not domain services. Simulated server receipts in these tests do not verify SQL scoring or Auth profile triggers; rollback-only SQL suites verify those against an actual database when executed.

Read [testing guide](testing.md) for commands, external mocking policy, fixture setup, SQL security regressions and the exact added/changed file manifest. Resolve blocked checks, run the full gate and inspect uncovered branches before claiming 70% useful coverage or release readiness.
