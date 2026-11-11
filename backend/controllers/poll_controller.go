package controllers

import (
	"context"
	"encoding/json"
	"live-polling-backend/models"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

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

	// Attach the authenticated creator as the poll owner.
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Authentication required",
		})
		return
	}

	ownerID, ok := userIDValue.(bson.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid user session",
		})
		return
	}

	poll.OwnerID = ownerID

	// Future start time means the poll is scheduled.
	// Otherwise, the poll becomes active immediately.
	poll.Status = "active"

	if poll.StartTime != nil && poll.StartTime.After(now) {
		poll.Status = "scheduled"
	}

	poll.CreatedAt = now
	poll.UpdatedAt = now
	poll.Round = 1

	if poll.Settings.LinkExpiration == "" {
		poll.Settings.LinkExpiration = "never"
	}

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

	// Fetch only the authenticated creator's polls, newest first.
	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Authentication required",
		})
		return
	}

	ownerID, ok := userIDValue.(bson.ObjectID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Invalid user session",
		})
		return
	}

	cursor, err := PollCollection.Find(
		ctx,
		bson.M{"ownerId": ownerID},
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

// isPollLinkExpired checks whether a poll's public link has expired.
// Expiration is calculated from the poll creation date.
func isPollLinkExpired(poll models.Poll, now time.Time) bool {
	expiration := poll.Settings.LinkExpiration

	// Support older documents that may have used the top-level field.
	if expiration == "" {
		expiration = poll.LinkExpiration
	}

	var duration time.Duration

	switch expiration {
	case "", "never":
		return false
	case "1-day":
		duration = 24 * time.Hour
	case "7-days":
		duration = 7 * 24 * time.Hour
	case "30-days":
		duration = 30 * 24 * time.Hour
	default:
		// Unknown legacy values should not unexpectedly disable a poll.
		return false
	}

	if poll.CreatedAt.IsZero() {
		return false
	}

	return !now.Before(poll.CreatedAt.Add(duration))
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

	if isPollLinkExpired(poll, time.Now()) {
		c.JSON(http.StatusGone, gin.H{
			"success": false,
			"message": "This poll link has expired",
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
// VoteRequest represents the data received when an audience member votes.
type VoteRequest struct {
	OptionIDs  []string `json:"optionIds"`
	VoterID    string   `json:"voterId"`
	VoterName  string   `json:"voterName"`
	VoterEmail string   `json:"voterEmail"`
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

	// Validate participant identity when anonymous voting is disabled.
	request.VoterName = strings.TrimSpace(request.VoterName)
	request.VoterEmail = strings.ToLower(strings.TrimSpace(request.VoterEmail))

	if !poll.Settings.AnonymousVoting {
		if request.VoterName == "" || request.VoterEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Name and email are required for identified voting",
			})
			return
		}

		if len(request.VoterName) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Name cannot exceed 100 characters",
			})
			return
		}

		parsedEmail, emailErr := mail.ParseAddress(request.VoterEmail)
		if emailErr != nil || parsedEmail.Address != request.VoterEmail {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Please enter a valid email address",
			})
			return
		}
	} else {
		// Do not collect or store identity details for anonymous votes.
		request.VoterName = ""
		request.VoterEmail = ""
	}

	// Check whether the poll link has expired.
	now := time.Now()

	if isPollLinkExpired(poll, now) {
		c.JSON(http.StatusGone, gin.H{
			"success": false,
			"message": "This poll link has expired",
		})
		return
	}

	// Check whether the poll is active and within its scheduled time.
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

	// In identified mode, an email address can vote only once per poll,
	// even when the participant uses another browser or device.
	if !poll.Settings.AnonymousVoting {
		emailVoteCount, countErr := VoteCollection.CountDocuments(
			ctx,
			bson.M{
				"pollId":     objectID,
				"voterEmail": request.VoterEmail,
			},
		)
		if countErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to check participant email",
			})
			return
		}
		if emailVoteCount > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": "This email address has already voted in this poll",
			})
			return
		}
	}

	// Create the vote document.
	vote := models.Vote{
		ID:         bson.NewObjectID(),
		PollID:     objectID,
		OptionIDs:  request.OptionIDs,
		VoterID:    request.VoterID,
		VoterName:  request.VoterName,
		VoterEmail: request.VoterEmail,
		CreatedAt:  time.Now(),
	}

	// Save vote permanently in MongoDB first.
	_, err = VoteCollection.InsertOne(ctx, vote)

	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": "You have already voted in this poll",
			})
			return
		}
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

