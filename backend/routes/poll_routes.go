package routes

import (
	"os"

	"live-polling-backend/controllers"
	"live-polling-backend/middleware"

	"github.com/gin-gonic/gin"
)

func PollRoutes(router *gin.Engine) {
	auth := middleware.RequireAuth(os.Getenv("JWT_SECRET"))

	// Creator routes: login is required.
	pollGroup := router.Group("/api/polls")
	pollGroup.Use(auth)
	{
		pollGroup.POST("/", controllers.CreatePoll)
		pollGroup.GET("/", controllers.GetAllPolls)

		// Poll management routes also verify poll ownership.
		owned := pollGroup.Group("/:id")
		owned.Use(middleware.RequirePollOwner(controllers.PollCollection))
		{
			owned.POST("/pause", controllers.PausePoll)
			owned.POST("/resume", controllers.ResumePoll)
			owned.POST("/end", controllers.EndPoll)
			owned.POST("/restart", controllers.RestartPoll)
			owned.PUT("/settings", controllers.UpdatePollSettings)
			owned.PUT("", controllers.UpdatePoll)
			owned.POST("/duplicate", controllers.DuplicatePoll)
			owned.DELETE("", controllers.DeletePoll)
		}
	}

	// Public routes: participants do not need creator accounts.
	publicPolls := router.Group("/api/polls")
	{
		publicPolls.GET("/:id", controllers.GetPollByID)
		publicPolls.POST("/:id/votes", controllers.SubmitVote)
		publicPolls.GET("/:id/results", controllers.GetPollResults)
		publicPolls.GET("/:id/ws", controllers.PollWebSocket)
	}

	// AI poll generation is a creator feature.
	aiGroup := router.Group("/api/ai")
	aiGroup.Use(auth)
	{
		aiGroup.POST("/generate-poll", controllers.GenerateAIPoll)
	}
}