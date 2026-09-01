package database

import (
	"database/sql"
	"fmt"
)

const schemaVersion = 3

func migrate(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema version table: %w", err)
	}
	var version int
	err := db.QueryRow("SELECT version FROM schema_version LIMIT 1").Scan(&version)
	if err == sql.ErrNoRows {
		version = 0
	} else if err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	if version > schemaVersion {
		return fmt.Errorf("database schema version %d is newer than supported version %d", version, schemaVersion)
	}
	if version < 1 {
		if err := applyInitialMigration(db); err != nil {
			return err
		}
	}
	if version < 2 {
		if err := applyProviderMigration(db); err != nil {
			return err
		}
	}
	if version < 3 {
		if err := applyReasoningMigration(db); err != nil {
			return err
		}
	}
	return ensureDefaultProvider(db)
}

func applyReasoningMigration(db *sql.DB) error {
	_, err := db.Exec(`BEGIN; ALTER TABLE messages ADD COLUMN reasoning TEXT NOT NULL DEFAULT ''; UPDATE schema_version SET version=3; COMMIT;`)
	if err != nil {
		return fmt.Errorf("apply reasoning migration: %w", err)
	}
	return nil
}

func ensureDefaultProvider(db *sql.DB) error {
	_, err := db.Exec(`INSERT OR IGNORE INTO providers(id,type,name,base_url,model) VALUES ('openai','OpenAI','OpenAI','https://api.openai.com/v1','')`)
	if err != nil {
		return fmt.Errorf("ensure default provider: %w", err)
	}
	return nil
}

func applyProviderMigration(db *sql.DB) error {
	_, err := db.Exec(`BEGIN; CREATE TABLE providers (id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL); INSERT INTO providers(id,type,name,base_url,model) VALUES ('openai','OpenAI','OpenAI','https://api.openai.com/v1',''); UPDATE schema_version SET version=2; COMMIT;`)
	if err != nil {
		return fmt.Errorf("apply provider migration: %w", err)
	}
	return nil
}

func applyInitialMigration(db *sql.DB) error {
	_, err := db.Exec(`
BEGIN;
CREATE TABLE chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at);
INSERT INTO schema_version(version) VALUES (1);
COMMIT;`)
	if err != nil {
		return fmt.Errorf("apply initial migration: %w", err)
	}
	return nil
}
