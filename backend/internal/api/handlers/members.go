package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"taskflow/internal/auth"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

type MemberHandler struct {
	db     *db.DB
	broker *events.Broker
}

func NewMemberHandler(database *db.DB, broker *events.Broker) *MemberHandler {
	return &MemberHandler{db: database, broker: broker}
}

// GET /projects/:id/members
func (h *MemberHandler) List(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	userID := c.MustGet(auth.ContextUserID).(uuid.UUID)
	if _, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get project member for list", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	members, err := h.db.GetProjectMembers(c.Request.Context(), projectID)
	if err != nil {
		slog.Error("list members", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if members == nil {
		members = []db.ProjectMember{}
	}
	c.JSON(http.StatusOK, members)
}

// POST /projects/:id/members
// Body: { "user_id": "...", "role": "admin"|"member" }
func (h *MemberHandler) Add(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	requesterID := c.MustGet(auth.ContextUserID).(uuid.UUID)
	requester, err := h.db.GetProjectMember(c.Request.Context(), projectID, requesterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get requester membership for add", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if requester.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can add members"})
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	targetID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"fields": gin.H{"user_id": "is invalid"},
		})
		return
	}

	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "admin" && req.Role != "member" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"fields": gin.H{"role": "must be admin or member"},
		})
		return
	}

	member, err := h.db.AddProjectMember(c.Request.Context(), projectID, targetID, req.Role)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "user is already a member"})
			return
		}
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		slog.Error("add project member", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(projectID.String(), "member_added", member)
	c.JSON(http.StatusCreated, member)
}

// PATCH /projects/:id/members/:userId
// Body: { "role": "admin"|"member" }
func (h *MemberHandler) UpdateRole(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	requesterID := c.MustGet(auth.ContextUserID).(uuid.UUID)
	requester, err := h.db.GetProjectMember(c.Request.Context(), projectID, requesterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get requester membership for update role", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if requester.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can change roles"})
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Role != "admin" && req.Role != "member" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"fields": gin.H{"role": "must be admin or member"},
		})
		return
	}

	// Prevent downgrading if target is the last admin
	if req.Role == "member" {
		target, err := h.db.GetProjectMember(c.Request.Context(), projectID, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			slog.Error("get target membership for role update", "err", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if target.Role == "admin" {
			count, err := h.db.CountProjectAdmins(c.Request.Context(), projectID)
			if err != nil {
				slog.Error("count admins", "err", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
				return
			}
			if count <= 1 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the last admin"})
				return
			}
		}
	}

	updated, err := h.db.UpdateMemberRole(c.Request.Context(), projectID, targetID, req.Role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("update member role", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(projectID.String(), "member_updated", updated)
	c.JSON(http.StatusOK, updated)
}

// DELETE /projects/:id/members/:userId
func (h *MemberHandler) Remove(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	requesterID := c.MustGet(auth.ContextUserID).(uuid.UUID)
	requester, err := h.db.GetProjectMember(c.Request.Context(), projectID, requesterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		slog.Error("get requester membership for remove", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if requester.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can remove members"})
		return
	}

	// Prevent removing last admin
	target, err := h.db.GetProjectMember(c.Request.Context(), projectID, targetID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		slog.Error("get target membership for remove", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if target.Role == "admin" {
		count, err := h.db.CountProjectAdmins(c.Request.Context(), projectID)
		if err != nil {
			slog.Error("count admins for remove", "err", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			return
		}
		if count <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot remove the last admin"})
			return
		}
	}

	if err := h.db.RemoveProjectMember(c.Request.Context(), projectID, targetID); err != nil {
		slog.Error("remove project member", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	h.broker.Publish(projectID.String(), "member_removed", gin.H{"user_id": targetID})
	c.Status(http.StatusNoContent)
}
