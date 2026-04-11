package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"taskflow/internal/api"
	"taskflow/internal/config"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	database, err := db.New(cfg.DSN())
	if err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer database.Close()

	slog.Info("database connected")

	broker := events.NewBroker()

	router := api.NewRouter(database, broker, cfg.JWTSecret)

	srv := &http.Server{
		Addr:         ":" + cfg.AppPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // SSE streams need no write timeout
		IdleTimeout:  60 * time.Second,
	}

	// Start server in background
	go func() {
		slog.Info("server starting", "port", cfg.AppPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "err", err)
	}

	slog.Info("server stopped")
}
