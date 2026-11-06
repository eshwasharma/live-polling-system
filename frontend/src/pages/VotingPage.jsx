import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Users,
  Clock3,
  Send,
  Check,
} from "lucide-react";

function VotingPage({ poll, onBack, onSubmitVote, hasVoted }) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [message, setMessage] = useState("");

  if (!poll) {
    return null;
  }

  function handleOptionChange(option) {
    setMessage("");

    if (poll.allowMultiple) {
      setSelectedOptions((current) =>
        current.includes(option)
          ? current.filter((item) => item !== option)
          : [...current, option]
      );
    } else {
      setSelectedOptions([option]);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (selectedOptions.length === 0) {
      setMessage("Please select at least one option before submitting.");
      return;
    }

    onSubmitVote(poll.id, selectedOptions);
  }

  return (
    <div className="voting-page">
      <button className="back-button voting-back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Active Polls
      </button>

      <div className="voting-layout">
        <main className="voting-main-panel">
          <div className="voting-top-label">
            <span className="voting-live-dot"></span>
            ACTIVE POLL
          </div>

          <h1>{poll.title}</h1>

          {poll.description && (
            <p className="voting-description">{poll.description}</p>
          )}

          <div className="voting-meta">
            <span>
              <Users size={15} /> {poll.votes} votes
            </span>

            <span>
              <Clock3 size={15} />
              {poll.endTime
                ? `Ends ${new Date(poll.endTime).toLocaleDateString()}`
                : "No end date"}
            </span>
          </div>

          <div className="voting-divider"></div>

          <form onSubmit={handleSubmit}>
            <div className="voting-question-heading">
              <h2>Your answer</h2>
              <span>
                {poll.allowMultiple
                  ? "Select all that apply"
                  : "Select one option"}
              </span>
            </div>

            <div className="voting-options">
              {poll.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option);

                return (
                  <button
                    type="button"
                    key={index}
                    disabled={hasVoted}
                    className={`voting-option ${
                      isSelected ? "voting-option-selected" : ""
                    }`}
                    onClick={() => handleOptionChange(option)}
                  >
                    <span
                      className={`voting-choice-indicator ${
                        poll.allowMultiple ? "checkbox-indicator" : ""
                      } ${isSelected ? "selected" : ""}`}
                    >
                      {isSelected && <Check size={14} />}
                    </span>

                    <span className="voting-option-text">{option}</span>

                    {isSelected && (
                      <CheckCircle2
                        size={18}
                        className="voting-selected-icon"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {hasVoted ? (
              <div className="vote-success-message">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Your vote has been submitted!</strong>
                  <p>Thank you for participating in this poll.</p>
                </div>
              </div>
            ) : (
              <>
                {message && (
                  <p className="vote-validation-message">{message}</p>
                )}

                <button
                  type="submit"
                  className="primary-button submit-vote-button"
                >
                  <Send size={16} /> Submit Vote
                </button>
              </>
            )}
          </form>
        </main>

        <aside className="voting-side-panel">
          <div className="voting-info-card">
            <div className="voting-info-icon">
              <CheckCircle2 size={21} />
            </div>

            <h3>Make your voice count</h3>

            <p>
              Your response helps collect opinions and make better
              decisions.
            </p>
          </div>

          <div className="voting-rules-card">
            <h3>Poll information</h3>

            <div className="voting-rule-row">
              <span>Voting type</span>
              <strong>
                {poll.allowMultiple ? "Multiple choice" : "Single choice"}
              </strong>
            </div>

            <div className="voting-rule-row">
              <span>Identity</span>
              <strong>
                {poll.anonymous ? "Anonymous" : "Identified"}
              </strong>
            </div>

            <div className="voting-rule-row">
              <span>Current votes</span>
              <strong>{poll.votes}</strong>
            </div>
          </div>

          <p className="voting-privacy-note">
            Your vote is handled according to this poll's voting settings.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default VotingPage;