
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Users,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Send,
  Check,
} from "lucide-react";

function PublicVotingPage() {
  const { id } = useParams();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [voterId, setVoterId] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchPoll() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/polls/${id}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load this poll.");
        }

        const savedPoll = data.poll;

        setPoll({
          ...savedPoll,
          options: savedPoll.options || [],
          votes: savedPoll.votes || 0,
          allowMultiple:
            savedPoll.settings?.allowMultipleAnswers || false,
          anonymous:
            savedPoll.settings?.anonymousVoting ?? true,
        });

        // Generate a stable browser ID for duplicate-vote protection.
        const storageKey = `pulsepoll-voter-${id}`;
        let savedVoterId = localStorage.getItem(storageKey);

        if (!savedVoterId) {
          savedVoterId = crypto.randomUUID();
          localStorage.setItem(storageKey, savedVoterId);
        }

        setVoterId(savedVoterId);

        // Check whether this browser has already voted.
        const alreadyVoted = localStorage.getItem(
          `pulsepoll-voted-${id}`
        );

        setHasVoted(alreadyVoted === "true");
      } catch (err) {
        console.error("Public poll fetch error:", err);
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    fetchPoll();
  }, [id]);

  function handleOptionChange(optionId) {
    setMessage("");

    if (poll.allowMultiple) {
      setSelectedOptions((current) =>
        current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  }

  async function handleSubmitVote(event) {
    event.preventDefault();

    if (hasVoted || submitting) return;

    if (selectedOptions.length === 0) {
      setMessage("Please select at least one option.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/polls/${id}/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          optionIds: selectedOptions,
          voterId: voterId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to submit your vote.");
      }

      localStorage.setItem(`pulsepoll-voted-${id}`, "true");

      setHasVoted(true);

      setPoll((currentPoll) => ({
        ...currentPoll,
        votes: currentPoll.votes + 1,
      }));
    } catch (err) {
      console.error("Vote submission error:", err);
      setMessage(err.message || "Failed to submit your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="voting-page">
        <div className="voting-main-panel">
          <p>Loading poll...</p>
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="voting-page">
        <div className="voting-main-panel">
          <AlertCircle size={30} />
          <h2>Poll unavailable</h2>
          <p>{error || "This poll could not be found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voting-page">
      <div className="voting-layout">
        <main className="voting-main-panel">
          <div className="voting-top-label">
            <span className="voting-live-dot"></span>
            PUBLIC POLL
          </div>

          <h1>{poll.title}</h1>

          {poll.description && (
            <p className="voting-description">
              {poll.description}
            </p>
          )}

          <div className="voting-meta">
            <span>
              <Users size={15} />
              {poll.votes} votes
            </span>

            <span>
              <Clock3 size={15} />
              {poll.endTime
                ? `Ends ${new Date(poll.endTime).toLocaleDateString()}`
                : "No end date"}
            </span>
          </div>

          <div className="voting-divider"></div>

          <div className="voting-question-heading">
            <h2>Your answer</h2>
            <span>
              {poll.allowMultiple
                ? "Select all that apply"
                : "Select one option"}
            </span>
          </div>

          <form onSubmit={handleSubmitVote}>
            <div className="voting-options">
              {poll.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option.id);

                return (
                  <button
                    type="button"
                    key={option.id || index}
                    disabled={hasVoted || submitting}
                    className={`voting-option ${
                      isSelected ? "voting-option-selected" : ""
                    }`}
                    onClick={() => handleOptionChange(option.id)}
                  >
                    <span
                      className={`voting-choice-indicator ${
                        poll.allowMultiple ? "checkbox-indicator" : ""
                      } ${isSelected ? "selected" : ""}`}
                    >
                      {isSelected ? (
                        <Check size={14} />
                      ) : (
                        !poll.allowMultiple && index + 1
                      )}
                    </span>

                    <span className="voting-option-text">
                      {option.text}
                    </span>

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
                  <p
                    className="vote-validation-message"
                    role="alert"
                  >
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="primary-button submit-vote-button"
                  disabled={submitting}
                >
                  <Send size={16} />
                  {submitting ? "Submitting..." : "Submit Vote"}
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
                {poll.allowMultiple
                  ? "Multiple choice"
                  : "Single choice"}
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

export default PublicVotingPage;
