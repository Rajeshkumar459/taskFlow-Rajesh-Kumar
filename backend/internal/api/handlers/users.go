package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"taskflow/internal/db"
)

type UserHandler struct {
	db *db.DB
}

func NewUserHandler(database *db.DB) *UserHandler {
	return &UserHandler{db: database}
}

// GET /users
func (h *UserHandler) List(c *gin.Context) {
	users, err := h.db.GetAllUsers(c.Request.Context())
	if err != nil {
		slog.Error("list users", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}
	if users == nil {
		users = []db.User{}
	}
	c.JSON(http.StatusOK, users)
}
