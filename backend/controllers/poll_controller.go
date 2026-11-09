package controllers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"live-polling-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var PollCollection *mongo.Collection
var VoteCollection *mongo.Collection
var RedisClient *redis.Client

// SetPollCollection connects the controller to the MongoDB polls collection.
func SetPollCollection(collection *mongo.Collection) {
	PollCollection = collection
}

// SetVoteCollection connects the controller to the MongoDB votes collection.
func SetVoteCollection(collection *mongo.Collection) {
	VoteCollection = collection
}

// SetRedisClient connects the controller to Redis.
func SetRedisClient(client *redis.Client) {
	RedisClient = client
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

	
// Set poll details and validate the schedule.
now := time.Now()

// The end time must be later than the start time.
if poll.StartTime != nil && poll.EndTime != nil {
	if !poll.EndTime.After(*poll.StartTime) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Poll end time must be later than its start time",
		})
		return
	}
}

// Do not allow a poll to be created with an end time in the past.
if poll.EndTime != nil && !poll.EndTime.After(now) {
	c.JSON(http.StatusBadRequest, gin.H{
		"success": false,
		"message": "Poll end time must be in the future",
	})
	return
}

// Generate poll ID.
poll.ID = bson.NewObjectID()

// Future start time means the poll is scheduled.
// Otherwise, the poll becomes active immediately.
poll.Status = "active"

if poll.StartTime != nil && poll.StartTime.After(now) {
	poll.Status = "scheduled"
}

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

	// Prepare polls with their actual vote counts.
	type PollWithVotes struct {
		models.Poll
		Votes int64 `json:"votes"`
	}

	pollsWithVotes := make([]PollWithVotes, 0, len(polls))

	// Count votes for every poll from MongoDB.
	for _, poll := range polls {
		voteCount, err := VoteCollection.CountDocuments(
			ctx,
			bson.M{"pollId": poll.ID},
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to retrieve poll vote counts",
			})
			return
		}

		pollsWithVotes = append(pollsWithVotes, PollWithVotes{
			Poll:  poll,
			Votes: voteCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(pollsWithVotes),
		"polls":   pollsWithVotes,
	})
}


// GetPollByID retrieves a single poll using its MongoDB ID.
func GetPollByID(c *gin.Context) {
	// Get the poll ID from the URL.
	pollID := c.Param("id")

	// Validate the MongoDB ObjectID.
	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	// Set a timeout for the database request.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Find the poll in MongoDB.
	var poll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve poll",
		})
		return
	}

	// Return the poll details.
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"poll":    poll,
	})
}

// VoteRequest represents the data received when an audience member votes.
type VoteRequest struct {
	OptionIDs []string `json:"optionIds"`
	VoterID   string   `json:"voterId"`
}

// VoteEvent represents a notification published through Redis.
type VoteEvent struct {
	Type      string   `json:"type"`
	PollID    string   `json:"pollId"`
	OptionIDs []string `json:"optionIds"`
}

// SubmitVote validates and saves an audience vote in MongoDB.
func SubmitVote(c *gin.Context) {
	// Get poll ID from URL.
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	// Read submitted vote.
	var request VoteRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid vote data",
		})
		return
	}

	request.VoterID = strings.TrimSpace(request.VoterID)

	if request.VoterID == "" || len(request.OptionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Voter ID and at least one option are required",
		})
		return
	}

	// Set database request timeout.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Find the poll.
	var poll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve poll",
		})
		return
	}

	
	// Check whether the poll is active and within its scheduled time.
	now := time.Now()

	if poll.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This poll is not accepting votes",
		})
		return
	}

	if poll.StartTime != nil && now.Before(*poll.StartTime) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This poll has not started yet",
		})
		return
	}

	if poll.EndTime != nil && !now.Before(*poll.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This poll has ended",
		})
		return
	}


	// Check single-choice and multiple-choice settings.
	if !poll.Settings.AllowMultipleAnswers && len(request.OptionIDs) != 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Please select only one option",
		})
		return
	}

	// Check that every selected option belongs to this poll.
	validOptions := make(map[string]bool)

	for _, option := range poll.Options {
		validOptions[option.ID] = true
	}

	selectedOptions := make(map[string]bool)

	for _, optionID := range request.OptionIDs {
		if !validOptions[optionID] {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid poll option selected",
			})
			return
		}

		if selectedOptions[optionID] {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Duplicate options are not allowed",
			})
			return
		}

		selectedOptions[optionID] = true
	}

	// Check whether this browser has already voted.
	var existingVote models.Vote

	err = VoteCollection.FindOne(
		ctx,
		bson.M{
			"pollId":  objectID,
			"voterId": request.VoterID,
		},
	).Decode(&existingVote)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"message": "You have already voted in this poll",
		})
		return
	}

	if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to check previous vote",
		})
		return
	}

	// Create the vote document.
	vote := models.Vote{
		ID:        bson.NewObjectID(),
		PollID:    objectID,
		OptionIDs: request.OptionIDs,
		VoterID:   request.VoterID,
		CreatedAt: time.Now(),
	}

	// Save vote permanently in MongoDB first.
	_, err = VoteCollection.InsertOne(ctx, vote)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to save vote",
		})
		return
	}

	// Update Redis counters and publish the vote event.
	// MongoDB remains the permanent source of truth.
	if RedisClient != nil {
		redisCtx, redisCancel := context.WithTimeout(
			c.Request.Context(),
			3*time.Second,
		)

		event := VoteEvent{
			Type:      "vote_submitted",
			PollID:    pollID,
			OptionIDs: request.OptionIDs,
		}

		eventData, marshalErr := json.Marshal(event)

		if marshalErr != nil {
			log.Println("Failed to prepare Redis vote event:", marshalErr)
		} else {
			// Use a Redis transaction so the counter updates
			// and Pub/Sub notification are executed together.
			pipe := RedisClient.TxPipeline()

			// Increase total number of submitted votes by one.
			pipe.Incr(
				redisCtx,
				"poll:"+pollID+":totalVotes",
			)

			// Increase the counter for every selected option.
			for _, optionID := range request.OptionIDs {
				pipe.HIncrBy(
					redisCtx,
					"poll:"+pollID+":optionVotes",
					optionID,
					1,
				)
			}

			// Publish the event for WebSocket subscribers.
			pipe.Publish(
				redisCtx,
				"poll:"+pollID+":votes",
				string(eventData),
			)

			_, redisErr := pipe.Exec(redisCtx)

			if redisErr != nil {
				log.Println("Redis vote update failed:", redisErr)
			} else {
				log.Println("Redis counters updated and vote event published for poll:", pollID)
			}
		}

		redisCancel()
	} else {
		log.Println("Redis client is unavailable; vote was saved in MongoDB")
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Vote submitted successfully",
	})
}

