# Data layer

Concrete repository adapters belong here. They may depend on Supabase, SQLite, or another data source and must implement interfaces owned by the relevant feature/domain layer. UI code must never import these adapters or the Supabase client directly; composition code injects repositories into services.

Suggested adapter paths as features are implemented:

- `repositories/supabase/`
- `repositories/sqlite/`
- `mappers/`
- `dto/`
