
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
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"go.mongodb.org/mongo-driver/v2/bson"
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
