package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func AddMessage(db *sql.DB, chatID, role, content string, reasoning ...string) (Message, error) {
	tx, err := db.Begin()
	if err != nil {
		return Message{}, fmt.Errorf("begin add message: %w", err)
	}
	now := time.Now().UnixMilli()
	var latest sql.NullInt64
	if err = tx.QueryRow("SELECT MAX(created_at) FROM messages WHERE chat_id=?", chatID).Scan(&latest); err != nil {
		tx.Rollback()
		return Message{}, fmt.Errorf("read message timestamp: %w", err)
	}
	if latest.Valid && now <= latest.Int64 {
		now = latest.Int64 + 1
	}
	messageReasoning := ""
	if len(reasoning) > 0 {
		messageReasoning = reasoning[0]
	}
	message := Message{ID: uuid.NewString(), ChatID: chatID, Role: role, Content: content, Reasoning: messageReasoning, CreatedAt: now}
	if _, err = tx.Exec("INSERT INTO messages(id,chat_id,role,content,reasoning,created_at) VALUES(?,?,?,?,?,?)", message.ID, chatID, role, content, messageReasoning, now); err != nil {
		tx.Rollback()
		return Message{}, fmt.Errorf("insert message: %w", err)
	}
	if _, err = tx.Exec("UPDATE chats SET updated_at=? WHERE id=?", now, chatID); err != nil {
		tx.Rollback()
		return Message{}, fmt.Errorf("update chat timestamp: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return Message{}, fmt.Errorf("commit message: %w", err)
	}
	return message, nil
}

func ListMessages(db *sql.DB, chatID string) ([]Message, error) {
	rows, err := db.Query("SELECT id,chat_id,role,content,reasoning,created_at FROM messages WHERE chat_id=? ORDER BY created_at ASC, id ASC", chatID)
	if err != nil {
		return nil, fmt.Errorf("list messages: %w", err)
	}
	defer rows.Close()
	var messages []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.Role, &m.Content, &m.Reasoning, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

func DeleteMessage(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM messages WHERE id=?", id)
	return wrap("delete message", err)
}
