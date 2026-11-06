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

const stats = [
  {
    title: "Total Polls",
    value: "24",
    change: "+12%",
    description: "from last month",
    icon: BarChart3,
  },
  {
    title: "Active Polls",
    value: "08",
    change: "+3",
    description: "currently running",
    icon: Radio,
  },
  {
    title: "Total Votes",
    value: "1,284",
    change: "+18%",
    description: "from last month",
    icon: Users,
  },
  {
    title: "Completed Polls",
    value: "16",
    change: "+8%",
    description: "successfully completed",
    icon: CheckCircle2,
  },
];

const recentPolls = [
  {
    title: "Which feature should we build next?",
    category: "Product Feedback",
    status: "Active",
    votes: 248,
    date: "Ends in 2 days",
    color: "purple",
  },
  {
    title: "Best day for the team outing?",
    category: "Team & Events",
    status: "Active",
    votes: 86,
    date: "Ends tomorrow",
    color: "blue",
  },
  {
    title: "Preferred workspace arrangement",
    category: "Workplace",
    status: "Completed",
    votes: 132,
    date: "Completed Oct 28",
    color: "orange",
  },
];

function Dashboard() {
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

        <button className="primary-button">
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
                <button
                  className="icon-button"
                  aria-label={`More options for ${stat.title}`}
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <p className="stat-title">{stat.title}</p>

              <div className="stat-value-row">
                <h2>{stat.value}</h2>
                <span className="stat-change">{stat.change}</span>
              </div>

              <p className="stat-description">{stat.description}</p>
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

            <button className="text-button">
              View all <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="poll-list">
            {recentPolls.map((poll) => (
              <article className="poll-row" key={poll.title}>
                <div className={`poll-type-icon ${poll.color}`}>
                  <BarChart3 size={20} />
                </div>

                <div className="poll-information">
                  <h3>{poll.title}</h3>
                  <p>{poll.category}</p>
                </div>

                <div className="poll-votes">
                  <strong>{poll.votes}</strong>
                  <span>votes</span>
                </div>

                <div className="poll-status-column">
                  <span
                    className={`status-pill ${
                      poll.status === "Active" ? "status-active" : "status-completed"
                    }`}
                  >
                    {poll.status}
                  </span>
                  <span className="poll-date">{poll.date}</span>
                </div>

                <button
                  className="icon-button poll-more-button"
                  aria-label="Poll options"
                >
                  <MoreHorizontal size={20} />
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="panel quick-actions-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick Actions</h2>
              <p>Get started with PulsePoll.</p>
            </div>
          </div>

          <button className="quick-action-card">
            <div className="quick-action-icon purple">
              <Plus size={20} />
            </div>
            <div>
              <strong>Create a new poll</strong>
              <span>Ask a question and collect votes.</span>
            </div>
            <ArrowUpRight size={18} className="quick-action-arrow" />
          </button>

          <button className="quick-action-card">
            <div className="quick-action-icon blue">
              <Radio size={20} />
            </div>
            <div>
              <strong>Manage active polls</strong>
              <span>See what's happening right now.</span>
            </div>
            <ArrowUpRight size={18} className="quick-action-arrow" />
          </button>

          <div className="dashboard-tip">
            <div className="tip-icon">
              <Clock3 size={18} />
            </div>
            <div>
              <strong>Make every vote count</strong>
              <p>
                Share your poll link with participants to start collecting
                responses.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <footer className="dashboard-footer">
        <span>PulsePoll Dashboard</span>
        <span>
          <CalendarDays size={14} /> Your polling activity at a glance
        </span>
      </footer>
    </div>
  );
}

export default Dashboard;