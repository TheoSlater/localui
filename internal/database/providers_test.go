package database

import (
	"path/filepath"
	"testing"
)

func TestOpenRestoresDefaultProvider(t *testing.T) {
	path := filepath.Join(t.TempDir(), "localui.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := DeleteProvider(db, "openai"); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	providers, err := ListProviders(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(providers) != 1 || providers[0].ID != "openai" || providers[0].BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("providers = %#v, want the default OpenAI provider", providers)
	}
}
