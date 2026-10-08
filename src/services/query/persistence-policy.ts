// Mutation variables can contain passwords or private media. Durable offline
// writes use the validated SQLite outbox, never the generic query snapshot.
export function shouldPersistMutation(): boolean { return false; }
