
import { useState } from "react";
import {
  Radio,
  Users,
  CalendarDays,
  ArrowUpRight,
  BarChart3,
  Clock3,
  FileText,
  Share2,
  SquareStop,
} from "lucide-react";

import SharePollModal from "../components/SharePollModal";
import { apiFetch } from "../utils/api";

function ActivePolls({
  polls,
  onViewPoll,
  onRefresh,
  pageTitle = "Active Polls",
}) {
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [endingPollId, setEndingPollId] = useState(null);
  const [error, setError] = useState("");

  const handleEndPoll = async (poll) => {
    const confirmed = window.confirm(
      `Are you sure you want to end "${poll.title}"? No one will be able to vote after this.`
    );

    if (!confirmed) return;

    setError("");
    setEndingPollId(poll.id);

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/end`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to end poll.");
      }

      if (onRefresh) {
        await onRefresh();
      }

      alert("Poll ended successfully!");
    } catch (err) {
      setError(
        err.message || "Something went wrong while ending the poll."
      );
    } finally {
      setEndingPollId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return null;

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="dashboard-content active-polls-page">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">POLL MANAGEMENT</p>
          <h1>{pageTitle}</h1>
          <p className="welcome-description">
            Manage your polls and keep track of responses.
          </p>
        </div>

        <div className="active-poll-count">
          <Radio size={17} />
          {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
        </div>
      </section>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {polls.length === 0 ? (
        <div className="empty-polls-panel">
          <div className="empty-polls-icon">
            <FileText size={28} />
          </div>

          <h2>
            {pageTitle === "Past Polls"
              ? "No past polls yet"
              : "No active polls yet"}
          </h2>

          <p>
            {pageTitle === "Past Polls"
              ? "Completed polls will appear here."
              : "You haven't published any active polls yet. Create or schedule a poll to get started."}
          </p>
        </div>
      ) : (
        <div className="active-polls-grid">
          {polls.map((poll) => {
            const createdDate = formatDate(poll.createdAt);
            const startDate = formatDate(poll.startTime);
            const endDate = formatDate(poll.endTime);
            const isEnded = poll.status === "completed";
            const options = poll.options || [];

            return (
              <article className="active-poll-card" key={poll.id}>
                {/* Card header */}
                <div className="ap-card-header">
                  <div className="ap-card-icon">
                    <BarChart3 size={22} />
                  </div>

                  <span
                    className={`status-pill ${
                      isEnded
                        ? "status-completed"
                        : `status-${poll.status}`
                    }`}
                  >
                    <span className="ap-status-dot" />
                    {isEnded ? "Completed" : poll.status}
                  </span>
                </div>

                {/* Poll details */}
                <div className="ap-card-content">
                  <h2>{poll.title}</h2>

                  <p className="active-poll-description">
                    {poll.description || "No description provided."}
                  </p>
                </div>

                {/* Answer options */}
                <div className="ap-options-container">
                  <div className="ap-options-heading">
                    <span>ANSWER OPTIONS</span>
                    <span>{options.length} choices</span>
                  </div>

                  <div className="ap-options-list">
                    {options.map((option, index) => (
                      <div className="ap-option-row" key={option.id || index}>
                        <span className="ap-option-number">
                          {index + 1}
                        </span>

                        <span className="ap-option-text">
                          {typeof option === "string"
                            ? option
                            : option.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Poll statistics */}
                <div className="ap-card-stats">
                  <div className="ap-stat">
                    <Users size={16} />
                    <span>{poll.votes || 0} votes</span>
                  </div>

                  <div className="ap-stat">
                    <CalendarDays size={16} />
                    <span>{createdDate || "Date unavailable"}</span>
                  </div>
                </div>

                {/* Schedule details */}
                <div className="ap-schedule">
                  <div className="ap-schedule-item">
                    <CalendarDays size={15} />
                    <span className="ap-schedule-label">Starts</span>
                    <strong>
                      {startDate || "Immediately"}
                    </strong>
                  </div>

                  <div className="ap-schedule-item">
                    <Clock3 size={15} />
                    <span className="ap-schedule-label">Ends</span>
                    <strong>
                      {endDate || "No end date"}
                    </strong>
                  </div>
                </div>

                {/* Actions */}
                <div className="ap-card-actions">
                  {!isEnded && poll.status === "active" && (
                    <button
                      className="ap-action-button ap-end-button"
                      type="button"
                      onClick={() => handleEndPoll(poll)}
                      disabled={endingPollId === poll.id}
                    >
                      <SquareStop size={15} />
                      {endingPollId === poll.id
                        ? "Ending..."
                        : "End Poll"}
                    </button>
                  )}

                  <button
                    className="ap-action-button"
                    type="button"
                    onClick={() => setSelectedPoll(poll)}
                  >
                    <Share2 size={16} />
                    Share
                  </button>

                  <button
                    className="ap-action-button ap-view-button"
                    type="button"
                    onClick={() => onViewPoll(poll)}
                  >
                    <BarChart3 size={16} />
                    View Poll
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedPoll && (
        <SharePollModal
          poll={selectedPoll}
          onClose={() => setSelectedPoll(null)}
        />
      )}
    </div>
  );
}

export default ActivePolls;
