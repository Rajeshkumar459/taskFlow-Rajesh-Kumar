package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"taskflow/internal/auth"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

type SSEHandler struct {
	db        *db.DB
	broker    *events.Broker
	jwtSecret string
}

func NewSSEHandler(database *db.DB, broker *events.Broker, jwtSecret string) *SSEHandler {
	return &SSEHandler{db: database, broker: broker, jwtSecret: jwtSecret}
}

// GET /projects/:id/events?token=<jwt>
//
// EventSource cannot send custom headers, so the JWT is passed as ?token=.
func (h *SSEHandler) Subscribe(c *gin.Context) {
	// Validate token from query param
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token query param required"})
		return
	}

	claims := &auth.Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
		return
	}

	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	// Verify the user is a project member
	if _, err := h.db.GetProjectMember(c.Request.Context(), projectID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	// Subscribe to project events
	ch, unsubscribe := h.broker.Subscribe(projectID.String())
	defer unsubscribe()

	// SSE response headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // disable nginx buffering

	// Send initial connected event
	fmt.Fprintf(c.Writer, "data: {\"type\":\"connected\"}\n\n")
	c.Writer.Flush()

	// Heartbeat ticker to keep the connection alive through proxies
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			c.Writer.Flush()

		case <-ticker.C:
			// SSE comment line — ignored by browsers, keeps TCP alive
			fmt.Fprintf(c.Writer, ": heartbeat\n\n")
			c.Writer.Flush()

		case <-c.Request.Context().Done():
			return
		}
	}
}
