package database

// Timestamps are Unix milliseconds since the Unix epoch.
type Chat struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

type Message struct {
	ID        string `json:"id"`
	ChatID    string `json:"chatId"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"`
	CreatedAt int64  `json:"createdAt"`
}

type Provider struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Name      string `json:"name"`
	BaseURL   string `json:"baseUrl"`
	Model     string `json:"model"`
	HasAPIKey bool   `json:"hasApiKey"`
}
