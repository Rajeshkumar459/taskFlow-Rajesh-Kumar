package api

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"taskflow/internal/api/handlers"
	"taskflow/internal/auth"
	"taskflow/internal/db"
	"taskflow/internal/events"
)

func NewRouter(database *db.DB, broker *events.Broker, jwtSecret string) http.Handler {
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// CORS — allow the React frontend
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	authH := handlers.NewAuthHandler(database, jwtSecret)
	projectH := handlers.NewProjectHandler(database)
	taskH := handlers.NewTaskHandler(database, broker)
	memberH := handlers.NewMemberHandler(database, broker)
	sseH := handlers.NewSSEHandler(database, broker, jwtSecret)
	userH := handlers.NewUserHandler(database)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public auth routes
	a := r.Group("/auth")
	{
		a.POST("/register", authH.Register)
		a.POST("/login", authH.Login)
	}

	// SSE endpoint — auth via ?token= query param (EventSource can't set headers)
	r.GET("/projects/:id/events", sseH.Subscribe)

	// Protected routes — require valid JWT
	protected := r.Group("/")
	protected.Use(auth.Middleware(jwtSecret))
	{
		protected.GET("/projects", projectH.List)
		protected.POST("/projects", projectH.Create)
		protected.GET("/projects/:id", projectH.Get)
		protected.PATCH("/projects/:id", projectH.Update)
		protected.DELETE("/projects/:id", projectH.Delete)
		protected.GET("/projects/:id/stats", projectH.Stats)

		protected.GET("/projects/:id/tasks", taskH.List)
		protected.POST("/projects/:id/tasks", taskH.Create)

		protected.PATCH("/tasks/:id", taskH.Update)
		protected.DELETE("/tasks/:id", taskH.Delete)

		protected.GET("/projects/:id/members", memberH.List)
		protected.POST("/projects/:id/members", memberH.Add)
		protected.PATCH("/projects/:id/members/:userId", memberH.UpdateRole)
		protected.DELETE("/projects/:id/members/:userId", memberH.Remove)

		protected.GET("/users", userH.List)
	}

	return r
}
