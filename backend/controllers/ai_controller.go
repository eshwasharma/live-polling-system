
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
	"google.golang.org/genai"
)

type GeneratePollRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

type GeneratedPoll struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Question    string   `json:"question"`
	Options     []string `json:"options"`
}

func GenerateAIPoll(c *gin.Context) {
	var request GeneratePollRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Please provide a valid prompt.",
		})
		return
	}

	prompt := strings.TrimSpace(request.Prompt)

	if prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Prompt cannot be empty.",
		})
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")

	if apiKey == "" {
		log.Println("AI Error: GEMINI_API_KEY is not configured")

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Gemini API key is not configured.",
		})
		return
	}

	// Give the Gemini request a maximum of 60 seconds.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// Explicitly configure the Gemini Developer API backend.
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})

	if err != nil {
		log.Printf("AI Error: Failed to initialize Gemini client: %v", err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to initialize Gemini.",
		})
		return
	}

	instructions := `You are an AI assistant that creates clear and engaging multiple-choice polls.

Generate a poll based on the user's prompt.

Return ONLY valid JSON in this exact structure:
{
  "title": "Short poll title",
  "description": "Brief description",
  "question": "The poll question",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}

Rules:
- Generate 2 to 6 options.
- Keep options short and distinct.
- Do not include explanations outside the JSON.
- Make the question relevant to the user's prompt.`

	result, err := client.Models.GenerateContent(
		ctx,
		"gemini-3.8-flash",
		[]*genai.Content{
			{
				Parts: []*genai.Part{
					{
						Text: instructions + "\n\nUser prompt: " + prompt,
					},
				},
			},
		},
		nil,
	)

	if err != nil {
		log.Printf("AI Error: Gemini generation failed: %v", err)

		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini could not generate the poll. Please try again.",
		})
		return
	}

	if result == nil || strings.TrimSpace(result.Text()) == "" {
		log.Println("AI Error: Gemini returned an empty response")

		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini returned an empty response.",
		})
		return
	}

	responseText := strings.TrimSpace(result.Text())

	// Remove Markdown code fences if Gemini includes them.
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var generatedPoll GeneratedPoll

	if err := json.Unmarshal([]byte(responseText), &generatedPoll); err != nil {
		log.Printf("AI Error: Invalid JSON returned by Gemini: %v", err)

		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini returned an invalid poll format. Please try again.",
		})
		return
	}

	// Validate generated poll.
	generatedPoll.Title = strings.TrimSpace(generatedPoll.Title)
	generatedPoll.Description = strings.TrimSpace(generatedPoll.Description)
	generatedPoll.Question = strings.TrimSpace(generatedPoll.Question)

	if generatedPoll.Title == "" ||
		generatedPoll.Question == "" ||
		len(generatedPoll.Options) < 2 ||
		len(generatedPoll.Options) > 6 {

		log.Println("AI Error: Gemini generated an incomplete poll")

		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini generated an incomplete poll. Please try again.",
		})
		return
	}

	for i := range generatedPoll.Options {
		generatedPoll.Options[i] = strings.TrimSpace(generatedPoll.Options[i])

		if generatedPoll.Options[i] == "" {
			c.JSON(http.StatusBadGateway, gin.H{
				"success": false,
				"message": "Gemini generated an empty poll option.",
			})
			return
		}
	}

	log.Println("AI poll generated successfully")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll generated successfully.",
		"poll":    generatedPoll,
	})
}
