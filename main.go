package main

import (
	"embed"
	"fmt"
	"log"

	"changeme/internal/chat"
	"changeme/internal/database"
	"changeme/internal/providers"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main function serves as the application's entry point. It initializes the
// application, creates a window, and runs the application, logging any error
// that might occur.
func main() {
	db, err := database.Open("")
	if err != nil {
		log.Fatal(err)
	}
	chatService := chat.NewService(db)
	providerService := providers.NewService(db)
	app := application.New(application.Options{
		Name:        "localui",
		Description: "localui",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Services: []application.Service{application.NewService(chatService), application.NewService(providerService)},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "localui",
		Width:  1000,
		Height: 618,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "/",
	})

	err = app.Run()
	if err != nil {
		log.Fatal(fmt.Errorf("run application: %w", err))
	}
}
