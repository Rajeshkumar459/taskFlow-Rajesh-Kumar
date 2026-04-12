package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"taskflow/internal/api"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

func setupRouter(t *testing.T) http.Handler {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping integration tests")
	}

	database, err := db.New(dsn)
	if err != nil {
		t.Fatalf("connect to test DB: %v", err)
	}
	t.Cleanup(database.Close)

	broker := events.NewBroker()
	return api.NewRouter(database, broker, "test-secret")
}

func TestHealthEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %q", body["status"])
	}
}

func TestRegisterValidation(t *testing.T) {
	router := setupRouter(t)

	cases := []struct {
		name       string
		body       map[string]any
		wantStatus int
		wantField  string
	}{
		{
			name:       "missing email",
			body:       map[string]any{"name": "Alice", "password": "password123"},
			wantStatus: http.StatusBadRequest,
			wantField:  "email",
		},
		{
			name:       "missing name",
			body:       map[string]any{"email": "alice@example.com", "password": "password123"},
			wantStatus: http.StatusBadRequest,
			wantField:  "name",
		},
		{
			name:       "short password",
			body:       map[string]any{"name": "Alice", "email": "alice@example.com", "password": "short"},
			wantStatus: http.StatusBadRequest,
			wantField:  "password",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected %d, got %d: %s", tc.wantStatus, rec.Code, rec.Body.String())
			}

			var resp map[string]any
			json.NewDecoder(rec.Body).Decode(&resp)

			fields, ok := resp["fields"].(map[string]any)
			if !ok {
				t.Fatalf("expected fields in response, got: %v", resp)
			}
			if _, exists := fields[tc.wantField]; !exists {
				t.Errorf("expected field %q in validation errors, got: %v", tc.wantField, fields)
			}
		})
	}
}

func TestLoginWithInvalidCredentials(t *testing.T) {
	router := setupRouter(t)

	body, _ := json.Marshal(map[string]string{
		"email":    "nonexistent@example.com",
		"password": "wrongpassword",
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestProtectedRouteWithoutToken(t *testing.T) {
	router := setupRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/projects", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}
