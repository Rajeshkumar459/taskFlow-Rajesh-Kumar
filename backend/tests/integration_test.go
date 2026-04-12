package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// ── Helpers ───────────────────────────────────────────────────────────────────

var emailCounter int64

// uniqueEmail returns a unique email address on every call so parallel tests
// never collide in the database.
func uniqueEmail(prefix string) string {
	n := atomic.AddInt64(&emailCounter, 1)
	return fmt.Sprintf("%s+%d@test.example.com", prefix, n)
}

// doRequest fires a single HTTP request against the router and returns the
// recorder so callers can inspect status + body.
func doRequest(router http.Handler, method, path string, body any, token string) *httptest.ResponseRecorder {
	var b []byte
	if body != nil {
		b, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// decode parses the recorder body as a map.
func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var v map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&v); err != nil {
		t.Fatalf("decode JSON (status %d): %v  body: %s", rec.Code, err, rec.Body.String())
	}
	return v
}

// mustRegister registers a user and returns the JWT token.
func mustRegister(t *testing.T, router http.Handler, name, email, password string) string {
	t.Helper()
	rec := doRequest(router, http.MethodPost, "/auth/register", map[string]string{
		"name": name, "email": email, "password": password,
	}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("register: no token in response")
	}
	return token
}

// mustLogin logs in and returns the JWT token.
func mustLogin(t *testing.T, router http.Handler, email, password string) string {
	t.Helper()
	rec := doRequest(router, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": password,
	}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("login: no token in response")
	}
	return token
}

// mustCreateProject creates a project and returns its ID.
func mustCreateProject(t *testing.T, router http.Handler, token, name string) string {
	t.Helper()
	rec := doRequest(router, http.MethodPost, "/projects", map[string]string{"name": name}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create project: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatal("create project: no id in response")
	}
	return id
}

// mustCreateTask creates a task and returns its ID.
func mustCreateTask(t *testing.T, router http.Handler, token, projectID, title string) string {
	t.Helper()
	rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/tasks", map[string]string{"title": title}, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatal("create task: no id in response")
	}
	return id
}

