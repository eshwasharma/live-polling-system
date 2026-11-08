
package controllers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

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
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Gemini API key is not configured.",
		})
		return
	}

	ctx := c.Request.Context()

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey: apiKey,
	})

	if err != nil {
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
					{Text: instructions + "\n\nUser prompt: " + prompt},
				},
			},
		},
		nil,
	)

	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini could not generate the poll. Please try again.",
		})
		return
	}

	if result == nil || result.Text() == "" {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini returned an empty response.",
		})
		return
	}

	responseText := strings.TrimSpace(result.Text())
	responseText = strings.TrimPrefix(responseText, "```json")
	responseText = strings.TrimPrefix(responseText, "```")
	responseText = strings.TrimSuffix(responseText, "```")
	responseText = strings.TrimSpace(responseText)

	var generatedPoll GeneratedPoll

	if err := json.Unmarshal([]byte(responseText), &generatedPoll); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini returned an invalid poll format. Please try again.",
		})
		return
	}

	if strings.TrimSpace(generatedPoll.Title) == "" ||
		strings.TrimSpace(generatedPoll.Question) == "" ||
		len(generatedPoll.Options) < 2 ||
		len(generatedPoll.Options) > 6 {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Gemini generated an incomplete poll. Please try again.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Poll generated successfully.",
		"poll":    generatedPoll,
	})
}
