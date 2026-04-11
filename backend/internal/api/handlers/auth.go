package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"taskflow/internal/auth"
	"taskflow/internal/db"
)

type AuthHandler struct {
	db        *db.DB
	jwtSecret string
}

func NewAuthHandler(database *db.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{db: database, jwtSecret: jwtSecret}
}

// POST /auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	fields := gin.H{}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Name == "" {
		fields["name"] = "is required"
	}
	if req.Email == "" {
		fields["email"] = "is required"
	} else if !strings.Contains(req.Email, "@") {
		fields["email"] = "is invalid"
	}
	if req.Password == "" {
		fields["password"] = "is required"
	} else if len(req.Password) < 8 {
		fields["password"] = "must be at least 8 characters"
	}
	if len(fields) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "fields": fields})
		return
	}

	// Check for duplicate email
	if existing, _ := h.db.GetUserByEmail(c.Request.Context(), req.Email); existing != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "validation failed",
			"fields": gin.H{"email": "is already taken"},
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		slog.Error("bcrypt error", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	user, err := h.db.CreateUser(c.Request.Context(), req.Name, req.Email, string(hash))
	if err != nil {
		slog.Error("create user", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	token, err := generateToken(user.ID.String(), user.Email, h.jwtSecret)
	if err != nil {
		slog.Error("generate token", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "name": user.Name, "email": user.Email},
	})
}

// POST /auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	fields := gin.H{}
	if req.Email == "" {
		fields["email"] = "is required"
	}
	if req.Password == "" {
		fields["password"] = "is required"
	}
	if len(fields) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "fields": fields})
		return
	}

	user, err := h.db.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		slog.Error("get user by email", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	token, err := generateToken(user.ID.String(), user.Email, h.jwtSecret)
	if err != nil {
		slog.Error("generate token", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "name": user.Name, "email": user.Email},
	})
}

func generateToken(userID, email, secret string) (string, error) {
	claims := auth.Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