// getUserID extracts the user ID from a register/login response body.
func getUserIDFromToken(t *testing.T, router http.Handler, email, password string) string {
	t.Helper()
	rec := doRequest(router, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": password,
	}, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("getUserID login: %d %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	user, _ := body["user"].(map[string]any)
	id, _ := user["id"].(string)
	return id
}

// ── Auth tests ────────────────────────────────────────────────────────────────

func TestRegister_Success(t *testing.T) {
	router := setupRouter(t)
	email := uniqueEmail("register")

	rec := doRequest(router, http.MethodPost, "/auth/register", map[string]string{
		"name": "Alice", "email": email, "password": "password123",
	}, "")

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	body := decode(t, rec)
	if _, ok := body["token"].(string); !ok || body["token"] == "" {
		t.Error("expected non-empty token")
	}
	user, ok := body["user"].(map[string]any)
	if !ok {
		t.Fatal("expected user object in response")
	}
	if user["name"] != "Alice" {
		t.Errorf("expected name=Alice, got %v", user["name"])
	}
	if user["email"] != email {
		t.Errorf("expected email=%s, got %v", email, user["email"])
	}
	if _, hasPass := user["password"]; hasPass {
		t.Error("password must not be exposed in user response")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	router := setupRouter(t)
	email := uniqueEmail("dup")

	mustRegister(t, router, "First", email, "password123")

	rec := doRequest(router, http.MethodPost, "/auth/register", map[string]string{
		"name": "Second", "email": email, "password": "password123",
	}, "")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	body := decode(t, rec)
	fields, _ := body["fields"].(map[string]any)
	if _, ok := fields["email"]; !ok {
		t.Errorf("expected fields.email error, got: %v", fields)
	}
}

func TestRegister_InvalidEmail(t *testing.T) {
	router := setupRouter(t)

	rec := doRequest(router, http.MethodPost, "/auth/register", map[string]string{
		"name": "Alice", "email": "not-an-email", "password": "password123",
	}, "")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	body := decode(t, rec)
	fields, _ := body["fields"].(map[string]any)
	if _, ok := fields["email"]; !ok {
		t.Errorf("expected fields.email error, got: %v", fields)
	}
}

func TestLogin_Success(t *testing.T) {
	router := setupRouter(t)
	email := uniqueEmail("login")
	mustRegister(t, router, "Bob", email, "password123")

	rec := doRequest(router, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": "password123",
	}, "")

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if token, _ := body["token"].(string); token == "" {
		t.Error("expected non-empty token")
	}
	user, _ := body["user"].(map[string]any)
	if user["email"] != email {
		t.Errorf("expected email=%s, got %v", email, user["email"])
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	router := setupRouter(t)
	email := uniqueEmail("loginwrong")
	mustRegister(t, router, "Carol", email, "correctPass123")

	rec := doRequest(router, http.MethodPost, "/auth/login", map[string]string{
		"email": email, "password": "wrongpassword",
	}, "")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestLogin_MissingFields(t *testing.T) {
	router := setupRouter(t)

	cases := []struct {
		name      string
		body      map[string]string
		wantField string
	}{
		{"missing email", map[string]string{"password": "password123"}, "email"},
		{"missing password", map[string]string{"email": "x@example.com"}, "password"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doRequest(router, http.MethodPost, "/auth/login", tc.body, "")
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d", rec.Code)
			}
			body := decode(t, rec)
			fields, _ := body["fields"].(map[string]any)
			if _, ok := fields[tc.wantField]; !ok {
				t.Errorf("expected fields.%s, got: %v", tc.wantField, fields)
			}
		})
	}
}

// ── Project tests ─────────────────────────────────────────────────────────────

func TestProjects_CreateAndList(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Dave", uniqueEmail("projlist"), "password123")

	// List should be empty initially
	rec := doRequest(router, http.MethodGet, "/projects", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", rec.Code)
	}
	var initial []any
	json.NewDecoder(rec.Body).Decode(&initial)
	// (may contain other test projects — just ensure no error)

	// Create
	projectID := mustCreateProject(t, router, token, "Test Project")

	// List again — should include new project
	rec = doRequest(router, http.MethodGet, "/projects", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("list after create: expected 200, got %d", rec.Code)
	}
	var projects []map[string]any
	json.NewDecoder(rec.Body).Decode(&projects)

	found := false
	for _, p := range projects {
		if p["id"] == projectID {
			found = true
			if p["name"] != "Test Project" {
				t.Errorf("expected name=Test Project, got %v", p["name"])
			}
			break
		}
	}
	if !found {
		t.Errorf("created project %s not found in list", projectID)
	}
}

func TestProjects_CreateValidation(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Eve", uniqueEmail("projval"), "password123")

	rec := doRequest(router, http.MethodPost, "/projects", map[string]string{"name": ""}, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	body := decode(t, rec)
	fields, _ := body["fields"].(map[string]any)
	if _, ok := fields["name"]; !ok {
		t.Errorf("expected fields.name, got: %v", fields)
	}
}

func TestProjects_GetDetail(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Frank", uniqueEmail("projget"), "password123")
	projectID := mustCreateProject(t, router, token, "Detail Project")
	mustCreateTask(t, router, token, projectID, "Task One")

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID, nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)

	proj, _ := body["project"].(map[string]any)
	if proj["id"] != projectID {
		t.Errorf("expected project.id=%s, got %v", projectID, proj["id"])
	}

	tasks, _ := body["tasks"].([]any)
	if len(tasks) == 0 {
		t.Error("expected at least one task")
	}

	members, _ := body["members"].([]any)
	if len(members) == 0 {
		t.Error("expected creator to be in members")
	}
}

func TestProjects_GetForbiddenForNonMember(t *testing.T) {
	router := setupRouter(t)
	ownerToken := mustRegister(t, router, "Grace", uniqueEmail("owner"), "password123")
	otherToken := mustRegister(t, router, "Hank", uniqueEmail("nonmember"), "password123")

	projectID := mustCreateProject(t, router, ownerToken, "Private Project")

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID, nil, otherToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestProjects_Update_AsAdmin(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Ivan", uniqueEmail("projupd"), "password123")
	projectID := mustCreateProject(t, router, token, "Old Name")

	rec := doRequest(router, http.MethodPatch, "/projects/"+projectID, map[string]string{
		"name": "New Name", "description": "Updated",
	}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["name"] != "New Name" {
		t.Errorf("expected name=New Name, got %v", body["name"])
	}
}

func TestProjects_Update_AsMember(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "Jane", uniqueEmail("jadmin"), "password123")
	memberEmail := uniqueEmail("jmember")
	memberToken := mustRegister(t, router, "Kim", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Shared Project")

	// Add Kim as member (non-admin)
	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	addRec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)
	if addRec.Code != http.StatusCreated {
		t.Fatalf("add member: expected 201, got %d: %s", addRec.Code, addRec.Body.String())
	}

	rec := doRequest(router, http.MethodPatch, "/projects/"+projectID, map[string]string{
		"name": "Hacked Name",
	}, memberToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestProjects_Delete_AsAdmin(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Leo", uniqueEmail("projdel"), "password123")
	projectID := mustCreateProject(t, router, token, "To Delete")

	rec := doRequest(router, http.MethodDelete, "/projects/"+projectID, nil, token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}

	// Subsequent GET should return 403 (membership gone with project)
	rec = doRequest(router, http.MethodGet, "/projects/"+projectID, nil, token)
	if rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
		t.Fatalf("expected 403 or 404 after delete, got %d", rec.Code)
	}
}

func TestProjects_Delete_AsMember(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "Mia", uniqueEmail("madmin"), "password123")
	memberEmail := uniqueEmail("mmember")
	memberToken := mustRegister(t, router, "Ned", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Protected Project")

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	rec := doRequest(router, http.MethodDelete, "/projects/"+projectID, nil, memberToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestProjects_Stats(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Olivia", uniqueEmail("stats"), "password123")
	projectID := mustCreateProject(t, router, token, "Stats Project")

	mustCreateTask(t, router, token, projectID, "Todo Task")
	taskID := mustCreateTask(t, router, token, projectID, "Done Task")

	// Move one task to done
	doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]string{"status": "done"}, token)

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/stats", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	byStatus, _ := body["by_status"].([]any)
	if len(byStatus) == 0 {
		t.Error("expected by_status array in stats")
	}
}

// ── Task tests ────────────────────────────────────────────────────────────────

func TestTasks_CreateAndList(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Pat", uniqueEmail("tasks"), "password123")
	projectID := mustCreateProject(t, router, token, "Task Project")

	taskID := mustCreateTask(t, router, token, projectID, "My Task")

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/tasks", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var tasks []map[string]any
	json.NewDecoder(rec.Body).Decode(&tasks)

	found := false
	for _, task := range tasks {
		if task["id"] == taskID {
			found = true
			if task["title"] != "My Task" {
				t.Errorf("expected title=My Task, got %v", task["title"])
			}
			if task["status"] != "todo" {
				t.Errorf("expected default status=todo, got %v", task["status"])
			}
			if task["priority"] != "medium" {
				t.Errorf("expected default priority=medium, got %v", task["priority"])
			}
			break
		}
	}
	if !found {
		t.Errorf("task %s not found in list", taskID)
	}
}

func TestTasks_CreateWithAllFields(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Quinn", uniqueEmail("tasksall"), "password123")
	projectID := mustCreateProject(t, router, token, "Full Task Project")

	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/tasks", map[string]any{
		"title":       "Full Task",
		"description": "A detailed task",
		"status":      "in_progress",
		"priority":    "high",
		"due_date":    tomorrow,
	}, token)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["status"] != "in_progress" {
		t.Errorf("expected status=in_progress, got %v", body["status"])
	}
	if body["priority"] != "high" {
		t.Errorf("expected priority=high, got %v", body["priority"])
	}
}

func TestTasks_CreateValidation(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Ray", uniqueEmail("taskval"), "password123")
	projectID := mustCreateProject(t, router, token, "Validation Project")

	cases := []struct {
		name      string
		body      map[string]any
		wantField string
	}{
		{
			name:      "missing title",
			body:      map[string]any{"title": ""},
			wantField: "title",
		},
		{
			name:      "invalid status",
			body:      map[string]any{"title": "T", "status": "backlog"},
			wantField: "status",
		},
		{
			name:      "invalid priority",
			body:      map[string]any{"title": "T", "priority": "critical"},
			wantField: "priority",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/tasks", tc.body, token)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
			}
			body := decode(t, rec)
			fields, _ := body["fields"].(map[string]any)
			if _, ok := fields[tc.wantField]; !ok {
				t.Errorf("expected fields.%s, got: %v", tc.wantField, fields)
			}
		})
	}
}

