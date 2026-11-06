import {
  Radio,
  Users,
  CalendarDays,
  ArrowUpRight,
  BarChart3,
  Clock3,
  FileText,
} from "lucide-react";

function ActivePolls({ polls, onViewPoll }) {
  return (
    <div className="dashboard-content">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">POLL MANAGEMENT</p>
          <h1>Active Polls</h1>
          <p className="welcome-description">
            Manage your polls and keep track of responses.
          </p>
        </div>

        <div className="active-poll-count">
          <Radio size={17} />
          {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
        </div>
      </section>

      {polls.length === 0 ? (
        <div className="empty-polls-panel">
          <div className="empty-polls-icon">
            <FileText size={28} />
          </div>

          <h2>No active polls yet</h2>

          <p>
            You haven't published any polls. Create your first poll to
            start collecting responses.
          </p>
        </div>
      ) : (
        <div className="active-polls-grid">
          {polls.map((poll) => {
            const createdDate = new Date(poll.createdAt);

            return (
              <article className="active-poll-card" key={poll.id}>
                <div className="active-poll-card-top">
                  <div className="active-poll-icon">
                    <BarChart3 size={21} />
                  </div>

                  <span className="status-pill status-active">
                    {poll.status}
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
                      <span className="option-number">{index + 1}</span>
                      <span>{option}</span>
                    </div>
                  ))}
                </div>

                <div className="active-poll-card-footer">
                  <div>
                    <Users size={15} />
                    <span>{poll.votes} votes</span>
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
                  <span>
                    <Clock3 size={14} />
                    {poll.endTime
                      ? `Ends ${new Date(poll.endTime).toLocaleString()}`
                      : "No end date set"}
                  </span>

                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onViewPoll(poll)}
                  >
                    View Poll <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivePolls;