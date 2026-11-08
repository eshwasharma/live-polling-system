package routes

import (
	"live-polling-backend/controllers"

	"github.com/gin-gonic/gin"
)

func PollRoutes(router *gin.Engine) {
	pollGroup := router.Group("/api/polls")
	{
		pollGroup.POST("/", controllers.CreatePoll)
		pollGroup.GET("/", controllers.GetAllPolls)
		pollGroup.GET("/:id", controllers.GetPollByID)
		pollGroup.POST("/:id/votes", controllers.SubmitVote)
		pollGroup.POST("/:id/end", controllers.EndPoll)
		pollGroup.GET("/:id/results", controllers.GetPollResults)

		// WebSocket route for live poll updates
		pollGroup.GET("/:id/ws", controllers.PollWebSocket)
	}
}
