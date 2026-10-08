# Feature modules

Each feature owns its screens and, when needed, its `components`, `hooks`, `services`, `repositories`, `types`, and `validation` directories. Repository files in a feature define backend-agnostic contracts. Concrete Supabase or SQLite adapters live under `src/data`.

Cross-feature UI belongs in `src/components`; cross-feature business entities belong in `src/domain`.
