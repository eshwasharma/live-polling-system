
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
	}
}
