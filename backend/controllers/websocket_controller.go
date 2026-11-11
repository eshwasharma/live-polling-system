package controllers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	// Allow only approved frontend origins.
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")

		// Allow non-browser clients without an Origin header.
		if origin == "" {
			return true
		}

		// Allow local Vite development.
		if origin == "http://localhost:5173" {
			return true
		}

		// Allow configured production frontend URLs.
		frontendURLs := strings.Split(
			os.Getenv("FRONTEND_URL"),
			",",
		)

		for _, frontendURL := range frontendURLs {
			if strings.TrimSpace(frontendURL) == origin {
				return true
			}
		}

		return false
	},
}

type WebSocketResults struct {
	Type       string         `json:"type"`
	PollID     string         `json:"pollId"`
	TotalVotes int            `json:"totalVotes"`
	Options    []OptionResult `json:"options"`
}

type OptionResult struct {
	ID         string  `json:"id"`
	Text       string  `json:"text"`
	Votes      int     `json:"votes"`
	Percentage float64 `json:"percentage"`
}

// GetLivePollResults retrieves the latest results directly from MongoDB.
func GetLivePollResults(pollID bson.ObjectID) (WebSocketResults, error) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	var poll struct {
		Options []struct {
			ID   string `bson:"id"`
			Text string `bson:"text"`
		} `bson:"options"`
	}

	err := PollCollection.FindOne(
		ctx,
		bson.M{"_id": pollID},
	).Decode(&poll)

	if err != nil {
		return WebSocketResults{}, err
	}

	cursor, err := VoteCollection.Find(
		ctx,
		bson.M{"pollId": pollID},
	)

	if err != nil {
		return WebSocketResults{}, err
	}
	defer cursor.Close(ctx)

	voteCounts := make(map[string]int)
	totalVotes := 0

	for cursor.Next(ctx) {
		var vote struct {
			OptionIDs []string `bson:"optionIds"`
		}

		if err := cursor.Decode(&vote); err != nil {
			return WebSocketResults{}, err
		}

		totalVotes++

		for _, optionID := range vote.OptionIDs {
			voteCounts[optionID]++
		}
	}

	if err := cursor.Err(); err != nil {
		return WebSocketResults{}, err
	}

	results := WebSocketResults{
		Type:       "results",
		PollID:     pollID.Hex(),
		TotalVotes: totalVotes,
		Options:    make([]OptionResult, 0, len(poll.Options)),
	}

	for _, option := range poll.Options {
		count := voteCounts[option.ID]

		percentage := 0.0

		if totalVotes > 0 {
			percentage = float64(count) / float64(totalVotes) * 100
		}

		results.Options = append(
			results.Options,
			OptionResult{
				ID:         option.ID,
				Text:       option.Text,
				Votes:      count,
				Percentage: percentage,
			},
		)
	}

	return results, nil
}

// PollWebSocket handles live result updates for a poll.
func PollWebSocket(c *gin.Context) {
	pollIDString := c.Param("id")

	pollID, err := bson.ObjectIDFromHex(pollIDString)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid poll ID",
		})
		return
	}

	// Confirm that the poll exists.
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)

	var pollExists bson.M

	err = PollCollection.FindOne(
		ctx,
		bson.M{"_id": pollID},
	).Decode(&pollExists)

	cancel()

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Poll not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Could not retrieve poll",
			})
		}

		return
	}

	// Upgrade the HTTP connection to WebSocket.
	conn, err := upgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)

	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	// Subscribe to this poll's Redis vote channel.
	channel := "poll:" + pollIDString + ":votes"

	pubsub := RedisClient.Subscribe(
		context.Background(),
		channel,
	)
	defer pubsub.Close()

	// Confirm that the Redis subscription is ready.
	if _, err := pubsub.ReceiveTimeout(
		context.Background(),
		5*time.Second,
	); err != nil {
		log.Println("Redis subscription failed:", err)
		return
	}

	// Send the latest results immediately after connecting.
	initialResults, err := GetLivePollResults(pollID)

	if err != nil {
		log.Println("Could not get initial poll results:", err)
		return
	}

	if err := conn.WriteJSON(initialResults); err != nil {
		log.Println("Could not send initial WebSocket results:", err)
		return
	}

	// Read messages to detect when the browser disconnects.
	done := make(chan struct{})

	go func() {
		defer close(done)

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	// Listen for new votes from Redis.
	for {
		select {
		case <-done:
			return

		case <-c.Request.Context().Done():
			return

		default:
			message, err := pubsub.ReceiveMessage(
				context.Background(),
			)

			if err != nil {
				if err != redis.Nil {
					log.Println("Redis message error:", err)
				}

				return
			}

			// Get the latest complete results from MongoDB.
			latestResults, err := GetLivePollResults(pollID)

			if err != nil {
				log.Println("Could not retrieve updated results:", err)
				continue
			}

			if err := conn.WriteJSON(latestResults); err != nil {
				log.Println("WebSocket write failed:", err)
				return
			}

			// Keep the Redis event available for debugging.
			var event map[string]interface{}

			if err := json.Unmarshal(
				[]byte(message.Payload),
				&event,
			); err == nil {
				log.Println(
					"Live vote received for poll:",
					pollIDString,
				)
			}
		}
	}
}
