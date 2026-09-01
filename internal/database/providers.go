package database

import (
	"database/sql"
	"fmt"
)

func ListProviders(db *sql.DB) ([]Provider, error) {
	rows, err := db.Query("SELECT id,type,name,base_url,model FROM providers ORDER BY rowid")
	if err != nil {
		return nil, fmt.Errorf("list providers: %w", err)
	}
	defer rows.Close()
	var out []Provider
	for rows.Next() {
		var p Provider
		if err := rows.Scan(&p.ID, &p.Type, &p.Name, &p.BaseURL, &p.Model); err != nil {
			return nil, fmt.Errorf("scan provider: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
func SaveProvider(db *sql.DB, p Provider) error {
	_, err := db.Exec(`INSERT INTO providers(id,type,name,base_url,model) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,base_url=excluded.base_url,model=excluded.model`, p.ID, p.Type, p.Name, p.BaseURL, p.Model)
	return wrap("save provider", err)
}
func DeleteProvider(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM providers WHERE id=?", id)
	return wrap("delete provider", err)
}
