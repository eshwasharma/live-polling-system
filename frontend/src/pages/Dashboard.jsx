
import {
  Plus,
  ArrowUpRight,
  Users,
  BarChart3,
  Radio,
  Clock3,
  MoreHorizontal,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";

function Dashboard({ polls = [], onNavigate }) {
  // Calculate statistics using actual polls.
  const totalPolls = polls.length;

  const activePolls = polls.filter(
    (poll) => poll.status === "active"
  ).length;

  const completedPolls = polls.filter(
    (poll) => poll.status === "completed"
  ).length;

  const totalVotes = polls.reduce(
    (total, poll) => total + (Number(poll.votes) || 0),
    0
  );

  const stats = [
    {
      title: "Total Polls",
      value: totalPolls.toLocaleString("en-IN"),
      description: "polls created",
      icon: BarChart3,
    },
    {
      title: "Active Polls",
      value: activePolls.toLocaleString("en-IN"),
      description: "currently running",
      icon: Radio,
    },
    {
      title: "Total Votes",
      value: totalVotes.toLocaleString("en-IN"),
      description: "votes currently loaded",
      icon: Users,
    },
    {
      title: "Completed Polls",
      value: completedPolls.toLocaleString("en-IN"),
      description: "successfully completed",
      icon: CheckCircle2,
    },
  ];

  const recentPolls = [...polls]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
    .slice(0, 3);

  const formatDate = (dateString) => {
    if (!dateString) return "No end date";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="dashboard-content">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Welcome back!</h1>
          <p className="welcome-description">
            Here's what's happening with your polls today.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate("Create Poll")}
        >
          <Plus size={18} />
          Create Poll
        </button>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article className="stat-card" key={stat.title}>
              <div className="stat-card-top">
                <div className="stat-icon">
                  <Icon size={20} strokeWidth={1.8} />
                </div>

                <span className="icon-button">
                  <MoreHorizontal size={20} />
                </span>
              </div>

              <p className="stat-title">{stat.title}</p>

              <div className="stat-value-row">
                <h2>{stat.value}</h2>
              </div>

              <p className="stat-description">
                {stat.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="dashboard-main-grid">
        <div className="panel recent-polls-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Polls</h2>
              <p>Keep track of your latest polls.</p>
            </div>

            <button
              className="text-button"
              onClick={() => onNavigate("Active Polls")}
            >
              View all <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="poll-list">
            {recentPolls.length === 0 ? (
              <p className="welcome-description">
                No polls created yet. Create your first poll
                to get started!
              </p>
            ) : (
              recentPolls.map((poll, index) => (
                <article className="poll-row" key={poll.id}>
                  <div
                    className={`poll-type-icon ${
                      ["purple", "blue", "orange"][index % 3]
                    }`}
                  >
                    <BarChart3 size={20} />
                  </div>

                  <div className="poll-information">
                    <h3>{poll.title}</h3>
                    <p>{poll.description || "Poll"}</p>
                  </div>

                  <div className="poll-votes">
                    <strong>{poll.votes || 0}</strong>
                    <span>votes</span>
                  </div>

                  <div className="poll-status-column">
                    <span
                      className={`status-pill status-${poll.status}`}
                    >
                      {poll.status}
                    </span>

                    <span className="poll-date">
                      {poll.status === "completed"
                        ? "Completed"
                        : poll.endTime
                        ? `Ends ${formatDate(poll.endTime)}`
                        : "No end date"}
                    </span>
                  </div>

                  <button
                    className="icon-button poll-more-button"
                    aria-label={`View ${poll.title}`}
                    onClick={() => onNavigate("Active Polls")}
                  >
                    <ArrowUpRight size={20} />
                  </button>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="panel quick-actions-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Get started with PulsePoll.</p>
            </div>
          </div>

          <button
            className="quick-action-card"
            onClick={() => onNavigate("Create Poll")}
          >
            <div className="quick-action-icon purple">
              <Plus size={20} />
            </div>

            <div>
              <strong>Create a new poll</strong>
              <span>Ask a question and collect votes.</span>
            </div>

            <ArrowUpRight
              size={18}
              className="quick-action-arrow"
            />
          </button>

          <button
            className="quick-action-card"
            onClick={() => onNavigate("Active Polls")}
          >
            <div className="quick-action-icon blue">
              <Radio size={20} />
            </div>

            <div>
              <strong>Manage active polls</strong>
              <span>See what's happening right now.</span>
            </div>

            <ArrowUpRight
              size={18}
              className="quick-action-arrow"
            />
          </button>

          <div className="dashboard-tip">
            <div className="tip-icon">
              <Clock3 size={18} />
            </div>

            <div>
              <strong>Make every vote count</strong>
              <p>
                Share your poll link with participants to start
                collecting responses.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <footer className="dashboard-footer">
        <span>PulsePoll Dashboard</span>
        <span>
          <CalendarDays size={14} />
          Your polling activity at a glance
        </span>
      </footer>
    </div>
  );
}

export default Dashboard;