// GetPollParticipants returns identified voters to the poll owner only.
// The route must be registered inside the authenticated poll-owner route group.
func GetPollParticipants(c *gin.Context) {
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

	var poll models.Poll
	err = PollCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&poll)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Poll not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to retrieve poll"})
		return
	}

	if poll.Settings.AnonymousVoting {
		c.JSON(http.StatusOK, gin.H{
			"success":      true,
			"anonymous":    true,
			"participants": []gin.H{},
		})
		return
	}

	cursor, err := VoteCollection.Find(ctx, bson.M{
		"pollId":     objectID,
		"voterEmail": bson.M{"$type": "string", "$ne": ""},
	}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to retrieve participants"})
		return
	}
	defer cursor.Close(ctx)

	var votes []models.Vote
	if err := cursor.All(ctx, &votes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to read participants"})
		return
	}

	optionTexts := make(map[string]string, len(poll.Options))
	for _, option := range poll.Options {
		optionTexts[option.ID] = option.Text
	}

	participants := make([]gin.H, 0, len(votes))
	for _, vote := range votes {
		selectedOptions := make([]string, 0, len(vote.OptionIDs))
		for _, optionID := range vote.OptionIDs {
			if optionText, ok := optionTexts[optionID]; ok {
				selectedOptions = append(selectedOptions, optionText)
			}
		}
		participants = append(participants, gin.H{
			"name":            vote.VoterName,
			"email":           vote.VoterEmail,
			"selectedOptions": selectedOptions,
			"votedAt":         vote.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"anonymous":    false,
		"participants": participants,
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

// RestartPoll starts a fresh voting round using the same poll ID and link.

func RestartPoll(c *gin.Context) {
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

	if poll.Status != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Only completed polls can be restarted",
		})
		return
	}

	// Remove previous voting records.
	_, err = VoteCollection.DeleteMany(
		ctx,
		bson.M{"pollId": objectID},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to clear previous votes",
		})
		return
	}

	now := time.Now()

	// Restart the same poll and increment its voting round.
	_, err = PollCollection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{
			"$set": bson.M{
				"status":    "active",
				"startTime": nil,
				"endTime":   nil,
				"updatedAt": now,
			},
			"$inc": bson.M{
				"round": 1,
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Votes were cleared, but the poll could not be restarted",
		})
		return
	}

	// Clear Redis counters and notify connected WebSocket clients.
	if RedisClient != nil {
		redisCtx, redisCancel := context.WithTimeout(
			c.Request.Context(),
			3*time.Second,
		)

		err = RedisClient.Del(
			redisCtx,
			"poll:"+pollID+":totalVotes",
			"poll:"+pollID+":optionVotes",
		).Err()

		if err != nil {
			log.Println("Failed to clear Redis counters during restart:", err)
		}

		_, publishErr := RedisClient.Publish(
			redisCtx,
			"poll:"+pollID+":votes",
			`{"type":"results"}`,
		).Result()

		if publishErr != nil {
			log.Println("Failed to publish poll restart event:", publishErr)
		}

		redisCancel()
	}

	var restartedPoll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&restartedPoll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Poll restarted, but failed to retrieve its updated details",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll restarted successfully",
		"poll":    restartedPoll,
	})
}

// UpdatePollSettings updates the voting settings and schedule of an existing poll.

