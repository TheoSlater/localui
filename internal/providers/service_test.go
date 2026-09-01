package providers

import (
	"path/filepath"
	"strings"
	"testing"

	"changeme/internal/database"
)

func TestGenerateReplyReportsUnknownProvider(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "localui.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, err = NewService(db).GenerateReply("missing", "hello")
	if err == nil || !strings.Contains(err.Error(), "provider not found") {
		t.Fatalf("error = %v, want provider not found", err)
	}
}

func TestFormatProviderErrorUsesProviderMessage(t *testing.T) {
	err := formatProviderError(401, []byte(`{"error":{"message":"Incorrect API key provided"}}`))
	if err.Error() != "provider request failed with status 401: Incorrect API key provided" {
		t.Fatalf("error = %v, want provider message", err)
	}
}

func TestFormatProviderErrorExplainsEmptyUnauthorizedResponse(t *testing.T) {
	err := formatProviderError(401, nil)
	if !strings.Contains(err.Error(), "authentication was rejected") {
		t.Fatalf("error = %v, want authentication guidance", err)
	}
}
