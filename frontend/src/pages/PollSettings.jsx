import { apiFetch } from "../utils/api";
import { useEffect, useState } from "react";
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
  Save,
  Plus,
  X,
} from "lucide-react";

function PollSettings({ poll, onBack, onRefresh }) {
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [settings, setSettings] = useState({
    allowMultipleAnswers: false,
    anonymousVoting: false,
    showResults: "after-voting",
    linkExpiration: "never",
  });

  const [editingPoll, setEditingPoll] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    question: "",
    options: [],
  });

  useEffect(() => {
    if (!poll) return;

    setSettings({
      allowMultipleAnswers:
        poll.settings?.allowMultipleAnswers ?? false,
      anonymousVoting: poll.settings?.anonymousVoting ?? false,
      showResults: poll.settings?.showResults || "after-voting",
      linkExpiration: poll.settings?.linkExpiration || "never",
    });

    setEditForm({
      title: poll.title || "",
      description: poll.description || "",
      question: poll.question || "",
      options: poll.options?.map((option) => ({
        id: option.id,
        text: option.text,
      })) || [],
    });
  }, [poll]);

  if (!poll) return null;

  const isActive = poll.status === "active";
  const isPaused = poll.status === "paused";
  const isCompleted = poll.status === "completed";

  const formatDate = (date) => {
    if (!date) return "Not scheduled";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleString("en-IN");
  };

  const createdDate = poll.createdAt
    ? new Date(poll.createdAt)
    : null;

  const handleSettingChange = (name, value) => {
    setSettings((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save settings.");
      }

      await onRefresh?.();
      setSuccess("Voting settings saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = async () => {
    const action = isPaused ? "resume" : "pause";

    if (
      !window.confirm(
        isPaused
          ? `Resume "${poll.title}"?`
          : `Pause "${poll.title}"?`
      )
    ) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/${action}`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to ${action} poll.`);
      }

      await onRefresh?.();
      setSuccess(
        isPaused
          ? "Poll resumed successfully."
          : "Poll paused successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEndPoll = async () => {
    if (
      !window.confirm(
        `End "${poll.title}"? Existing results will be preserved.`
      )
    ) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/end`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to end poll.");
      }

      await onRefresh?.();
      setSuccess("Poll ended successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestartPoll = async () => {
    if (
      !window.confirm(
        `Restart "${poll.title}"? The current votes will be cleared and the same poll link will be reused.`
      )
    ) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/restart`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to restart poll.");
      }

      await onRefresh?.();
      setSuccess("Poll restarted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Edit poll details.
  const handleEditPoll = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanedOptions = editForm.options.map((option) => ({
      id: option.id,
      text: option.text.trim(),
    }));

    if (!editForm.title.trim() || !editForm.question.trim()) {
      setError("Title and question are required.");
      return;
    }

    if (
      cleanedOptions.length < 2 ||
      cleanedOptions.some((option) => !option.text)
    ) {
      setError("Please provide at least two non-empty options.");
      return;
    }

    setProcessing(true);

    try {
      const response = await apiFetch(`/api/polls/${poll.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          question: editForm.question.trim(),
          options: cleanedOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update poll.");
      }

      setEditingPoll(false);
      await onRefresh?.();
      setSuccess("Poll updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Duplicate poll.
  const handleDuplicatePoll = async () => {
    if (
      !window.confirm(
        `Create a new poll using the details of "${poll.title}"? The new poll will have zero votes.`
      )
    ) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(
        `/api/polls/${poll.id}/duplicate`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to duplicate poll.");
      }

      await onRefresh?.();
      setSuccess("Poll duplicated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Delete poll.
  const handleDeletePoll = async () => {
    const confirmed = window.confirm(
      `Permanently delete "${poll.title}" and its voting data? This action cannot be undone.`
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiFetch(`/api/polls/${poll.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete poll.");
      }

      await onRefresh?.();
      onBack?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const updateOption = (index, value) => {
    setEditForm((previous) => ({
      ...previous,
      options: previous.options.map((option, i) =>
        i === index ? { ...option, text: value } : option
      ),
    }));
  };

  const addOption = () => {
    setEditForm((previous) => ({
      ...previous,
      options: [
        ...previous.options,
        { id: crypto.randomUUID(), text: "" },
      ],
    }));
  };

  const removeOption = (index) => {
    if (editForm.options.length <= 2) {
      setError("A poll must have at least two options.");
      return;
    }

    setEditForm((previous) => ({
      ...previous,
      options: previous.options.filter((_, i) => i !== index),
    }));
    setError("");
  };

  return (
    <div className="dashboard-content poll-settings-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to My Polls
      </button>

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

      {error && <p className="error-message" role="alert">{error}</p>}

      {success && (
        <p className="poll-action-success" role="status">
          <CheckCircle2 size={16} />
          {success}
        </p>
      )}

      {/* Poll Controls */}
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
                {processing ? "Please wait..." : isPaused ? "Resume" : "Pause"}
              </button>
            )}
          </div>

          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon danger">
                <SquareStop size={19} />
              </div>
              <div>
                <h3>End Poll</h3>
                <p>Permanently close voting for this poll.</p>
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
                End Poll
              </button>
            ) : (
              <span className="poll-settings-disabled-label">
                {isCompleted ? "Already ended" : "Not available"}
              </span>
            )}
          </div>

          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon">
                <RotateCcw size={19} />
              </div>
              <div>
                <h3>Restart Poll</h3>
                <p>Start a fresh voting round using the same poll link.</p>
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
                Restart Poll
              </button>
            ) : (
              <span className="poll-settings-disabled-label">
                Available after poll ends
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Voting Settings */}
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

        <div className="poll-settings-form">
          <label className="poll-settings-form-row">
            <div>
              <h3>Allow multiple answers</h3>
              <p>Allow participants to select more than one option.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.allowMultipleAnswers}
              onChange={(e) =>
                handleSettingChange("allowMultipleAnswers", e.target.checked)
              }
            />
          </label>

          <label className="poll-settings-form-row">
            <div>
              <h3>Anonymous voting</h3>
              <p>Keep voter identity out of displayed results.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.anonymousVoting}
              onChange={(e) =>
                handleSettingChange("anonymousVoting", e.target.checked)
              }
            />
          </label>

          <div className="poll-settings-form-row">
            <div>
              <h3>Results visibility</h3>
              <p>Choose when participants can see results.</p>
            </div>
            <select
              value={settings.showResults}
              onChange={(e) =>
                handleSettingChange("showResults", e.target.value)
              }
            >
              <option value="after-voting">After voting</option>
              <option value="always">Always visible</option>
              <option value="after-end">Only after poll ends</option>
            </select>
          </div>

          <div className="poll-settings-form-row">
            <div>
              <h3>Link expiration</h3>
              <p>Choose how long the public voting link remains valid.</p>
            </div>
            <select
              value={settings.linkExpiration}
              onChange={(e) =>
                handleSettingChange("linkExpiration", e.target.value)
              }
            >
              <option value="never">Never</option>
              <option value="1-day">1 day</option>
              <option value="7-days">7 days</option>
              <option value="30-days">30 days</option>
            </select>
          </div>

          <div className="poll-settings-save-row">
            <button
              className="poll-settings-primary-button"
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Voting Settings"}
            </button>
          </div>
        </div>
      </section>

      {/* Poll Editing */}
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
            <button
              className="poll-settings-primary-button"
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setEditingPoll(true);
              }}
              disabled={processing}
            >
              <Pencil size={15} />
              Edit Poll
            </button>
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
            <button
              className="poll-settings-primary-button"
              type="button"
              onClick={handleDuplicatePoll}
              disabled={processing}
            >
              <Copy size={15} />
              Duplicate
            </button>
          </div>

          <div className="poll-settings-action">
            <div className="poll-settings-action-info">
              <div className="poll-settings-action-icon danger">
                <Trash2 size={19} />
              </div>
              <div>
                <h3>Delete Poll</h3>
                <p>Permanently remove this poll and its votes.</p>
              </div>
            </div>
            <button
              className="poll-settings-primary-button danger-button"
              type="button"
              onClick={handleDeletePoll}
              disabled={processing}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
      </section>

      {/* Poll Information */}
      <section className="poll-settings-section">
        <div className="poll-settings-section-heading">
          <div className="poll-settings-section-icon">
            <Info size={20} />
          </div>
          <div>
            <h2>Poll Information</h2>
            <p>Schedule is managed during poll creation.</p>
          </div>
        </div>

        <div className="poll-information-grid">
          <div className="poll-information-item">
            <span><Users size={15} /> Total Votes</span>
            <strong>{poll.votes || 0}</strong>
          </div>
          <div className="poll-information-item">
            <span><CalendarDays size={15} /> Created On</span>
            <strong>{formatDate(createdDate)}</strong>
          </div>
          <div className="poll-information-item">
            <span><Clock3 size={15} /> Start Time</span>
            <strong>{formatDate(poll.startTime)}</strong>
          </div>
          <div className="poll-information-item">
            <span><Clock3 size={15} /> End Time</span>
            <strong>{formatDate(poll.endTime)}</strong>
          </div>
          <div className="poll-information-item full">
            <span><Info size={15} /> Poll ID</span>
            <strong>{poll.id}</strong>
          </div>
        </div>
      </section>

      {/* Inline Edit Poll Form */}
      {editingPoll && (
        <div
          className="edit-poll-overlay"
          onMouseDown={() => setEditingPoll(false)}
        >
          <div
            className="edit-poll-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="edit-poll-header">
              <div>
                <h2>Edit Poll</h2>
                <p>Update your poll details and answer options.</p>
              </div>
              <button
                type="button"
                className="edit-poll-close"
                onClick={() => setEditingPoll(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditPoll}>
              <div className="edit-poll-field">
                <label>Poll Title</label>
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, title: e.target.value })
                  }
                  maxLength={120}
                  required
                />
              </div>

              <div className="edit-poll-field">
                <label>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="edit-poll-field">
                <label>Poll Question</label>
                <input
                  value={editForm.question}
                  onChange={(e) =>
                    setEditForm({ ...editForm, question: e.target.value })
                  }
                  required
                />
              </div>

              <div className="edit-poll-options-heading">
                <div>
                  <h3>Answer Options</h3>
                  <p>Add or remove choices.</p>
                </div>
                <span>{editForm.options.length} options</span>
              </div>

              <div className="edit-poll-options">
                {editForm.options.map((option, index) => (
                  <div className="edit-poll-option" key={option.id || index}>
                    <span className="edit-poll-option-number">
                      {index + 1}
                    </span>
                    <input
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="edit-poll-remove-option"
                      onClick={() => removeOption(index)}
                      disabled={editForm.options.length <= 2}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="edit-poll-add-option"
                onClick={addOption}
              >
                <Plus size={17} />
                Add Option
              </button>

              <div className="edit-poll-footer">
                <button
                  type="button"
                  className="edit-poll-cancel"
                  onClick={() => setEditingPoll(false)}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="edit-poll-save"
                  disabled={processing}
                >
                  <Save size={16} />
                  {processing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PollSettings;
