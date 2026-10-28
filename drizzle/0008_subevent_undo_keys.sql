CREATE TABLE subevent_undo_keys (
 workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 secret TEXT NOT NULL
);
