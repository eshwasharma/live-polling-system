
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type Poll struct {
	ID          bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string        `bson:"title" json:"title"`
	Description string        `bson:"description,omitempty" json:"description,omitempty"`
	Question    string        `bson:"question" json:"question"`
	Options     []PollOption  `bson:"options" json:"options"`
	Settings    PollSettings  `bson:"settings" json:"settings"`

	Status    string     `bson:"status" json:"status"`
	StartTime *time.Time `bson:"startTime,omitempty" json:"startTime,omitempty"`
	EndTime   *time.Time `bson:"endTime,omitempty" json:"endTime,omitempty"`

	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time `bson:"updatedAt" json:"updatedAt"`
}

type PollOption struct {
	ID   string `bson:"id" json:"id"`
	Text string `bson:"text" json:"text"`
}

type PollSettings struct {
	AllowMultipleAnswers bool   `bson:"allowMultipleAnswers" json:"allowMultipleAnswers"`
	AnonymousVoting      bool   `bson:"anonymousVoting" json:"anonymousVoting"`
	ShowResults          string `bson:"showResults" json:"showResults"`
}
