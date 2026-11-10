package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"


	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

func RequireAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		parts := strings.SplitN(header, " ", 2)

		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Authentication required",
			})
			return
		}

		token, err := jwt.ParseWithClaims(
			parts[1],
			&Claims{},
			func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			},
		)

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Your session is invalid or has expired. Please log in again.",
			})
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || claims.UserID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Invalid authentication token",
			})
			return
		}

		userID, err := bson.ObjectIDFromHex(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Invalid user ID",
			})
			return
		}

		c.Set("userID", userID)
		c.Next()
	}
}

// RequirePollOwner is applied only to creator management routes.
// Public poll viewing and voting routes do not use this middleware.
func RequirePollOwner(collection *mongo.Collection) gin.HandlerFunc {
	return func(c *gin.Context) {
		pollID, err := bson.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Invalid poll ID",
			})
			return
		}

		userIDValue, exists := c.Get("userID")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Authentication required",
			})
			return
		}

		userID, ok := userIDValue.(bson.ObjectID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Invalid user session",
			})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		err = collection.FindOne(ctx, bson.M{
			"_id":     pollID,
			"ownerId": userID,
		}).Err()

		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
					"success": false,
					"message": "Poll not found or you do not have permission to manage it",
				})
				return
			}

			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Unable to verify poll ownership",
			})
			return
		}

		c.Next()
	}
}