func TestTasks_FilterByStatus(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Sam", uniqueEmail("taskfilter"), "password123")
	projectID := mustCreateProject(t, router, token, "Filter Project")

	mustCreateTask(t, router, token, projectID, "Todo Task")
	doneID := mustCreateTask(t, router, token, projectID, "Done Task")
	doRequest(router, http.MethodPatch, "/tasks/"+doneID, map[string]string{"status": "done"}, token)

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/tasks?status=todo", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var tasks []map[string]any
	json.NewDecoder(rec.Body).Decode(&tasks)

	for _, task := range tasks {
		if task["status"] != "todo" {
			t.Errorf("filter returned task with status=%v, want todo", task["status"])
		}
	}
}

func TestTasks_FilterByUnassigned(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Tara", uniqueEmail("unassigned"), "password123")
	projectID := mustCreateProject(t, router, token, "Unassigned Project")

	mustCreateTask(t, router, token, projectID, "No Assignee")

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/tasks?assignee=unassigned", nil, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var tasks []map[string]any
	json.NewDecoder(rec.Body).Decode(&tasks)

	for _, task := range tasks {
		if task["assignee_id"] != nil {
			t.Errorf("unassigned filter returned task with assignee_id=%v", task["assignee_id"])
		}
	}
}

func TestTasks_Update(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Uma", uniqueEmail("taskupd"), "password123")
	projectID := mustCreateProject(t, router, token, "Update Project")
	taskID := mustCreateTask(t, router, token, projectID, "Original Title")

	rec := doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]any{
		"title":    "Updated Title",
		"status":   "in_progress",
		"priority": "high",
	}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["title"] != "Updated Title" {
		t.Errorf("expected title=Updated Title, got %v", body["title"])
	}
	if body["status"] != "in_progress" {
		t.Errorf("expected status=in_progress, got %v", body["status"])
	}
}