// GetPollResults retrieves the actual voting results from MongoDB.
func GetPollResults(c *gin.Context) {
	// Get poll ID from URL.
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Find the poll.
	var poll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve poll",
		})
		return
	}

	// Retrieve all votes belonging to this poll.
	cursor, err := VoteCollection.Find(
		ctx,
		bson.M{"pollId": objectID},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve votes",
		})
		return
	}

	defer cursor.Close(ctx)

	var votes []models.Vote

	if err := cursor.All(ctx, &votes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to read votes",
		})
		return
	}

	// Count votes received by each option.
	optionVoteCounts := make(map[string]int)

	for _, vote := range votes {
		for _, optionID := range vote.OptionIDs {
			optionVoteCounts[optionID]++
		}
	}

	totalVotes := len(votes)

	// Prepare results for every poll option.
	optionResults := make([]gin.H, 0, len(poll.Options))

	for _, option := range poll.Options {
		voteCount := optionVoteCounts[option.ID]

		percentage := 0.0

		if totalVotes > 0 {
			percentage = float64(voteCount) / float64(totalVotes) * 100
		}

		optionResults = append(optionResults, gin.H{
			"optionId":   option.ID,
			"text":       option.Text,
			"votes":      voteCount,
			"percentage": percentage,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"pollId":      poll.ID,
		"title":       poll.Title,
		"description": poll.Description,
		"totalVotes":  totalVotes,
		"options":     optionResults,
	})
}

// EndPoll manually ends an active poll.

// EndPoll manually ends an active or paused poll.
func EndPoll(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Allow both active and paused polls to be ended.
	result, err := PollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id": objectID,
			"status": bson.M{
				"$in": []string{"active", "paused"},
			},
		},
		bson.M{
			"$set": bson.M{
				"status":    "completed",
				"updatedAt": time.Now(),
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to end poll",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Poll not found or cannot be ended",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll ended successfully",
	})
}

// PausePoll temporarily pauses an active poll.
func PausePoll(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := PollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":    objectID,
			"status": "active",
		},
		bson.M{
			"$set": bson.M{
				"status":    "paused",
				"updatedAt": time.Now(),
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to pause poll",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Poll not found or is not currently active",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll paused successfully",
	})
}

// ResumePoll resumes a paused poll.
func ResumePoll(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := PollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":    objectID,
			"status": "paused",
		},
		bson.M{
			"$set": bson.M{
				"status":    "active",
				"updatedAt": time.Now(),
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to resume poll",
		})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Poll not found or is not currently paused",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll resumed successfully",
	})
}
// RestartPoll creates a fresh round of an existing completed poll.
// The original poll and its voting history remain unchanged.
func RestartPoll(c *gin.Context) {
	pollID := c.Param("id")

	// Validate the original poll ID.
	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Retrieve the original poll.
	var originalPoll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&originalPoll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to retrieve original poll",
		})
		return
	}

	// Only completed polls can be restarted.
	if originalPoll.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Only completed polls can be restarted",
		})
		return
	}

	now := time.Now()

	// Generate fresh option IDs.
	newOptions := make([]models.PollOption, 0, len(originalPoll.Options))

	for _, option := range originalPoll.Options {
		newOptions = append(newOptions, models.PollOption{
			ID:   bson.NewObjectID().Hex(),
			Text: option.Text,
		})
	}

	// Create a new poll using the original poll's details.
	newPoll := models.Poll{
		ID:          bson.NewObjectID(),
		Title:       originalPoll.Title,
		Description: originalPoll.Description,
		Question:    originalPoll.Question,
		Options:     newOptions,
		Settings:    originalPoll.Settings,
		Status:      "active",
		StartTime:   nil,
		EndTime:     nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Save the new poll. The original poll and votes are untouched.
	_, err = PollCollection.InsertOne(ctx, newPoll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to restart poll",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Poll restarted successfully",
		"poll":    newPoll,
	})
}