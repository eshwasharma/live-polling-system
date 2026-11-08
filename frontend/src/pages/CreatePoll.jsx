
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  Users,
  Plus,
  Trash2,
  Clock3,
  CalendarDays,
  Eye,
  EyeOff,
  Check,
  WandSparkles,
} from "lucide-react";

const templates = [
  {
    title: "Team Feedback",
    description: "Collect opinions and suggestions from your team.",
    category: "Professional",
    question: "What should we improve in our workplace?",
    options: ["Communication", "Work environment", "Team collaboration", "Other"],
  },
  {
    title: "Meeting Schedule",
    description: "Find the most convenient time for everyone.",
    category: "Professional",
    question: "When should we schedule our next meeting?",
    options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  },
  {
    title: "Weekend Plans",
    description: "Decide what to do with your friends.",
    category: "Friends & Social",
    question: "What should we do this weekend?",
    options: ["Movie", "Dinner", "Road trip", "Game night"],
  },
  {
    title: "Food Preferences",
    description: "Let everyone choose their favourite food.",
    category: "Friends & Social",
    question: "What should we order?",
    options: ["Pizza", "Burgers", "Chinese", "South Indian"],
  },
];

function CreatePoll({ onPublish }) {
  const [creationMode, setCreationMode] = useState("choose");
  const [templateCategory, setTemplateCategory] = useState("All");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [showResults, setShowResults] = useState("after-voting");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [linkExpiration, setLinkExpiration] = useState("never");

  const [successMessage, setSuccessMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const filteredTemplates =
    templateCategory === "All"
      ? templates
      : templates.filter(
          (template) => template.category === templateCategory
        );

  function startCustomPoll() {
    setCreationMode("editor");
    setTitle("");
    setDescription("");
    setOptions(["", ""]);
    setSuccessMessage("");
    setAiError("");
  }

  function chooseTemplate(template) {
    setTitle(template.question);
    setDescription(template.description);
    setOptions(template.options);
    setCreationMode("editor");
    setSuccessMessage("");
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  }

  function updateOption(index, value) {
    setOptions(
      options.map((option, i) => (i === index ? value : option))
    );
  }

  function removeOption(index) {
    if (options.length <= 2) return;

    setOptions(options.filter((_, i) => i !== index));
  }

  // Real Gemini AI poll generation
  async function generateAIPoll() {
    if (!aiPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setAiError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/ai/generate-poll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to generate poll. Please try again."
        );
      }

      const generatedPoll = data.poll;

      if (
        !generatedPoll ||
        !generatedPoll.question ||
        !Array.isArray(generatedPoll.options) ||
        generatedPoll.options.length < 2 ||
        generatedPoll.options.length > 6
      ) {
        throw new Error(
          "AI returned an incomplete poll. Please try again."
        );
      }

      setTitle(generatedPoll.question);
      setDescription(generatedPoll.description || "");
      setOptions(generatedPoll.options);

      setCreationMode("editor");
    } catch (error) {
      console.error("AI poll generation error:", error);

      setAiError(
        error.message ||
          "Something went wrong while generating your poll."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function publishPoll(event) {
    event.preventDefault();

    if (isPublishing) return;

    const validOptions = options
      .map((option) => option.trim())
      .filter(Boolean);

    if (!title.trim()) {
      setSuccessMessage("Please enter a poll question.");
      return;
    }

    if (validOptions.length < 2) {
      setSuccessMessage("Please add at least two answer options.");
      return;
    }

    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      setSuccessMessage("End time must be later than start time.");
      return;
    }

    setIsPublishing(true);
    setSuccessMessage("");

    const newPoll = {
      title: title.trim(),
      description: description.trim(),
      options: validOptions,
      allowMultiple,
      anonymous,
      showResults,
      startTime,
      endTime,
      linkExpiration,
    };

    try {
      await onPublish(newPoll);
    } catch (error) {
      setSuccessMessage(
        error.message || "Failed to publish poll. Please try again."
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function goBack() {
    setCreationMode("choose");
    setSuccessMessage("");
    setAiError("");
  }

  return (
    <div className="create-poll-page">
      <div className="create-page-heading">
        <div>
          <p className="eyebrow">POLL WORKSPACE</p>
          <h1>Create a Poll</h1>
          <p className="create-page-subtitle">
            Ask a question, gather opinions and make decisions together.
          </p>
        </div>
      </div>

      {creationMode === "choose" && (
        <>
          <div className="creation-method-grid">
            <button
              className="creation-method-card"
              onClick={startCustomPoll}
            >
              <div className="creation-method-icon purple">
                <FileText size={23} />
              </div>
              <span className="method-label">CUSTOM POLL</span>
              <h2>Start from scratch</h2>
              <p>
                Create your own question, add answer options and customise
                the voting settings.
              </p>
              <span className="method-link">
                Create custom poll <ArrowRight size={16} />
              </span>
            </button>

            <button
              className="creation-method-card"
              onClick={() => setCreationMode("templates")}
            >
              <div className="creation-method-icon blue">
                <Users size={23} />
              </div>
              <span className="method-label">READY-MADE</span>
              <h2>Use a template</h2>
              <p>
                Get started quickly with ready-made polls for work, teams
                and social gatherings.
              </p>
              <span className="method-link">
                Explore templates <ArrowRight size={16} />
              </span>
            </button>

            <button
              className="creation-method-card ai-method-card"
              onClick={() => {
                setCreationMode("ai");
                setAiError("");
              }}
            >
              <div className="creation-method-icon orange">
                <Sparkles size={23} />
              </div>
              <span className="method-label">AI POWERED</span>
              <h2>Generate with AI</h2>
              <p>
                Describe what you want to ask and let AI help create your
                poll.
              </p>
              <span className="method-link">
                Generate a poll <ArrowRight size={16} />
              </span>
            </button>
          </div>

          <div className="creation-note">
            <div className="creation-note-icon">
              <Check size={18} />
            </div>
            <div>
              <strong>You're in control</strong>
              <p>
                You can edit your poll, change its settings and review
                everything before publishing.
              </p>
            </div>
          </div>
        </>
      )}

      {creationMode === "templates" && (
        <section className="poll-workspace-panel">
          <div className="workspace-heading">
            <div>
              <button className="back-button" onClick={goBack}>
                <ArrowLeft size={16} /> Back
              </button>
              <h2>Choose a template</h2>
              <p>Pick a starting point. You can edit it before publishing.</p>
            </div>
          </div>

          <div className="template-filters">
            {["All", "Professional", "Friends & Social"].map((category) => (
              <button
                key={category}
                className={`filter-button ${
                  templateCategory === category ? "selected" : ""
                }`}
                onClick={() => setTemplateCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="template-grid">
            {filteredTemplates.map((template) => (
              <article className="template-card" key={template.title}>
                <div className="template-card-top">
                  <div className="template-icon">
                    <FileText size={20} />
                  </div>
                  <span className="template-category">
                    {template.category}
                  </span>
                </div>

                <h3>{template.title}</h3>
                <p>{template.description}</p>

                <div className="template-question">
                  <span>EXAMPLE QUESTION</span>
                  <strong>{template.question}</strong>
                  <small>{template.options.length} answer options</small>
                </div>

                <button
                  className="template-use-button"
                  onClick={() => chooseTemplate(template)}
                >
                  Use this template <ArrowRight size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {creationMode === "ai" && (
        <section className="poll-workspace-panel ai-generator-panel">
          <button className="back-button" onClick={goBack}>
            <ArrowLeft size={16} /> Back
          </button>

          <div className="ai-generator-heading">
            <div className="ai-heading-icon">
              <WandSparkles size={25} />
            </div>
            <h2>What would you like to ask?</h2>
            <p>
              Describe your poll idea. Gemini will prepare a draft that
              you can edit before publishing.
            </p>
          </div>

          <div className="ai-prompt-area">
            <label htmlFor="ai-prompt">YOUR POLL IDEA</label>

            <textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Example: Create a poll to decide which day is best for our team outing..."
              rows={5}
              disabled={isGenerating}
            />

            <div className="ai-prompt-footer">
              <span>Be as specific as you like.</span>

              <button
                type="button"
                className="primary-button"
                onClick={generateAIPoll}
                disabled={!aiPrompt.trim() || isGenerating}
              >
                <Sparkles size={16} />
                {isGenerating ? "Generating..." : "Generate poll"}
              </button>
            </div>
          </div>

          {aiError && (
            <p className="ai-demo-note" role="alert">
              {aiError}
            </p>
          )}

          {isGenerating && (
            <p className="ai-demo-note">
              <Sparkles size={14} />
              Gemini is generating your poll. This may take a few seconds...
            </p>
          )}

          {!isGenerating && !aiError && (
            <p className="ai-demo-note">
              <Sparkles size={14} />
              AI-generated polls can be edited before publishing.
            </p>
          )}
        </section>
      )}

      {creationMode === "editor" && (
        <form className="poll-editor-layout" onSubmit={publishPoll}>
          <div className="poll-editor-main">
            <section className="poll-workspace-panel">
              <div className="workspace-heading">
                <div>
                  <button
                    type="button"
                    className="back-button"
                    onClick={goBack}
                  >
                    <ArrowLeft size={16} /> Back to creation methods
                  </button>
                  <h2>Poll details</h2>
                  <p>Write your question and add the answer options.</p>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="poll-title">POLL QUESTION</label>
                <input
                  id="poll-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Which feature should we build next?"
                  maxLength={180}
                  required
                />
                <span className="field-hint">
                  {title.length}/180 characters
                </span>
              </div>

              <div className="form-field">
                <label htmlFor="poll-description">
                  DESCRIPTION <span>(OPTIONAL)</span>
                </label>
                <textarea
                  id="poll-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add some context to help people understand your poll..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="options-heading">
                <div>
                  <h3>Answer options</h3>
                  <p>
                    Add at least two options for participants to choose from.
                  </p>
                </div>
                <span>{options.length} options</span>
              </div>

              <div className="poll-options-list">
                {options.map((option, index) => (
                  <div className="poll-option-input" key={index}>
                    <div className="option-number">{index + 1}</div>
                    <input
                      value={option}
                      onChange={(event) =>
                        updateOption(index, event.target.value)
                      }
                      placeholder={`Option ${index + 1}`}
                      maxLength={100}
                    />
                    <button
                      type="button"
                      className="remove-option-button"
                      onClick={() => removeOption(index)}
                      disabled={options.length <= 2}
                      aria-label={`Remove option ${index + 1}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="add-option-button"
                onClick={addOption}
                disabled={options.length >= 6}
              >
                <Plus size={16} /> Add another option
              </button>
            </section>

            <section className="poll-workspace-panel settings-panel">
              <div className="workspace-heading">
                <div>
                  <h2>Voting settings</h2>
                  <p>Choose how participants can vote and view results.</p>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-description">
                  <strong>Multiple selections</strong>
                  <span>
                    Allow participants to select more than one option.
                  </span>
                </div>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(event) =>
                      setAllowMultiple(event.target.checked)
                    }
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              <div className="setting-row">
                <div className="setting-description">
                  <strong>Anonymous voting</strong>
                  <span>
                    Do not display voters' identities in poll results.
                  </span>
                </div>
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) =>
                      setAnonymous(event.target.checked)
                    }
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              <div className="form-field results-setting">
                <label htmlFor="results-visibility">RESULT VISIBILITY</label>
                <select
                  id="results-visibility"
                  value={showResults}
                  onChange={(event) => setShowResults(event.target.value)}
                >
                  <option value="after-voting">After voting</option>
                  <option value="always">Always visible</option>
                  <option value="after-end">Only after poll ends</option>
                </select>
              </div>
            </section>
          </div>

          <aside className="poll-editor-sidebar">
            <section className="poll-workspace-panel schedule-panel">
              <div className="workspace-heading">
                <div>
                  <h2>
                    <CalendarDays size={17} /> Schedule
                  </h2>
                  <p>Set when your poll is available.</p>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="poll-start">START DATE & TIME</label>
                <input
                  id="poll-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="poll-end">END DATE & TIME</label>
                <input
                  id="poll-end"
                  type="datetime-local"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="link-expiration">POLL LINK EXPIRATION</label>
                <select
                  id="link-expiration"
                  value={linkExpiration}
                  onChange={(event) =>
                    setLinkExpiration(event.target.value)
                  }
                >
                  <option value="never">Never</option>
                  <option value="1-day">After 1 day</option>
                  <option value="7-days">After 7 days</option>
                  <option value="30-days">After 30 days</option>
                </select>
              </div>

              <div className="schedule-note">
                <Clock3 size={16} />
                <span>You can update the schedule before publishing.</span>
              </div>
            </section>

            <section className="poll-workspace-panel poll-preview-panel">
              <div className="workspace-heading">
                <div>
                  <h2>
                    <Eye size={17} /> Preview
                  </h2>
                  <p>How your poll will appear.</p>
                </div>
              </div>

              <div className="poll-preview-card">
                <span className="preview-label">LIVE POLL PREVIEW</span>
                <h3>{title || "Your poll question will appear here"}</h3>
                {description && <p>{description}</p>}

                <div className="preview-options">
                  {options.filter(Boolean).map((option, index) => (
                    <div className="preview-option" key={index}>
                      <span className="preview-radio"></span>
                      {option}
                    </div>
                  ))}
                </div>

                <span className="preview-footer">
                  <EyeOff size={13} />
                  {anonymous
                    ? "Anonymous voting"
                    : "Voter identities enabled"}
                </span>
              </div>
            </section>
          </aside>

          <div className="poll-publish-bar">
            <div>
              <span className="publish-status-dot"></span>
              Draft · Not published
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={isPublishing}
            >
              {isPublishing ? "Publishing..." : "Publish Poll"}
              {!isPublishing && <ArrowRight size={16} />}
            </button>
          </div>

          {successMessage && (
            <div className="publish-message" role="status">
              {successMessage}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default CreatePoll;
