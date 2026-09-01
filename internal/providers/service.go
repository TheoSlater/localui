package providers

import (
	"bytes"
	"changeme/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/zalando/go-keyring"
	"io"
	"net/http"
	"net/url"
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

func formatProviderError(status int, data []byte) error {
	var result struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
		Message string `json:"message"`
	}
	message := ""
	if json.Unmarshal(data, &result) == nil {
		message = strings.TrimSpace(result.Error.Message)
		if message == "" {
			message = strings.TrimSpace(result.Message)
		}
	}
	if message == "" {
		message = strings.TrimSpace(string(data))
	}
	if len(message) > 512 {
		message = message[:512] + "…"
	}
	if message == "" {
		if status == http.StatusUnauthorized {
			message = "authentication was rejected; replace the API key for this provider"
		} else {
			return fmt.Errorf("provider request failed with status %d", status)
		}
	}
	return fmt.Errorf("provider request failed with status %d: %s", status, message)
}

func (s *Service) GenerateReply(id, prompt string) (string, error) {
	ps, e := database.ListProviders(s.db)
	if e != nil {
		return "", e
	}
	var p database.Provider
	for _, item := range ps {
		if item.ID == id {
			p = item
			break
		}
	}
	if p.ID == "" {
		return "", fmt.Errorf("provider not found")
	}
	baseURL := strings.TrimRight(strings.TrimSpace(p.BaseURL), "/")
	parsedURL, parseErr := url.Parse(baseURL)
	if parseErr != nil || parsedURL.Scheme == "" || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return "", fmt.Errorf("provider base URL must be a complete http or https URL")
	}
	key, e := s.APIKey(id)
	if e != nil {
		return "", fmt.Errorf("provider credential unavailable")
	}
	body, e := json.Marshal(map[string]any{"model": p.Model, "messages": []map[string]string{{"role": "user", "content": prompt}}})
	if e != nil {
		return "", fmt.Errorf("encode provider request: %w", e)
	}
	req, e := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(body))
	if e != nil {
		return "", fmt.Errorf("create provider request: %w", e)
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, e := http.DefaultClient.Do(req)
	if e != nil {
		return "", fmt.Errorf("provider request failed: %w", e)
	}
	defer resp.Body.Close()
	data, e := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if e != nil {
		return "", fmt.Errorf("read provider response: %w", e)
	}
	if resp.StatusCode/100 != 2 {
		return "", formatProviderError(resp.StatusCode, data)
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Choices) == 0 {
		return "", fmt.Errorf("invalid provider response")
	}
	return result.Choices[0].Message.Content, nil
}
func (s *Service) ServiceStartup(context.Context, application.ServiceOptions) error { return nil }
func (s *Service) ServiceShutdown() error                                           { return nil }
