package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"taskflow/internal/auth"
	"taskflow/internal/db"
)

type ProjectHandler struct {
	db *db.DB
}

func NewProjectHandler(database *db.DB) *ProjectHandler {
	return &ProjectHandler{db: database}
}

// GET /projects — list projects the user is a member of
func (h *ProjectHandler) List(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projects, err := h.db.GetProjectsByUser(c.Request.Context(), userID)
	if err != nil {
		slog.Error("list projects", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if projects == nil {
		projects = []db.Project{}
	}
	c.JSON(http.StatusOK, projects)
}

// POST /projects — create project; creator is automatically an admin member
func (h *ProjectHandler) Create(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"fields": gin.H{"name": "is required"},
		})
		return
	}

	project, err := h.db.CreateProjectWithOwner(c.Request.Context(), req.Name, req.Description, userID)
	if err != nil {
		slog.Error("create project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, project)
}

// GET /projects/:id — project + tasks + members (for the detail page)
func (h *ProjectHandler) Get(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	// Membership check (also verifies project exists)
	if _, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for project get", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	project, err := h.db.GetProjectByID(c.Request.Context(), projectID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("get project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	tasks, err := h.db.GetTasksByProject(c.Request.Context(), projectID, db.TaskFilter{})
	if err != nil {
		slog.Error("get tasks for project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	members, err := h.db.GetProjectMembers(c.Request.Context(), projectID)
	if err != nil {
		slog.Error("get members for project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if tasks == nil {
		tasks = []db.Task{}
	}
	if members == nil {
		members = []db.ProjectMember{}
	}

	c.JSON(http.StatusOK, gin.H{
		"project": project,
		"tasks":   tasks,
		"members": members,
	})
}

// PATCH /projects/:id — admin only
func (h *ProjectHandler) Update(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	member, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for project update", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if member.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can update the project"})
		return
	}

	project, err := h.db.GetProjectByID(c.Request.Context(), projectID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("get project for update", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	name := project.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":  "validation failed",
				"fields": gin.H{"name": "must not be empty"},
			})
			return
		}
	}

	description := project.Description
	if req.Description != nil {
		description = req.Description
	}

	updated, err := h.db.UpdateProject(c.Request.Context(), projectID, name, description)
	if err != nil {
		slog.Error("update project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DELETE /projects/:id — admin only
func (h *ProjectHandler) Delete(c *gin.Context) {
	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	member, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get member for project delete", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if member.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can delete the project"})
		return
	}

	if err := h.db.DeleteProject(c.Request.Context(), projectID); err != nil {
		slog.Error("delete project", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GET /projects/:id/stats
func (h *ProjectHandler) Stats(c *gin.Context) {
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
		slog.Error("get member for stats", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	stats, err := h.db.GetProjectStats(c.Request.Context(), projectID)
	if err != nil {
		slog.Error("get project stats", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, stats)
}