func TestTasks_UpdateEmptyTitle(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Vic", uniqueEmail("taskempty"), "password123")
	projectID := mustCreateProject(t, router, token, "Empty Title Project")
	taskID := mustCreateTask(t, router, token, projectID, "Original")

	rec := doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]string{"title": "  "}, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	body := decode(t, rec)
	fields, _ := body["fields"].(map[string]any)
	if _, ok := fields["title"]; !ok {
		t.Errorf("expected fields.title, got: %v", fields)
	}
}

func TestTasks_UpdateDueDate(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Wes", uniqueEmail("taskdate"), "password123")
	projectID := mustCreateProject(t, router, token, "Due Date Project")
	taskID := mustCreateTask(t, router, token, projectID, "Dated Task")

	// Set a due date
	future := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	rec := doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]string{"due_date": future}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("set due_date: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Clear the due date
	rec = doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]string{"due_date": ""}, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("clear due_date: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["due_date"] != nil {
		t.Errorf("expected due_date=nil after clear, got %v", body["due_date"])
	}
}

func TestTasks_UpdateInvalidDueDate(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Xena", uniqueEmail("taskbaddate"), "password123")
	projectID := mustCreateProject(t, router, token, "Bad Date Project")
	taskID := mustCreateTask(t, router, token, projectID, "Task")

	rec := doRequest(router, http.MethodPatch, "/tasks/"+taskID, map[string]string{"due_date": "not-a-date"}, token)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
	body := decode(t, rec)
	fields, _ := body["fields"].(map[string]any)
	if _, ok := fields["due_date"]; !ok {
		t.Errorf("expected fields.due_date, got: %v", fields)
	}
}

func TestTasks_NonMemberCannotList(t *testing.T) {
	router := setupRouter(t)
	ownerToken := mustRegister(t, router, "Yara", uniqueEmail("taskowner"), "password123")
	outsiderToken := mustRegister(t, router, "Zack", uniqueEmail("taskoutsider"), "password123")
	projectID := mustCreateProject(t, router, ownerToken, "Private Tasks Project")
	mustCreateTask(t, router, ownerToken, projectID, "Secret Task")

	rec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/tasks", nil, outsiderToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestTasks_DeleteAsAdmin(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "AdminDel", uniqueEmail("admindel"), "password123")
	projectID := mustCreateProject(t, router, token, "Delete Tasks Project")
	taskID := mustCreateTask(t, router, token, projectID, "Temporary Task")

	rec := doRequest(router, http.MethodDelete, "/tasks/"+taskID, nil, token)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}

	// Task should no longer appear
	listRec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/tasks", nil, token)
	var tasks []map[string]any
	json.NewDecoder(listRec.Body).Decode(&tasks)
	for _, task := range tasks {
		if task["id"] == taskID {
			t.Error("deleted task still appears in list")
		}
	}
}

