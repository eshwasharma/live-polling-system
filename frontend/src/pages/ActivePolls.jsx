
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
        {
          method: "POST",
        }
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

  return (
    <div className="dashboard-content">
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
            const createdDate = new Date(poll.createdAt);
            const isEnded = poll.status === "completed";

            return (
              <article className="active-poll-card" key={poll.id}>
                <div className="active-poll-card-top">
                  <div className="active-poll-icon">
                    <BarChart3 size={21} />
                  </div>

                  <span
                    className={`status-pill ${
                      isEnded
                        ? "status-completed"
                        : `status-${poll.status}`
                    }`}
                  >
                    {isEnded ? "completed" : poll.status}
                  </span>
                </div>

                <h2>{poll.title}</h2>

                <p className="active-poll-description">
                  {poll.description || "No description provided."}
                </p>

                <div className="active-poll-options">
                  <span>ANSWER OPTIONS</span>

                  {poll.options.map((option, index) => (
                    <div className="active-poll-option" key={index}>
                      <span className="option-number">
                        {index + 1}
                      </span>
                      <span>
                        {typeof option === "string"
                          ? option
                          : option.text}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="active-poll-card-footer">
                  <div>
                    <Users size={15} />
                    <span>{poll.votes || 0} votes</span>
                  </div>

                  <div>
                    <CalendarDays size={15} />
                    <span>
                      {createdDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="active-poll-card-bottom">
                  <div className="poll-schedule-details">
                    <span>
                      <CalendarDays size={14} />
                      {poll.startTime
                        ? `Starts: ${new Date(
                            poll.startTime
                          ).toLocaleString("en-IN")}`
                        : "Starts: Immediately"}
                    </span>

                    <span>
                      <Clock3 size={14} />
                      {poll.endTime
                        ? `Ends: ${new Date(
                            poll.endTime
                          ).toLocaleString("en-IN")}`
                        : "No end date set"}
                    </span>
                  </div>

                  <div className="active-poll-actions">
                    {!isEnded && poll.status === "active" && (
                      <button
                        className="text-button"
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
                      className="text-button share-poll-button"
                      type="button"
                      onClick={() => setSelectedPoll(poll)}
                    >
                      <Share2 size={15} />
                      Share
                    </button>

                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onViewPoll(poll)}
                    >
                      View Poll <ArrowUpRight size={15} />
                    </button>
                  </div>
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
