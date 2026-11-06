
package controllers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"live-polling-backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var PollCollection *mongo.Collection

// SetPollCollection connects the controller to the MongoDB polls collection.
func SetPollCollection(collection *mongo.Collection) {
	PollCollection = collection
}

// CreatePoll saves a new poll in MongoDB.
func CreatePoll(c *gin.Context) {
	var poll models.Poll

	// Read the poll data sent by the frontend.
	if err := c.ShouldBindJSON(&poll); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll data",
		})
		return
	}

	// Validate required fields.
	if strings.TrimSpace(poll.Title) == "" ||
		strings.TrimSpace(poll.Question) == "" ||
		len(poll.Options) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Title, question, and at least two options are required",
		})
		return
	}

	// Validate and prepare options.
	for i := range poll.Options {
		poll.Options[i].Text = strings.TrimSpace(poll.Options[i].Text)

		if poll.Options[i].Text == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Poll options cannot be empty",
			})
			return
		}

		poll.Options[i].ID = bson.NewObjectID().Hex()
	}

	// Set poll details.
	now := time.Now()
	poll.ID = bson.NewObjectID()
	poll.Status = "active"
	poll.CreatedAt = now
	poll.UpdatedAt = now

	// Save poll in MongoDB.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := PollCollection.InsertOne(ctx, poll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to save poll",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Poll created successfully",
		"pollId":  result.InsertedID,
		"poll":    poll,
	})
}

// GetAllPolls retrieves all polls from MongoDB.
func GetAllPolls(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Fetch all polls, newest first.
	cursor, err := PollCollection.Find(
		ctx,
		bson.D{},
		options.Find().SetSort(bson.D{
			{Key: "createdAt", Value: -1},
		}),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve polls",
		})
		return
	}
	defer cursor.Close(ctx)

	var polls []models.Poll

	if err := cursor.All(ctx, &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to read polls",
		})
		return
	}

	if polls == nil {
		polls = []models.Poll{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(polls),
		"polls":   polls,
	})
}