// UpdatePollSettings updates only the voting settings.
// Poll schedule remains managed by the Create Poll page.
func UpdatePollSettings(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	var request struct {
		AllowMultipleAnswers *bool   `json:"allowMultipleAnswers"`
		AnonymousVoting      *bool   `json:"anonymousVoting"`
		ShowResults          *string `json:"showResults"`
		LinkExpiration       *string `json:"linkExpiration"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll settings",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

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

	if request.ShowResults != nil {
		if *request.ShowResults != "after-voting" &&
			*request.ShowResults != "always" &&
			*request.ShowResults != "after-end" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid results visibility setting",
			})
			return
		}
	}

	if request.LinkExpiration != nil {
		if *request.LinkExpiration != "never" &&
			*request.LinkExpiration != "1-day" &&
			*request.LinkExpiration != "7-days" &&
			*request.LinkExpiration != "30-days" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid link expiration setting",
			})
			return
		}
	}

	voteCount, err := VoteCollection.CountDocuments(
		ctx,
		bson.M{"pollId": objectID},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to check existing votes",
		})
		return
	}

	if request.AllowMultipleAnswers != nil &&
		*request.AllowMultipleAnswers != poll.Settings.AllowMultipleAnswers &&
		voteCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Multiple-answer settings cannot be changed after votes have been submitted",
		})
		return
	}

	updates := bson.M{
		"updatedAt": time.Now(),
	}

	if request.AllowMultipleAnswers != nil {
		updates["settings.allowMultipleAnswers"] = *request.AllowMultipleAnswers
	}

	if request.AnonymousVoting != nil {
		updates["settings.anonymousVoting"] = *request.AnonymousVoting
	}

	if request.ShowResults != nil {
		updates["settings.showResults"] = *request.ShowResults
	}

	if request.LinkExpiration != nil {
		updates["settings.linkExpiration"] = *request.LinkExpiration
	}

	_, err = PollCollection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": updates},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update poll settings",
		})
		return
	}

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&poll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Settings were saved, but the updated poll could not be retrieved",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll settings updated successfully",
		"poll":    poll,
	})
}

// UpdatePoll edits an existing poll.
func UpdatePoll(c *gin.Context) {
	pollID := c.Param("id")

	objectID, err := bson.ObjectIDFromHex(pollID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	var request struct {
		Title       string              `json:"title"`
		Description string              `json:"description"`
		Question    string              `json:"question"`
		Options     []models.PollOption `json:"options"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll data",
		})
		return
	}

	request.Title = strings.TrimSpace(request.Title)
	request.Description = strings.TrimSpace(request.Description)
	request.Question = strings.TrimSpace(request.Question)

	if request.Title == "" || request.Question == "" || len(request.Options) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Title, question, and at least two options are required",
		})
		return
	}

	// Validate options and ensure their IDs are unique.
	seenIDs := make(map[string]bool)

	for i := range request.Options {
		request.Options[i].Text = strings.TrimSpace(request.Options[i].Text)

		if request.Options[i].Text == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Poll options cannot be empty",
			})
			return
		}

		if request.Options[i].ID == "" {
			request.Options[i].ID = bson.NewObjectID().Hex()
		}

		if seenIDs[request.Options[i].ID] {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Duplicate option IDs are not allowed",
			})
			return
		}

		seenIDs[request.Options[i].ID] = true
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var existingPoll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&existingPoll)

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

	// Check whether votes already exist.
	voteCount, err := VoteCollection.CountDocuments(
		ctx,
		bson.M{"pollId": objectID},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to check existing votes",
		})
		return
	}

	// Existing votes refer to option IDs. Do not change options
	// once votes have been submitted.
	if voteCount > 0 {
		sameOptions := len(request.Options) == len(existingPoll.Options)

		if sameOptions {
			for i, option := range request.Options {
				if option.ID != existingPoll.Options[i].ID ||
					option.Text != existingPoll.Options[i].Text {
					sameOptions = false
					break
				}
			}
		}

		if !sameOptions {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Answer options cannot be changed after votes have been submitted",
			})
			return
		}
	}

	_, err = PollCollection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{
			"$set": bson.M{
				"title":       request.Title,
				"description": request.Description,
				"question":    request.Question,
				"options":     request.Options,
				"updatedAt":   time.Now(),
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update poll",
		})
		return
	}

	var updatedPoll models.Poll

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": objectID},
	).Decode(&updatedPoll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Poll updated, but failed to retrieve updated details",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll updated successfully",
		"poll":    updatedPoll,
	})
}

// DuplicatePoll creates a new poll using the details of an existing poll.
func DuplicatePoll(c *gin.Context) {
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
			"message": "Failed to retrieve poll",
		})
		return
	}

	// Give the duplicate its own option IDs and a fresh voting round.
	newOptions := make([]models.PollOption, 0, len(originalPoll.Options))

	for _, option := range originalPoll.Options {
		newOptions = append(newOptions, models.PollOption{
			ID:   bson.NewObjectID().Hex(),
			Text: option.Text,
		})
	}

	now := time.Now()

	newPoll := models.Poll{
		ID:          bson.NewObjectID(),
		OwnerID:     originalPoll.OwnerID,
		Title:       originalPoll.Title + " (Copy)",
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

	_, err = PollCollection.InsertOne(ctx, newPoll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to duplicate poll",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Poll duplicated successfully",
		"poll":    newPoll,
	})
}

// DeletePoll permanently deletes a poll and its associated votes.
func DeletePoll(c *gin.Context) {
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

	// Confirm that the poll exists.
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

	// Delete the poll document.
	_, err = PollCollection.DeleteOne(
		ctx,
		bson.M{"_id": objectID},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete poll",
		})
		return
	}

	// Delete all votes belonging to this poll.
	_, err = VoteCollection.DeleteMany(
		ctx,
		bson.M{"pollId": objectID},
	)

	if err != nil {
		log.Println("Failed to delete votes for deleted poll:", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Poll was deleted, but its vote records could not be deleted",
		})
		return
	}

	// Remove cached Redis counters.
	if RedisClient != nil {
		redisCtx, redisCancel := context.WithTimeout(
			c.Request.Context(),
			3*time.Second,
		)

		err = RedisClient.Del(
			redisCtx,
			"poll:"+pollID+":totalVotes",
			"poll:"+pollID+":optionVotes",
		).Err()

		if err != nil {
			log.Println("Failed to clear Redis data for deleted poll:", err)
		}

		redisCancel()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll deleted successfully",
	})
}
