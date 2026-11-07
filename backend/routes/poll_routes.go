
package routes

import (
	"live-polling-backend/controllers"

	"github.com/gin-gonic/gin"
)

func PollRoutes(router *gin.Engine) {
	pollGroup := router.Group("/api/polls")
	{
		// Create a new poll
		pollGroup.POST("/", controllers.CreatePoll)

		// Retrieve all polls
		pollGroup.GET("/", controllers.GetAllPolls)

		// Retrieve a single poll by ID
		pollGroup.GET("/:id", controllers.GetPollByID)

		// Submit a vote for a poll
		pollGroup.POST("/:id/votes", controllers.SubmitVote)
	}
}
