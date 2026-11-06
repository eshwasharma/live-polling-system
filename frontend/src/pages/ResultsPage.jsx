import {
  ArrowLeft,
  BarChart3,
  Users,
  Trophy,
  CheckCircle2,
  Lock,
} from "lucide-react";

function ResultsPage({ poll, onBack, canViewResults }) {
  if (!poll) return null;

  const totalVotes = poll.votes || 0;
  const optionVotes = poll.optionVotes || poll.options.map(() => 0);

  const highestVotes = Math.max(0, ...optionVotes);

  const winnerIndexes =
    totalVotes > 0
      ? optionVotes
          .map((votes, index) => (votes === highestVotes ? index : -1))
          .filter((index) => index !== -1)
      : [];

  return (
    <div className="results-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to Active Polls
      </button>

      <div className="results-heading">
        <div>
          <p className="eyebrow">POLL ANALYTICS</p>
          <h1>Poll Results</h1>
          <p className="welcome-description">
            See how participants voted and which option received the most votes.
          </p>
        </div>

        <div className="results-live-label">
          <span></span>
          CURRENT RESULTS
        </div>
      </div>

      <section className="results-poll-title">
        <div className="results-title-icon">
          <BarChart3 size={22} />
        </div>
        <div>
          <h2>{poll.title}</h2>
          <p>{poll.description || "No description provided."}</p>
        </div>
      </section>

      <section className="results-stats-grid">
        <article className="results-stat-card">
          <div className="results-stat-icon purple">
            <Users size={20} />
          </div>
          <span>Total votes</span>
          <strong>{totalVotes}</strong>
        </article>

        <article className="results-stat-card">
          <div className="results-stat-icon blue">
            <BarChart3 size={20} />
          </div>
          <span>Answer options</span>
          <strong>{poll.options.length}</strong>
        </article>

        <article className="results-stat-card">
          <div className="results-stat-icon orange">
            <Trophy size={20} />
          </div>
          <span>Leading options</span>
          <strong>{totalVotes > 0 ? winnerIndexes.length : "—"}</strong>
        </article>
      </section>

      <section className="results-panel">
        <div className="results-panel-heading">
          <div>
            <h2>Vote distribution</h2>
            <p>Breakdown of votes received by each option.</p>
          </div>
          <span>{totalVotes} total votes</span>
        </div>

        {!canViewResults ? (
          <div className="results-locked">
            <div className="results-locked-icon">
              <Lock size={23} />
            </div>
            <h3>Results are not available yet</h3>
            <p>
              The poll creator has restricted result visibility. You can view
              the results once the poll ends.
            </p>
          </div>
        ) : totalVotes === 0 ? (
          <div className="results-empty">
            <BarChart3 size={30} />
            <h3>No votes yet</h3>
            <p>Results will appear here once participants start voting.</p>
          </div>
        ) : (
          <div className="results-option-list">
            {poll.options.map((option, index) => {
              const votes = optionVotes[index] || 0;
              const percentage = (votes / totalVotes) * 100;
              const isLeading = votes === highestVotes;

              return (
                <div className="result-option" key={index}>
                  <div className="result-option-heading">
                    <div className="result-option-name">
                      <span className="result-option-number">
                        {index + 1}
                      </span>
                      <strong>{option}</strong>
                      {isLeading && (
                        <span className="leading-badge">
                          <Trophy size={11} /> Leading
                        </span>
                      )}
                    </div>

                    <div className="result-option-count">
                      <strong>{votes}</strong>
                      <span>{percentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="result-progress-track">
                    <div
                      className="result-progress-fill"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canViewResults && totalVotes > 0 && (
          <div className="results-summary">
            <CheckCircle2 size={18} />
            <span>
              {winnerIndexes.length === 1
                ? `${poll.options[winnerIndexes[0]]} is currently leading.`
                : "There is currently a tie between the leading options."}
            </span>
          </div>
        )}
      </section>

      <p className="results-footer">
        <CheckCircle2 size={14} />
        Results are based on the votes currently recorded in this application.
      </p>
    </div>
  );
}

export default ResultsPage;