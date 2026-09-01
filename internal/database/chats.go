package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func CreateChat(db *sql.DB, title string) (Chat, error) {
	now := time.Now().UnixMilli()
	chat := Chat{ID: uuid.NewString(), Title: title, CreatedAt: now, UpdatedAt: now}
	_, err := db.Exec("INSERT INTO chats(id,title,created_at,updated_at) VALUES(?,?,?,?)", chat.ID, chat.Title, now, now)
	return chat, wrap("create chat", err)
}

func ListChats(db *sql.DB) ([]Chat, error) {
	rows, err := db.Query("SELECT id,title,created_at,updated_at FROM chats ORDER BY updated_at DESC, created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("list chats: %w", err)
	}
	defer rows.Close()
	var chats []Chat
	for rows.Next() {
		var chat Chat
		if err := rows.Scan(&chat.ID, &chat.Title, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan chat: %w", err)
		}
		chats = append(chats, chat)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list chats rows: %w", err)
	}
	return chats, nil
}

func GetChat(db *sql.DB, id string) (Chat, error) {
	var chat Chat
	err := db.QueryRow("SELECT id,title,created_at,updated_at FROM chats WHERE id=?", id).Scan(&chat.ID, &chat.Title, &chat.CreatedAt, &chat.UpdatedAt)
	if err == sql.ErrNoRows {
		return Chat{}, fmt.Errorf("chat %q not found", id)
	}
	return chat, wrap("get chat", err)
}

func UpdateChatTitle(db *sql.DB, id, title string) error {
	result, err := db.Exec("UPDATE chats SET title=?,updated_at=? WHERE id=?", title, time.Now().UnixMilli(), id)
	if err != nil {
		return fmt.Errorf("update chat title: %w", err)
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return fmt.Errorf("chat %q not found", id)
	}
	return nil
}

func DeleteChat(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM chats WHERE id=?", id)
	return wrap("delete chat", err)
}

func DeleteAllChats(db *sql.DB) error {
	_, err := db.Exec("DELETE FROM chats")
	return wrap("delete all chats", err)
}

func wrap(operation string, err error) error {
	if err != nil {
		return fmt.Errorf("%s: %w", operation, err)
	}
	return nil
}
