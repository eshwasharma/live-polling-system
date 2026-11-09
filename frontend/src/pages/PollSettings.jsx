
import { useState } from "react";
import {
  ArrowLeft,
  Settings,
  SlidersHorizontal,
  Pencil,
  Info,
  Pause,
  Play,
  SquareStop,
  RotateCcw,
  Copy,
  Trash2,
  CalendarDays,
  Users,
  Clock3,
  CheckCircle2,
} from "lucide-react";

function PollSettings({ poll, onBack, onRefresh }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!poll) return null;

  const isActive = poll.status === "active";
  const isPaused = poll.status === "paused";
  const isCompleted = poll.status === "completed";

  // Pause or resume the selected poll.
  const handlePauseResume = async () => {
    const action = isPaused ? "resume" : "pause";

    const confirmed = window.confirm(
      isPaused
        ? `Resume "${poll.title}"? Participants will be able to vote again.`
        : `Pause "${poll.title}"? Participants will temporarily be unable to vote.`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/polls/${poll.id}/${action}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} poll.`);
      }

      if (onRefresh) {
        await onRefresh();
      }

      setSuccess(
        isPaused
          ? "Poll resumed successfully."
          : "Poll paused successfully."
      );
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  // End the selected poll.
  const handleEndPoll = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to end "${poll.title}"? Participants will no longer be able to vote. Existing results will be preserved.`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
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

      setSuccess("Poll ended successfully!");
    } catch (err) {
      console.error("End poll error:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  // Restart the selected completed poll.
  // A new poll is created while the original poll and its votes are preserved.
  const handleRestartPoll = async () => {
    const confirmed = window.confirm(
      `Restart "${poll.title}"? A new poll will be created with the same question and options. Previous voting results will be preserved.`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/polls/${poll.id}/restart`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to restart poll.");
      }

      if (onRefresh) {
        await onRefresh();
      }

      setSuccess(
        "Poll restarted successfully! A new poll has been created with zero votes. Previous results are preserved."
      );
    } catch (err) {
      console.error("Restart poll error:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setProcessing(false);
    }
  };

  const createdDate = poll.createdAt
    ? new Date(poll.createdAt)
    : null;

  const formatDate = (date) => {
    if (!date) return "Not scheduled";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleString("en-IN");
  };

  return (
    <div className="dashboard-content poll-settings-page">
      <button
        className="back-button"
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        Back to My Polls
      </button>

      {/* Page heading */}
      <section className="welcome-section poll-settings-heading">
        <div>
          <p className="eyebrow">POLL MANAGEMENT</p>
          <h1>Poll Settings</h1>
          <p className="welcome-description">
            Manage the settings and controls for this poll.
          </p>
        </div>

        <span className={`status-pill status-${poll.status}`}>
          {poll.status}
        </span>
      </section>

      <section className="poll-settings-title-card">
        <div className="active-poll-icon">
          <Settings size={23} />
        </div>

        <div>
          <h2>{poll.title}</h2>
          <p>{poll.description || "No description provided."}</p>
        </div>
      </section>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="poll-action-success" role="status">
          <CheckCircle2 size={16} />
          {success}
        </p>
      )}

      {/* 1. Poll Controls */}
      <section className="poll-settings-section">
        <div className="poll-settings-section-heading">
          <div className="poll-settings-section-icon">
            <SlidersHorizontal size={20} />
          </div>

          <div>
            <h2>Poll Controls</h2>
            <p>Control the current voting activity.</p>
          </div>
        </div>

        <div className="poll-settings-action-list">
          {/* Pause / Resume */}
          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon">
                {isPaused ? <Play size={19} /> : <Pause size={19} />}
              </div>

              <div>
                <h3>{isPaused ? "Resume Poll" : "Pause Poll"}</h3>
                <p>
                  {isPaused
                    ? "Allow participants to vote again."
                    : "Temporarily stop participants from voting."}
                </p>
              </div>
            </div>

            {(isActive || isPaused) && (
              <button
                className="poll-settings-primary-button"
                type="button"
                onClick={handlePauseResume}
                disabled={processing}
              >
                {isPaused ? <Play size={15} /> : <Pause size={15} />}
                {processing
                  ? "Please wait..."
                  : isPaused
                    ? "Resume"
                    : "Pause"}
              </button>
            )}

            {isCompleted && (
              <span className="poll-settings-disabled-label">
                Poll ended
              </span>
            )}

            {poll.status === "scheduled" && (
              <span className="poll-settings-disabled-label">
                Not started
              </span>
            )}
          </div>

          {/* End Poll */}
          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon danger">
                <SquareStop size={19} />
              </div>

              <div>
                <h3>End Poll</h3>
                <p>
                  Permanently close voting for this poll.
                  Existing results will be preserved.
                </p>
              </div>
            </div>

            {(isActive || isPaused) ? (
              <button
                className="poll-settings-primary-button"
                type="button"
                onClick={handleEndPoll}
                disabled={processing}
              >
                <SquareStop size={15} />
                {processing ? "Please wait..." : "End Poll"}
              </button>
            ) : (
              <span className="poll-settings-disabled-label">
                {isCompleted ? "Already ended" : "Not available"}
              </span>
            )}
          </div>

          {/* Restart Poll */}
          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon">
                <RotateCcw size={19} />
              </div>

              <div>
                <h3>Restart Poll</h3>
                <p>
                  Start a fresh voting round while preserving previous results.
                </p>
              </div>
            </div>

            {isCompleted ? (
              <button
                className="poll-settings-primary-button"
                type="button"
                onClick={handleRestartPoll}
                disabled={processing}
              >
                <RotateCcw size={15} />
                {processing ? "Please wait..." : "Restart Poll"}
              </button>
            ) : (
              <span className="poll-settings-disabled-label">
                Available after poll ends
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Voting Settings */}
      <section className="poll-settings-section">
        <div className="poll-settings-section-heading">
          <div className="poll-settings-section-icon">
            <Settings size={20} />
          </div>

          <div>
            <h2>Voting Settings</h2>
            <p>Configure how participants can vote.</p>
          </div>
        </div>

        <div className="poll-settings-placeholder">
          <div className="poll-settings-placeholder-row">
            <div>
              <h3>Allow multiple answers</h3>
              <p>Allow participants to select more than one option.</p>
            </div>

            <span>
              {poll.settings?.allowMultipleAnswers
                ? "Enabled"
                : "Disabled"}
            </span>
          </div>

          <div className="poll-settings-placeholder-row">
            <div>
              <h3>Anonymous voting</h3>
              <p>Control voter identity handling.</p>
            </div>

            <span>
              {poll.settings?.anonymousVoting
                ? "Enabled"
                : "Disabled"}
            </span>
          </div>

          <div className="poll-settings-placeholder-row">
            <div>
              <h3>Results visibility</h3>
              <p>Control when participants can see results.</p>
            </div>

            <span>
              {poll.settings?.showResults || "After voting"}
            </span>
          </div>

          <div className="poll-settings-placeholder-row">
            <div>
              <h3>Poll schedule</h3>
              <p>Manage the poll's start and end times.</p>
            </div>

            <span>View below</span>
          </div>

          <p className="poll-settings-note">
            Editing these settings will be enabled in the next stage.
          </p>
        </div>
      </section>

      {/* 3. Poll Editing */}
      <section className="poll-settings-section">
        <div className="poll-settings-section-heading">
          <div className="poll-settings-section-icon">
            <Pencil size={20} />
          </div>

          <div>
            <h2>Poll Editing</h2>
            <p>Edit, duplicate or delete this poll.</p>
          </div>
        </div>

        <div className="poll-settings-action-list">
          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon">
                <Pencil size={19} />
              </div>

              <div>
                <h3>Edit Poll</h3>
                <p>Change the title, description and answer options.</p>
              </div>
            </div>

            <span className="poll-settings-coming-soon">
              Coming next
            </span>
          </div>

          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon">
                <Copy size={19} />
              </div>

              <div>
                <h3>Duplicate Poll</h3>
                <p>Create a new poll using these details.</p>
              </div>
            </div>

            <span className="poll-settings-coming-soon">
              Coming next
            </span>
          </div>

          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon danger">
                <Trash2 size={19} />
              </div>

              <div>
                <h3>Delete Poll</h3>
                <p>Permanently remove this poll.</p>
              </div>
            </div>

            <span className="poll-settings-coming-soon">
              Coming next
            </span>
          </div>
        </div>
      </section>

      {/* 4. Poll Information */}
      <section className="poll-settings-section">
        <div className="poll-settings-section-heading">
          <div className="poll-settings-section-icon">
            <Info size={20} />
          </div>

          <div>
            <h2>Poll Information</h2>
            <p>Details about this poll.</p>
          </div>
        </div>

        <div className="poll-information-grid">
          <div className="poll-information-item">
            <span>
              <Users size={15} />
              Total Votes
            </span>

            <strong>{poll.votes || 0}</strong>
          </div>

          <div className="poll-information-item">
            <span>
              <CalendarDays size={15} />
              Created On
            </span>

            <strong>{formatDate(createdDate)}</strong>
          </div>

          <div className="poll-information-item">
            <span>
              <Clock3 size={15} />
              Start Time
            </span>

            <strong>{formatDate(poll.startTime)}</strong>
          </div>

          <div className="poll-information-item">
            <span>
              <Clock3 size={15} />
              End Time
            </span>

            <strong>{formatDate(poll.endTime)}</strong>
          </div>

          <div className="poll-information-item full">
            <span>
              <Info size={15} />
              Poll ID
            </span>

            <strong>{poll.id}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PollSettings;
