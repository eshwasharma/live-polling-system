package routes

import (
	"os"

	"live-polling-backend/controllers"
	"live-polling-backend/middleware"

	"github.com/gin-gonic/gin"
)

func AuthRoutes(router *gin.Engine) {
	auth := router.Group("/api/auth")

	auth.POST("/signup", controllers.Signup)
	auth.POST("/login", controllers.Login)

	auth.GET("/me", middleware.RequireAuth(os.Getenv("JWT_SECRET")), controllers.GetCurrentUser)
}