func TestTasks_DeleteAsMember(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "AdminKeep", uniqueEmail("admkeep"), "password123")
	memberEmail := uniqueEmail("memkeep")
	memberToken := mustRegister(t, router, "MemKeep", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Member Delete Project")
	taskID := mustCreateTask(t, router, adminToken, projectID, "Protected Task")

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	rec := doRequest(router, http.MethodDelete, "/tasks/"+taskID, nil, memberToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestTasks_UpdateNonExistent(t *testing.T) {
	router := setupRouter(t)
	token := mustRegister(t, router, "Ghost", uniqueEmail("ghost"), "password123")

	rec := doRequest(router, http.MethodPatch, "/tasks/00000000-0000-0000-0000-000000000099", map[string]string{
		"status": "done",
	}, token)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

// ── Member tests ──────────────────────────────────────────────────────────────

func TestMembers_AddAndList(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "Adm", uniqueEmail("addmem"), "password123")
	memberEmail := uniqueEmail("newmem")
	memberToken := mustRegister(t, router, "Mem", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Member Project")
	_ = memberToken

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")

	rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["role"] != "member" {
		t.Errorf("expected role=member, got %v", body["role"])
	}

	// List members
	listRec := doRequest(router, http.MethodGet, "/projects/"+projectID+"/members", nil, adminToken)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list members: expected 200, got %d", listRec.Code)
	}
	var members []map[string]any
	json.NewDecoder(listRec.Body).Decode(&members)
	found := false
	for _, m := range members {
		if m["user_id"] == memberID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("added member %s not found in list", memberID)
	}
}

func TestMembers_AddDuplicate(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "DupAdm", uniqueEmail("dupadm"), "password123")
	dupEmail := uniqueEmail("dupuser")
	mustRegister(t, router, "DupUser", dupEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Dup Member Project")

	memberID := getUserIDFromToken(t, router, dupEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	// Add again → conflict
	rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}

func TestMembers_NonAdminCannotAdd(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "RealAdm", uniqueEmail("realadm"), "password123")
	memberEmail := uniqueEmail("regmem")
	memberToken := mustRegister(t, router, "RegMem", memberEmail, "password123")
	outsiderEmail := uniqueEmail("outsider")
	mustRegister(t, router, "Outsider", outsiderEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Access Control Project")

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	outsiderID := getUserIDFromToken(t, router, outsiderEmail, "password123")
	rec := doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": outsiderID, "role": "member",
	}, memberToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}

func TestMembers_RemoveLastAdmin(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "LastAdm", uniqueEmail("lastadm"), "password123")
	adminEmail := uniqueEmail("lastadm2")
	mustRegister(t, router, "SameAdm", adminEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Last Admin Project")
	adminID := getUserIDFromToken(t, router, adminEmail, "password123")

	// The creator is already the only admin — try to remove them
	rec := doRequest(router, http.MethodDelete, "/projects/"+projectID+"/members/"+adminID, nil, adminToken)
	// adminID is not a member yet, expect 404
	if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 404 or 400, got %d", rec.Code)
	}

	// Get creator's own ID and attempt to self-remove as last admin
	selfEmail := uniqueEmail("selfadm")
	selfToken := mustRegister(t, router, "SelfAdm", selfEmail, "password123")
	selfProjectID := mustCreateProject(t, router, selfToken, "Self Admin Project")
	selfID := getUserIDFromToken(t, router, selfEmail, "password123")

	rec = doRequest(router, http.MethodDelete, "/projects/"+selfProjectID+"/members/"+selfID, nil, selfToken)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 (cannot remove last admin), got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMembers_UpdateRole(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "RoleAdm", uniqueEmail("roleadm"), "password123")
	memberEmail := uniqueEmail("rolemem")
	mustRegister(t, router, "RoleMem", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Role Update Project")

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	// Promote to admin
	rec := doRequest(router, http.MethodPatch, "/projects/"+projectID+"/members/"+memberID, map[string]string{
		"role": "admin",
	}, adminToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	if body["role"] != "admin" {
		t.Errorf("expected role=admin after promote, got %v", body["role"])
	}
}

func TestMembers_UpdateRoleInvalidValue(t *testing.T) {
	router := setupRouter(t)
	adminToken := mustRegister(t, router, "BadRole", uniqueEmail("badrole"), "password123")
	memberEmail := uniqueEmail("badrolemem")
	mustRegister(t, router, "BadMem", memberEmail, "password123")
	projectID := mustCreateProject(t, router, adminToken, "Bad Role Project")

	memberID := getUserIDFromToken(t, router, memberEmail, "password123")
	doRequest(router, http.MethodPost, "/projects/"+projectID+"/members", map[string]string{
		"user_id": memberID, "role": "member",
	}, adminToken)

	rec := doRequest(router, http.MethodPatch, "/projects/"+projectID+"/members/"+memberID, map[string]string{
		"role": "superadmin",
	}, adminToken)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
