
package controllers

import (
	"context"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"live-polling-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"
)

var UserCollection *mongo.Collection

func SetUserCollection(collection *mongo.Collection) {
	UserCollection = collection
}

type AuthRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthClaims represents the JWT token claims.
type AuthClaims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

func createToken(userID bson.ObjectID) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", jwt.ErrInvalidKey
	}

	claims := AuthClaims{
		UserID: userID.Hex(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString([]byte(secret))
}

func Signup(c *gin.Context) {
	var request AuthRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid signup details",
		})
		return
	}

	request.Name = strings.TrimSpace(request.Name)
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	if request.Name == "" || request.Email == "" || len(request.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Name, email, and a password of at least 8 characters are required",
		})
		return
	}

	emailPattern := regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

	if !emailPattern.MatchString(request.Email) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Please enter a valid email address",
		})
		return
	}

	if UserCollection == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "User database is not configured",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var existing models.User

	err := UserCollection.FindOne(ctx, bson.M{
		"email": request.Email,
	}).Decode(&existing)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"message": "An account with this email already exists",
		})
		return
	}

	if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Unable to check the email address",
		})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(request.Password),
		bcrypt.DefaultCost,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Unable to secure the password",
		})
		return
	}

	now := time.Now()

	user := models.User{
		ID:        bson.NewObjectID(),
		Name:      request.Name,
		Email:     request.Email,
		Password:  string(hashedPassword),
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = UserCollection.InsertOne(ctx, user)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Unable to create your account",
		})
		return
	}

	token, err := createToken(user.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Account created, but unable to start your session",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Account created successfully",
		"token":   token,
		"user": gin.H{
			"id":    user.ID.Hex(),
			"name":  user.Name,
			"email": user.Email,
		},
	})
}

func Login(c *gin.Context) {
	var request AuthRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid login details",
		})
		return
	}

	request.Email = strings.ToLower(strings.TrimSpace(request.Email))

	if request.Email == "" || request.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Email and password are required",
		})
		return
	}

	if UserCollection == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "User database is not configured",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var user models.User

	err := UserCollection.FindOne(ctx, bson.M{
		"email": request.Email,
	}).Decode(&user)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Incorrect email or password",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(user.Password),
		[]byte(request.Password),
	); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Incorrect email or password",
		})
		return
	}

	token, err := createToken(user.ID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Unable to start your session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Login successful",
		"token":   token,
		"user": gin.H{
			"id":    user.ID.Hex(),
			"name":  user.Name,
			"email": user.Email,
		},
	})
}

func GetCurrentUser(c *gin.Context) {
	userID, ok := c.Get("userID")

	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Authentication required",
		})
		return
	}

	if UserCollection == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "User database is not configured",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var user models.User

	err := UserCollection.FindOne(ctx, bson.M{
		"_id": userID,
	}).Decode(&user)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "User account not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user": gin.H{
			"id":    user.ID.Hex(),
			"name":  user.Name,
			"email": user.Email,
		},
	})
}
