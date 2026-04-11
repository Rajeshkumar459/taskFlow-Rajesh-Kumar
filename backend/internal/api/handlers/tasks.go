package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"taskflow/internal/auth"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

type TaskHandler struct {
	db     *db.DB
	broker *events.Broker
}

func NewTaskHandler(database *db.DB, broker *events.Broker) *TaskHandler {
	return &TaskHandler{db: database, broker: broker}
}

// GET /projects/:id/tasks — members only; supports ?status= and ?assignee=
func (h *TaskHandler) List(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	if _, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for task list", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	filter := db.TaskFilter{}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if a := c.Query("assignee"); a != "" {
		aid, err := uuid.Parse(a)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid assignee id"})
			return
		}
		filter.AssigneeID = &aid
	}

	tasks, err := h.db.GetTasksByProject(c.Request.Context(), projectID, filter)
	if err != nil {
		slog.Error("list tasks", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if tasks == nil {
		tasks = []db.Task{}
	}
	c.JSON(http.StatusOK, tasks)
}

// POST /projects/:id/tasks — any member can create
func (h *TaskHandler) Create(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	if _, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for task create", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var req struct {
		Title       string  `json:"title"`
		Description *string `json:"description"`
		Status      string  `json:"status"`
		Priority    string  `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	fields := gin.H{}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		fields["title"] = "is required"
	}
	if req.Status == "" {
		req.Status = "todo"
	} else if req.Status != "todo" && req.Status != "in_progress" && req.Status != "done" {
		fields["status"] = "must be todo, in_progress, or done"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	} else if req.Priority != "low" && req.Priority != "medium" && req.Priority != "high" {
		fields["priority"] = "must be low, medium, or high"
	}
	if len(fields) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "fields": fields})
		return
	}

	input := db.CreateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Priority:    req.Priority,
		ProjectID:   projectID,
	}

	if req.AssigneeID != nil {
		aid, err := uuid.Parse(*req.AssigneeID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":  "validation failed",
				"fields": gin.H{"assignee_id": "is invalid"},
			})
			return
		}
		input.AssigneeID = &aid
	}
	if req.DueDate != nil {
		t, err := time.Parse("2006-01-02", *req.DueDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":  "validation failed",
				"fields": gin.H{"due_date": "must be in YYYY-MM-DD format"},
			})
			return
		}
		input.DueDate = &t
	}

	task, err := h.db.CreateTask(c.Request.Context(), input)
	if err != nil {
		slog.Error("create task", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(projectID.String(), "task_created", task)
	c.JSON(http.StatusCreated, task)
}

// PATCH /tasks/:id — any member can edit any task
func (h *TaskHandler) Update(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	task, err := h.db.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("get task for update", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Any project member can update tasks
	if _, err := h.db.GetProjectMember(c.Request.Context(), task.ProjectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for task update", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		Priority    *string `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	fields := gin.H{}
	if req.Title != nil {
		*req.Title = strings.TrimSpace(*req.Title)
		if *req.Title == "" {
			fields["title"] = "must not be empty"
		}
	}
	if req.Status != nil && *req.Status != "todo" && *req.Status != "in_progress" && *req.Status != "done" {
		fields["status"] = "must be todo, in_progress, or done"
	}
	if req.Priority != nil && *req.Priority != "low" && *req.Priority != "medium" && *req.Priority != "high" {
		fields["priority"] = "must be low, medium, or high"
	}
	if len(fields) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "fields": fields})
		return
	}

	input := db.UpdateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Priority:    req.Priority,
	}
	if req.AssigneeID != nil {
		if *req.AssigneeID == "" {
			input.ClearAssignee = true
		} else {
			aid, err := uuid.Parse(*req.AssigneeID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":  "validation failed",
					"fields": gin.H{"assignee_id": "is invalid"},
				})
				return
			}
			input.AssigneeID = &aid
		}
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			input.ClearDueDate = true
		} else {
			t, err := time.Parse("2006-01-02", *req.DueDate)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":  "validation failed",
					"fields": gin.H{"due_date": "must be in YYYY-MM-DD format"},
				})
				return
			}
			input.DueDate = &t
		}
	}

	updated, err := h.db.UpdateTask(c.Request.Context(), taskID, input)
	if err != nil {
		slog.Error("update task", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(updated.ProjectID.String(), "task_updated", updated)
	c.JSON(http.StatusOK, updated)
}

// DELETE /tasks/:id — admin only
func (h *TaskHandler) Delete(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	task, err := h.db.GetTaskByID(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("get task for delete", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	member, err := h.db.GetProjectMember(c.Request.Context(), task.ProjectID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for task delete", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if member.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can delete tasks"})
		return
	}

	if err := h.db.DeleteTask(c.Request.Context(), taskID); err != nil {
		slog.Error("delete task", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(task.ProjectID.String(), "task_deleted", gin.H{"task_id": taskID})
	c.Status(http.StatusNoContent)
}
