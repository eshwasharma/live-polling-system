package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	// Create a Gin router
	router := gin.Default()

	// Health-check API
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "PulsePoll backend is running!",
		})
	})

	// Start the server on port 5000
	err := router.Run(":5000")

	if err != nil {
		panic(err)
	}
}