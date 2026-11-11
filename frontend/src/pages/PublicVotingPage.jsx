
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";
import {
  Users,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Send,
  Check,
  BarChart3,
} from "lucide-react";

// Backend URL configured through Vercel's VITE_API_URL.
// If empty, local development uses the Vite proxy.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function getWebSocketURL(path) {
  if (API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${path}`;
    return url.toString();
  }

  // Local development: use the Vite WebSocket proxy.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

// Generate or retrieve a voter ID for a specific poll round.
// Round 1 keeps the original storage key for compatibility with existing votes.
function getVoterId(pollId, round = 1) {
  const storageKey =
    round <= 1
      ? `pulsepoll-voter-${pollId}`
      : `pulsepoll-voter-${pollId}-${round}`;

  let savedVoterId = localStorage.getItem(storageKey);

  if (!savedVoterId) {
    savedVoterId = crypto.randomUUID();
    localStorage.setItem(storageKey, savedVoterId);
  }

  return savedVoterId;
}

// Check whether this browser has already voted in this poll round.
function hasBrowserVoted(pollId, round = 1) {
  const storageKey =
    round <= 1
      ? `pulsepoll-voted-${pollId}`
      : `pulsepoll-voted-${pollId}-${round}`;

  return localStorage.getItem(storageKey) === "true";
}

// Save the voting status for this poll round in this browser.
function saveVotedStatus(pollId, round = 1) {
  const storageKey =
    round <= 1
      ? `pulsepoll-voted-${pollId}`
      : `pulsepoll-voted-${pollId}-${round}`;

  localStorage.setItem(storageKey, "true");
}

function PublicVotingPage() {
  const { id } = useParams();

  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [voterName, setVoterName] = useState("");
  const [voterEmail, setVoterEmail] = useState("");

  // Keep track of current time for scheduled poll availability.
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Results state.
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState("");

  // Fetch poll details.
  useEffect(() => {
    async function fetchPoll() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(`/api/polls/${id}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load this poll.");
        }

        const savedPoll = data.poll;
        const currentRound = savedPoll.round || 1;
        const alreadyVoted = hasBrowserVoted(id, currentRound);

        setPoll({
          ...savedPoll,
          options: savedPoll.options || [],
          votes: savedPoll.votes || 0,
          allowMultiple:
            savedPoll.settings?.allowMultipleAnswers || false,
          anonymous:
            savedPoll.settings?.anonymousVoting ?? true,
        });

        getVoterId(id, currentRound);
        setHasVoted(alreadyVoted);
      } catch (err) {
        console.error("Public poll fetch error:", err);
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    fetchPoll();
  }, [id]);

  // Update current time every second.
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Connect to the backend WebSocket for live poll updates.
  useEffect(() => {
    if (!id) return;

    let socket;
    let reconnectTimer;
    let shouldReconnect = true;

    function connectWebSocket() {
      if (!shouldReconnect) return;

      const wsUrl = getWebSocketURL(`/api/polls/${id}/ws`);

      console.log("Connecting to poll WebSocket:", wsUrl);

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("Connected to live poll updates:", id);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type !== "results") return;

          const updatedOptions = (data.options || []).map((option) => ({
            ...option,
            optionId: option.optionId || option.id,
          }));

          setPoll((currentPoll) => {
            if (!currentPoll) return currentPoll;

            return {
              ...currentPoll,
              votes: data.totalVotes,
            };
          });

          setResults((currentResults) => {
            if (!currentResults) return currentResults;

            return {
              ...data,
              options: updatedOptions,
            };
          });

          console.log("Live poll results updated:", data.totalVotes);
        } catch (err) {
          console.error("Invalid WebSocket message:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("Poll WebSocket error:", err);
      };

      socket.onclose = () => {
        console.log("Poll WebSocket disconnected:", id);

        if (shouldReconnect) {
          reconnectTimer = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };
    }

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimer);

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [id]);

  // Determine whether the poll is currently accepting votes.
  const startTime = poll?.startTime
    ? new Date(poll.startTime).getTime()
    : null;

  const endTime = poll?.endTime
    ? new Date(poll.endTime).getTime()
    : null;

  const isBeforeStart =
    startTime !== null && currentTime < startTime;

  const isAfterEnd =
    endTime !== null && currentTime >= endTime;

  const isScheduled =
    poll?.status === "scheduled" || isBeforeStart;

  const isCompleted =
    poll?.status === "completed" || isAfterEnd;

  const resultsVisibility = poll?.settings?.showResults || "after-voting";

  const canViewResults =
    resultsVisibility === "always" ||
    (resultsVisibility === "after-voting" && hasVoted) ||
    (resultsVisibility === "after-end" && isCompleted);

  const canVote =
    poll?.status === "active" &&
    !isBeforeStart &&
    !isAfterEnd;

  function handleOptionChange(optionId) {
    if (!canVote || hasVoted || submitting) return;

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

    if (!canVote || hasVoted || submitting) {
      if (!canVote) {
        setMessage("This poll is not currently accepting votes.");
      }
      return;
    }

    const currentRound = poll.round || 1;

    if (hasBrowserVoted(id, currentRound)) {
      setHasVoted(true);
      return;
    }

    if (selectedOptions.length === 0) {
      setMessage("Please select at least one option.");
      return;
    }

    if (!poll.anonymous) {
      if (!voterName.trim() || !voterEmail.trim()) {
        setMessage("Please enter your name and email address.");
        return;
      }

      if (voterName.trim().length > 100) {
        setMessage("Name cannot exceed 100 characters.");
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(voterEmail.trim())) {
        setMessage("Please enter a valid email address.");
        return;
      }
    }

    setSubmitting(true);
    setMessage("");

    try {
      const currentVoterId = getVoterId(
        id,
        poll.round || 1
      );

      const response = await apiFetch(`/api/polls/${id}/votes`, {
        method: "POST",
        body: JSON.stringify({
          optionIds: selectedOptions,
          voterId: currentVoterId,
          ...(poll.anonymous
            ? {}
            : {
                voterName: voterName.trim(),
                voterEmail: voterEmail.trim().toLowerCase(),
              }),
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        saveVotedStatus(id, poll.round || 1);
        setHasVoted(true);
        setMessage("");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to submit your vote.");
      }

      saveVotedStatus(id, poll.round || 1);
      setHasVoted(true);
      setMessage("");

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

  // Fetch actual results from MongoDB.
  async function handleViewResults() {
    setLoadingResults(true);
    setResultsError("");

    try {
      const response = await apiFetch(`/api/polls/${id}/results`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load results.");
      }

      setResults({
        ...data,
        options: (data.options || []).map((option) => ({
          ...option,
          optionId: option.optionId || option.id,
        })),
      });

      setPoll((currentPoll) => ({
        ...currentPoll,
        votes: data.totalVotes,
      }));
    } catch (err) {
      console.error("Fetch results error:", err);
      setResultsError(err.message || "Unable to load results.");
    } finally {
      setLoadingResults(false);
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
                ? `Ends ${new Date(poll.endTime).toLocaleDateString("en-IN")}`
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

          {/* Scheduled poll message */}
          {isScheduled && (
            <div className="vote-validation-message" role="status">
              <Clock3 size={17} />
              This poll hasn't started yet. Voting will be available from{" "}
              {poll.startTime
                ? new Date(poll.startTime).toLocaleString("en-IN")
                : "its scheduled start time"}.
            </div>
          )}

          {/* Completed poll message */}
          {isCompleted && (
            <div className="vote-validation-message" role="status">
              This poll has ended. Voting is now closed.
            </div>
          )}

          <form onSubmit={handleSubmitVote}>
            {!poll.anonymous && !hasVoted && (
              <div
                className="voter-identity-fields"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                  marginBottom: "20px",
                }}
              >
                <label style={{ display: "grid", gap: "7px", fontWeight: 600 }}>
                  Your name
                  <input
                    type="text"
                    value={voterName}
                    onChange={(event) => setVoterName(event.target.value)}
                    placeholder="Enter your full name"
                    maxLength={100}
                    autoComplete="name"
                    required
                    disabled={!canVote || submitting}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid #d9d6e7",
                      borderRadius: "10px",
                      outlineColor: "#6854df",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: "7px", fontWeight: 600 }}>
                  Email address
                  <input
                    type="email"
                    value={voterEmail}
                    onChange={(event) => setVoterEmail(event.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    required
                    disabled={!canVote || submitting}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid #d9d6e7",
                      borderRadius: "10px",
                      outlineColor: "#6854df",
                    }}
                  />
                </label>
              </div>
            )}

            <div className="voting-options">
              {poll.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option.id);

                return (
                  <button
                    type="button"
                    key={option.id || index}
                    disabled={!canVote || hasVoted || submitting}
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
                  <p className="vote-validation-message" role="alert">
                    {message}
                  </p>
                )}

                <button
                  type="submit"
                  className="primary-button submit-vote-button"
                  disabled={!canVote || submitting}
                >
                  <Send size={16} />
                  {submitting ? "Submitting..." : "Submit Vote"}
                </button>
              </>
            )}
          </form>

          {/* View Results button */}
          {canViewResults && (
            <button
              type="button"
              className="primary-button submit-vote-button"
              onClick={handleViewResults}
              disabled={loadingResults}
              style={{ marginTop: "16px" }}
            >
              <BarChart3 size={17} />
              {loadingResults ? "Loading Results..." : "View Results"}
            </button>
          )}

          {/* Results error */}
          {resultsError && (
            <p className="vote-validation-message" role="alert">
              {resultsError}
            </p>
          )}

          {/* Live results updated through WebSocket */}
          {results && canViewResults && (
            <div className="voting-results" style={{ marginTop: "28px" }}>
              <h2>Poll Results</h2>

              <p>
                Total votes: <strong>{results.totalVotes}</strong>
              </p>

              {(results.options || []).map((option) => (
                <div
                  key={option.optionId || option.id}
                  className="result-option"
                  style={{ marginTop: "20px" }}
                >
                  <div
                    className="result-option-header"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <span>{option.text}</span>

                    <strong>
                      {option.votes} votes (
                      {Number(option.percentage).toFixed(1)}%)
                    </strong>
                  </div>

                  <div
                    className="result-progress-track"
                    style={{
                      width: "100%",
                      height: "10px",
                      background: "#eeeafc",
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="result-progress-fill"
                      style={{
                        width: `${option.percentage}%`,
                        height: "100%",
                        background: "#6854df",
                        borderRadius: "10px",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
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
            {poll.anonymous
              ? "Your vote is anonymous. Your name and email are not collected."
              : "Your name and email are recorded with your vote and are visible to the poll creator."}
          </p>
        </aside>
      </div>
    </div>
  );
}

export default PublicVotingPage;
