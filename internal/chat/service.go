package chat

import (
	"context"
	"database/sql"

	"changeme/internal/database"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Service struct{ db *sql.DB }

func NewService(db *sql.DB) *Service { return &Service{db: db} }

func (s *Service) CreateChat(title string) (database.Chat, error) {
	return database.CreateChat(s.db, title)
}
func (s *Service) ListChats() ([]database.Chat, error)      { return database.ListChats(s.db) }
func (s *Service) GetChat(id string) (database.Chat, error) { return database.GetChat(s.db, id) }
func (s *Service) UpdateChatTitle(id, title string) error {
	return database.UpdateChatTitle(s.db, id, title)
}
func (s *Service) DeleteChat(id string) error { return database.DeleteChat(s.db, id) }
func (s *Service) DeleteAllChats() error      { return database.DeleteAllChats(s.db) }
func (s *Service) AddMessage(chatID, role, content, reasoning string) (database.Message, error) {
	return database.AddMessage(s.db, chatID, role, content, reasoning)
}
func (s *Service) ListMessages(chatID string) ([]database.Message, error) {
	return database.ListMessages(s.db, chatID)
}
func (s *Service) DeleteMessage(id string) error { return database.DeleteMessage(s.db, id) }

func (s *Service) ServiceStartup(context.Context, application.ServiceOptions) error { return nil }
func (s *Service) ServiceShutdown() error                                           { return s.db.Close() }
