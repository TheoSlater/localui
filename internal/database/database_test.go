package database

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "localui.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestMigrationsCreateSchema(t *testing.T) {
	db := testDB(t)
	var version int
	if err := db.QueryRow("SELECT version FROM schema_version").Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version != 3 {
		t.Fatalf("schema version = %d, want 3", version)
	}
}

func TestChatsAndMessages(t *testing.T) {
	db := testDB(t)
	chat, err := CreateChat(db, "First")
	if err != nil {
		t.Fatal(err)
	}
	second, err := CreateChat(db, "Second")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := AddMessage(db, chat.ID, "user", "hello"); err != nil {
		t.Fatal(err)
	}
	if _, err := AddMessage(db, chat.ID, "assistant", "world", "Because the answer is simple."); err != nil {
		t.Fatal(err)
	}
	messages, err := ListMessages(db, chat.ID)
	if err != nil || len(messages) != 2 || messages[0].Content != "hello" || messages[1].Reasoning == "" {
		t.Fatalf("messages = %#v, err = %v", messages, err)
	}
	chats, err := ListChats(db)
	if err != nil || len(chats) != 2 || chats[0].ID != chat.ID {
		t.Fatalf("chats = %#v, err = %v", chats, err)
	}
	if chats[0].UpdatedAt < chat.UpdatedAt {
		t.Fatal("message did not update chat timestamp")
	}
	if err := DeleteChat(db, chat.ID); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM messages WHERE chat_id=?", chat.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("cascade message count = %d", count)
	}
	_ = second
}

func TestDeleteAllChats(t *testing.T) {
	db := testDB(t)
	first, err := CreateChat(db, "First")
	if err != nil {
		t.Fatal(err)
	}
	second, err := CreateChat(db, "Second")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := AddMessage(db, first.ID, "user", "hello"); err != nil {
		t.Fatal(err)
	}
	if _, err := AddMessage(db, second.ID, "assistant", "world"); err != nil {
		t.Fatal(err)
	}

	if err := DeleteAllChats(db); err != nil {
		t.Fatal(err)
	}
	chats, err := ListChats(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(chats) != 0 {
		t.Fatalf("chats after delete all = %d, want 0", len(chats))
	}
	var messages int
	if err := db.QueryRow("SELECT COUNT(*) FROM messages").Scan(&messages); err != nil {
		t.Fatal(err)
	}
	if messages != 0 {
		t.Fatalf("messages after delete all = %d, want 0", messages)
	}
}
