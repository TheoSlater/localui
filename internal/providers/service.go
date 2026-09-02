package providers

import (
	"changeme/internal/database"
	"context"
	"database/sql"
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zalando/go-keyring"
	"strings"
)

const serviceName = "LocalUI"

func credentialName(id string) string { return "provider:" + id }

type Service struct{ db *sql.DB }

func NewService(db *sql.DB) *Service { return &Service{db: db} }
func (s *Service) ListProviders() ([]database.Provider, error) {
	ps, e := database.ListProviders(s.db)
	if e != nil {
		return nil, e
	}
	for i := range ps {
		ps[i].HasAPIKey = s.HasProviderAPIKey(ps[i].ID)
	}
	return ps, nil
}
func (s *Service) SaveProvider(p database.Provider) error {
	p.Name = strings.TrimSpace(p.Name)
	p.BaseURL = strings.TrimSpace(p.BaseURL)
	p.Model = strings.TrimSpace(p.Model)
	return database.SaveProvider(s.db, p)
}
func (s *Service) DeleteProvider(id string) error {
	if e := database.DeleteProvider(s.db, id); e != nil {
		return e
	}
	if e := keyring.Delete(serviceName, credentialName(id)); e != nil && e != keyring.ErrNotFound {
		return fmt.Errorf("delete provider credential: %w", e)
	}
	return nil
}
func (s *Service) SetProviderAPIKey(id, key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil
	}
	return keyring.Set(serviceName, credentialName(id), key)
}
func (s *Service) DeleteProviderAPIKey(id string) error {
	e := keyring.Delete(serviceName, credentialName(id))
	if e == keyring.ErrNotFound {
		return nil
	}
	return e
}
func (s *Service) HasProviderAPIKey(id string) bool {
	_, e := keyring.Get(serviceName, credentialName(id))
	return e == nil
}
func (s *Service) APIKey(id string) (string, error) {
	return keyring.Get(serviceName, credentialName(id))
}

func (s *Service) ServiceStartup(context.Context, application.ServiceOptions) error { return nil }
func (s *Service) ServiceShutdown() error                                           { return nil }
