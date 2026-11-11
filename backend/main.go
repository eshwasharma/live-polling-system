package main

import (
	"context"
	"log"
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
	// Load environment variables from .env.
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using environment variables")
	}

	// Check required environment variables.
	mongoURI := os.Getenv("MONGODB_URI")
	jwtSecret := os.Getenv("JWT_SECRET")

	if mongoURI == "" {
		log.Fatal("MONGODB_URI is missing from .env")
	}

	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is missing from .env")
	}

	// Connect to MongoDB.
	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	clientOptions := options.Client().ApplyURI(mongoURI)

	mongoClient, err := mongo.Connect(clientOptions)
	if err != nil {
		log.Fatal("MongoDB connection failed:", err)
	}

	// Verify MongoDB connection.
	if err := mongoClient.Ping(ctx, readpref.Primary()); err != nil {
		log.Fatal("MongoDB ping failed:", err)
	}

	log.Println("Connected to MongoDB successfully")

	// Select database.
	database := mongoClient.Database("pulsepoll")

	// Get collections.
	pollCollection := database.Collection("polls")
	voteCollection := database.Collection("votes")
	userCollection := database.Collection("users")

	// Create a unique index to prevent duplicate votes
	// from the same browser/voter ID in a poll.
	_, err = voteCollection.Indexes().CreateOne(
		ctx,
		mongo.IndexModel{
			Keys: bson.D{
				{Key: "pollId", Value: 1},
				{Key: "voterId", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
	)

	if err != nil {
		log.Fatal("Failed to create unique vote index:", err)
	}

	log.Println("Vote unique index created successfully")

	// Create a unique index to prevent the same email
	// from voting more than once in an identified poll.
	// Anonymous votes do not contain voterEmail.
	_, err = voteCollection.Indexes().CreateOne(
		ctx,
		mongo.IndexModel{
			Keys: bson.D{
				{Key: "pollId", Value: 1},
				{Key: "voterEmail", Value: 1},
			},
			Options: options.Index().
				SetUnique(true).
				SetPartialFilterExpression(bson.M{
					"voterEmail": bson.M{"$type": "string"},
				}),
		},
	)

	if err != nil {
		log.Fatal("Failed to create unique voter email index:", err)
	}

	log.Println("Voter email unique index created successfully")

	// Create a unique index for user emails.
	_, err = userCollection.Indexes().CreateOne(
		ctx,
		mongo.IndexModel{
			Keys: bson.D{
				{Key: "email", Value: 1},
			},
			Options: options.Index().SetUnique(true),
		},
	)

	if err != nil {
		log.Fatal("Failed to create user email index:", err)
	}

	log.Println("User email unique index created successfully")

	// Connect controllers to MongoDB collections.
	controllers.SetPollCollection(pollCollection)
	controllers.SetVoteCollection(voteCollection)
	controllers.SetUserCollection(userCollection)

	// Connect to Redis.
	// Connect to Redis locally or use Render Key Value in production.
	redisOptions := &redis.Options{
		Addr: "localhost:6379",
		DB:   0,
	}

	// Render provides REDIS_URL for the hosted Redis-compatible service.
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		parsedOptions, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Fatal("Invalid REDIS_URL:", err)
		}

		redisOptions = parsedOptions
	}

	redisClient := redis.NewClient(redisOptions)

	// Verify Redis connection.
	redisCtx, redisCancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)

	err = redisClient.Ping(redisCtx).Err()
	redisCancel()

	if err != nil {
		log.Fatal("Redis connection failed:", err)
	}

	log.Println("Connected to Redis successfully")

	// Connect controllers to Redis.
	controllers.SetRedisClient(redisClient)

	// Start the poll scheduler.
	go startPollScheduler(pollCollection)

	log.Println("Poll scheduler started")

	// Create Gin router.
	router := gin.Default()

	// Health-check endpoint.
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"success": true,
			"message": "PulsePoll backend is running",
		})
	})

	// Register authentication routes.
	routes.AuthRoutes(router)

	// Register poll routes.
	routes.PollRoutes(router)

	// Start backend server.
	log.Println("PulsePoll server starting on port 5000")

	port := os.Getenv("PORT")

	if port == "" {
		port = "5000"
	}

	if err := router.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// startPollScheduler checks scheduled and expired polls every 30 seconds.
func startPollScheduler(collection *mongo.Collection) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Run once immediately when the scheduler starts.
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

	now := time.Now()

	// Complete expired active or scheduled polls.
	completedResult, err := collection.UpdateMany(
		ctx,
		bson.M{
			"status": bson.M{
				"$in": []string{"active", "scheduled"},
			},
			"endTime": bson.M{
				"$lte": now,
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
		log.Println("Scheduler: Failed to complete expired polls:", err)
		return
	}

	if completedResult.ModifiedCount > 0 {
		log.Printf(
			"Scheduler: Completed %d expired poll(s)",
			completedResult.ModifiedCount,
		)
	}

	// Activate scheduled polls whose start time has arrived
	// and whose end time is still in the future.
	activeResult, err := collection.UpdateMany(
		ctx,
		bson.M{
			"status": "scheduled",
			"startTime": bson.M{
				"$lte": now,
			},
			"endTime": bson.M{
				"$gt": now,
			},
		},
		bson.M{
			"$set": bson.M{
				"status":    "active",
				"updatedAt": now,
			},
		},
	)

	if err != nil {
		log.Println("Scheduler: Failed to activate scheduled polls:", err)
		return
	}

	if activeResult.ModifiedCount > 0 {
		log.Printf(
			"Scheduler: Activated %d scheduled poll(s)",
			activeResult.ModifiedCount,
		)
	}
}
