
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"live-polling-backend/controllers"
	"live-polling-backend/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

func main() {
	// Load environment variables.
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI is missing from .env")
	}

	// Connect to MongoDB.
	client, err := mongo.Connect(options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal("MongoDB connection failed: ", err)
	}

	// Verify MongoDB connection.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		cancel()
		log.Fatal("MongoDB ping failed: ", err)
	}

	cancel()
	log.Println("Successfully connected to MongoDB Atlas!")

	defer func() {
		if err := client.Disconnect(context.Background()); err != nil {
			log.Println("Error disconnecting MongoDB:", err)
		}
	}()

	// Select database and collections.
	database := client.Database("pulsepoll")

	pollCollection := database.Collection("polls")
	voteCollection := database.Collection("votes")

	// Prevent the same browser from voting twice in the same poll.
	voteIndex := mongo.IndexModel{
		Keys: bson.D{
			{Key: "pollId", Value: 1},
			{Key: "voterId", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}

	_, err = voteCollection.Indexes().CreateOne(
		context.Background(),
		voteIndex,
	)

	if err != nil {
		log.Fatal("Failed to create vote index: ", err)
	}

	log.Println("Vote duplicate-protection index created successfully!")

	// Connect MongoDB collections to controllers.
	controllers.SetPollCollection(pollCollection)
	controllers.SetVoteCollection(voteCollection)

	// Start automatic poll scheduling.
	go startPollScheduler(pollCollection)

	// Connect to Redis.
	redisClient := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	// Verify Redis connection.
	redisCtx, redisCancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)

	if err := redisClient.Ping(redisCtx).Err(); err != nil {
		redisCancel()
		log.Fatal("Redis connection failed: ", err)
	}

	redisCancel()
	log.Println("Successfully connected to Redis!")

	controllers.SetRedisClient(redisClient)

	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Println("Error closing Redis connection:", err)
		}
	}()

	// Create Gin router.
	router := gin.Default()

	// Health check endpoint.
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "PulsePoll backend is running!",
		})
	})

	// Register poll routes.
	routes.PollRoutes(router)

	log.Println("Starting PulsePoll backend on port 5000...")

	if err := router.Run(":5000"); err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}

// startPollScheduler checks poll schedules every 5 seconds.
func startPollScheduler(collection *mongo.Collection) {
	log.Println("Automatic poll scheduler started!")

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Run once immediately when the backend starts.
	updatePollStatuses(collection)

	for range ticker.C {
		updatePollStatuses(collection)
	}
}

// updatePollStatuses activates scheduled polls and completes expired polls.
func updatePollStatuses(collection *mongo.Collection) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	now := time.Now().UTC()

	// Activate polls whose scheduled start time has arrived.
	activateResult, err := collection.UpdateMany(
		ctx,
		bson.M{
			"status":    "scheduled",
			"startTime": bson.M{"$lte": now},
		},
		bson.M{
			"$set": bson.M{
				"status":    "active",
				"updatedAt": now,
			},
		},
	)

	if err != nil {
		log.Println("Failed to activate scheduled polls:", err)
		return
	}

	if activateResult.ModifiedCount > 0 {
		log.Printf(
			"Activated %d scheduled poll(s)",
			activateResult.ModifiedCount,
		)
	}

	// Complete active polls whose end time has arrived.
	completeResult, err := collection.UpdateMany(
		ctx,
		bson.M{
			"status": "active",
			"endTime": bson.M{
				"$type": "date",
				"$lte":  now,
			},
		},
		bson.M{
			"$set": bson.M{
				"status":    "completed",
				"updatedAt": now,
			},
		},
	)

	if err != nil {
		log.Println("Failed to complete expired polls:", err)
		return
	}

	if completeResult.ModifiedCount > 0 {
		log.Printf(
			"Completed %d expired poll(s)",
			completeResult.ModifiedCount,
		)
	}
}
