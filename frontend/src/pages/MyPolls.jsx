
import { useMemo, useState } from "react";
import {
  ListChecks,
  Search,
  Users,
  CalendarDays,
  BarChart3,
  Share2,
  ArrowUpRight,
  FileText,
  Filter,
  Settings,
} from "lucide-react";

import SharePollModal from "../components/SharePollModal";

function MyPolls({
  polls = [],
  onViewPoll,
  onViewResults,
  onOpenSettings,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPoll, setSelectedPoll] = useState(null);

  const filteredPolls = useMemo(() => {
    return polls.filter((poll) => {
      const matchesSearch =
        poll.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        poll.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || poll.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [polls, searchTerm, statusFilter]);

  const statusCounts = {
    all: polls.length,
    active: polls.filter((poll) => poll.status === "active").length,
    paused: polls.filter((poll) => poll.status === "paused").length,
    scheduled: polls.filter((poll) => poll.status === "scheduled").length,
    completed: polls.filter((poll) => poll.status === "completed").length,
  };

  return (
    <div className="dashboard-content">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">POLL MANAGEMENT</p>
          <h1>My Polls</h1>
          <p className="welcome-description">
            View and manage your polls in one place.
          </p>
        </div>

        <div className="active-poll-count">
          <ListChecks size={17} />
          {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
        </div>
      </section>

      <section className="my-polls-toolbar">
        <div className="my-polls-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search polls by title or description..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="my-polls-filter">
          <Filter size={17} />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter polls by status"
          >
            <option value="all">All Polls</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </section>

      <div className="my-polls-filter-tabs">
        {[
          { value: "all", label: "All Polls" },
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
          { value: "scheduled", label: "Scheduled" },
          { value: "completed", label: "Completed" },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={
              statusFilter === filter.value
                ? "my-polls-tab active"
                : "my-polls-tab"
            }
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
            <span>{statusCounts[filter.value]}</span>
          </button>
        ))}
      </div>

      {filteredPolls.length === 0 ? (
        <div className="empty-polls-panel">
          <div className="empty-polls-icon">
            <FileText size={28} />
          </div>

          <h2>
            {polls.length === 0
              ? "No polls created yet"
              : "No matching polls found"}
          </h2>

          <p>
            {polls.length === 0
              ? "Your published polls will appear here."
              : "Try changing your search or status filter."}
          </p>
        </div>
      ) : (
        <div className="active-polls-grid">
          {filteredPolls.map((poll) => {
            const createdDate = poll.createdAt
              ? new Date(poll.createdAt)
              : null;

            return (
              <article className="active-poll-card" key={poll.id}>
                <div className="active-poll-card-top">
                  <div className="active-poll-icon">
                    <BarChart3 size={21} />
                  </div>

                  <span className={`status-pill status-${poll.status}`}>
                    {poll.status}
                  </span>
                </div>

                <h2>{poll.title}</h2>

                <p className="active-poll-description">
                  {poll.description || "No description provided."}
                </p>

                <div className="active-poll-options">
                  <span>ANSWER OPTIONS</span>

                  {(poll.options || []).map((option, index) => (
                    <div className="active-poll-option" key={index}>
                      <span className="option-number">{index + 1}</span>

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
                      {createdDate && !Number.isNaN(createdDate.getTime())
                        ? createdDate.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date unavailable"}
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
                      {poll.endTime
                        ? `Ends: ${new Date(
                            poll.endTime
                          ).toLocaleString("en-IN")}`
                        : "No end date set"}
                    </span>
                  </div>

                  <div className="active-poll-actions">
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onOpenSettings?.(poll)}
                      title="Poll Settings"
                    >
                      <Settings size={15} />
                      Settings
                    </button>

                    <button
                      className="text-button share-poll-button"
                      type="button"
                      onClick={() => setSelectedPoll(poll)}
                    >
                      <Share2 size={15} />
                      Share
                    </button>

                    {onViewResults && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onViewResults(poll)}
                      >
                        <BarChart3 size={15} />
                        Results
                      </button>
                    )}

                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onViewPoll?.(poll)}
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

export default MyPolls;
