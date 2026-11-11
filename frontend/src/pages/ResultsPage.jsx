
import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "../utils/api";
import {
  ArrowLeft,
  BarChart3,
  Users,
  Trophy,
  CheckCircle2,
  Lock,
  Download,
  RefreshCw,
  PieChart,
} from "lucide-react";

// Render backend URL configured through Vercel environment variables.
// Local development continues using the Vite proxy.
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

function getWebSocketURL(path) {
  if (API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${path}`;
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

const CHART_COLORS = [
  "#7657e8",
  "#3695e8",
  "#f59e42",
  "#20b88a",
  "#e66b9a",
  "#8b7cf6",
];

function ResultsPage({ poll, onBack, canViewResults }) {
  const [chartType, setChartType] = useState("bar");
  const [results, setResults] = useState({
    totalVotes: poll?.votes || 0,
    optionVotes: poll?.optionVotes || [],
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState("");

  const pollId = poll?.id;

  const optionNames = useMemo(
    () =>
      (poll?.options || []).map((option) =>
        typeof option === "string" ? option : option.text
      ),
    [poll]
  );

  // Fetch latest results directly from the Render backend.
  const fetchResults = useCallback(async (showLoading = false) => {
    if (!pollId) return;

    if (showLoading) setIsRefreshing(true);

    try {
      const response = await apiFetch(
  `/api/polls/${pollId}/results`
);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to refresh results.");
      }

      setResults({
        totalVotes: data.totalVotes || 0,
        optionVotes: (data.options || []).map(
          (option) => option.votes || 0
        ),
      });

      setLiveError("");
    } catch (error) {
      console.error("Results refresh error:", error);
      setLiveError(error.message || "Unable to refresh results.");
    } finally {
      if (showLoading) setIsRefreshing(false);
    }
  }, [pollId]);

  // Fetch identified participants using the authenticated owner endpoint.
  const fetchParticipants = useCallback(async (showLoading = false) => {
    if (!pollId || poll?.settings?.anonymousVoting !== false) {
      setParticipants([]);
      setParticipantsError("");
      return;
    }

    if (showLoading) setParticipantsLoading(true);

    try {
     const response = await apiFetch(
  `/api/polls/${pollId}/participants`
);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load participants.");
      }

      setParticipants(data.participants || []);
      setParticipantsError("");
    } catch (error) {
      console.error("Participants fetch error:", error);
      setParticipantsError(
        error.message || "Unable to load participants."
      );
    } finally {
      if (showLoading) setParticipantsLoading(false);
    }
  }, [pollId, poll?.settings?.anonymousVoting]);

  // Load results when the page opens.
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Load participant details when the page opens.
  useEffect(() => {
    fetchParticipants(true);
  }, [fetchParticipants]);

  // Listen for live vote notifications through WebSocket.
  useEffect(() => {
    if (!pollId) return;

    let socket;
    let reconnectTimer;
    let isCancelled = false;

    const connectWebSocket = () => {
      if (isCancelled) return;

      socket = new WebSocket(
        getWebSocketURL(`/api/polls/${pollId}/ws`)
      );

      socket.onmessage = () => {
        fetchResults();
        fetchParticipants();
      };

      socket.onclose = () => {
        if (!isCancelled) {
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
      };

      socket.onerror = () => {
        if (socket) socket.close();
      };
    };

    connectWebSocket();

    return () => {
      isCancelled = true;
      clearTimeout(reconnectTimer);

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [pollId, fetchResults, fetchParticipants]);

  if (!poll) return null;

  const totalVotes = results.totalVotes || 0;

  const optionVotes = optionNames.map(
    (_, index) => results.optionVotes[index] || 0
  );

  const highestVotes = Math.max(0, ...optionVotes);

  const winnerIndexes =
    totalVotes > 0
      ? optionVotes
          .map((votes, index) =>
            votes === highestVotes ? index : -1
          )
          .filter((index) => index !== -1)
      : [];

  const chartData = optionNames.map((name, index) => {
    const votes = optionVotes[index] || 0;

    return {
      name,
      votes,
      percentage:
        totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });

  const gradient = chartData.reduce(
    (value, item) => {
      const start = value.position;
      const end = start + item.percentage;

      value.stops.push(`${item.color} ${start}% ${end}%`);
      value.position = end;

      return value;
    },
    { position: 0, stops: [] }
  ).stops.join(", ");

  // Export results as CSV.
  const handleExportCSV = () => {
    const rows = [
      ["Poll Title", poll.title],
      ["Total Votes", totalVotes],
      [],
      ["Option", "Votes", "Percentage"],
      ...chartData.map((item) => [
        item.name,
        item.votes,
        `${item.percentage.toFixed(1)}%`,
      ]),
    ];

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${poll.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_results.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> Back to My Polls
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
          LIVE RESULTS
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
          <strong>{optionNames.length}</strong>
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

          <div className="results-heading-actions">
            <span>{totalVotes} total votes</span>

            <button
              className="results-export-button"
              type="button"
              onClick={handleExportCSV}
              disabled={totalVotes === 0}
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
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
          <>
            <div className="results-chart-toolbar">
              <div className="results-chart-tabs">
                <button
                  type="button"
                  className={chartType === "bar" ? "active" : ""}
                  onClick={() => setChartType("bar")}
                >
                  <BarChart3 size={16} />
                  Bar
                </button>

                <button
                  type="button"
                  className={chartType === "pie" ? "active" : ""}
                  onClick={() => setChartType("pie")}
                >
                  <PieChart size={16} />
                  Pie
                </button>

                <button
                  type="button"
                  className={chartType === "donut" ? "active" : ""}
                  onClick={() => setChartType("donut")}
                >
                  <PieChart size={16} />
                  Donut
                </button>
              </div>

              <button
                type="button"
                className="results-refresh-button"
                onClick={() => fetchResults(true)}
                disabled={isRefreshing}
              >
                <RefreshCw
                  size={15}
                  className={isRefreshing ? "refresh-spinning" : ""}
                />
                Refresh
              </button>
            </div>

            {chartType === "bar" && (
              <div className="results-option-list">
                {chartData.map((item, index) => {
                  const isLeading =
                    item.votes === highestVotes && totalVotes > 0;

                  return (
                    <div className="result-option" key={index}>
                      <div className="result-option-heading">
                        <div className="result-option-name">
                          <span className="result-option-number">
                            {index + 1}
                          </span>
                          <strong>{item.name}</strong>

                          {isLeading && (
                            <span className="leading-badge">
                              <Trophy size={11} /> Leading
                            </span>
                          )}
                        </div>

                        <div className="result-option-count">
                          <strong>{item.votes}</strong>
                          <span>{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="result-progress-track">
                        <div
                          className="result-progress-fill"
                          style={{
                            width: `${item.percentage}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(chartType === "pie" || chartType === "donut") && (
              <div className="results-circular-chart">
                <div
                  className={`results-pie-visual ${
                    chartType === "donut" ? "donut" : ""
                  }`}
                  style={{
                    background: `conic-gradient(${gradient})`,
                  }}
                >
                  {chartType === "donut" && (
                    <div className="results-donut-center">
                      <strong>{totalVotes}</strong>
                      <span>Total votes</span>
                    </div>
                  )}
                </div>

                <div className="results-chart-legend">
                  {chartData.map((item, index) => (
                    <div className="results-legend-item" key={index}>
                      <span
                        className="results-legend-dot"
                        style={{ background: item.color }}
                      />

                      <div className="results-legend-name">
                        <strong>{item.name}</strong>
                        <span>{item.votes} votes</span>
                      </div>

                      <strong className="results-legend-percentage">
                        {item.percentage.toFixed(1)}%
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="results-summary">
              <CheckCircle2 size={18} />
              <span>
                {winnerIndexes.length === 1
                  ? `${optionNames[winnerIndexes[0]]} is currently leading.`
                  : "There is currently a tie between the leading options."}
              </span>
            </div>
          </>
        )}
      </section>

      {poll.settings?.anonymousVoting === false && (
        <section
          className="results-panel participants-panel"
          style={{ marginTop: "24px" }}
        >
          <div className="results-panel-heading">
            <div>
              <h2>Voter details</h2>
              <p>Participants who submitted an identified vote.</p>
            </div>

            <div className="results-heading-actions">
              <span>{participants.length} participants</span>

              <button
                type="button"
                className="results-refresh-button"
                onClick={() => fetchParticipants(true)}
                disabled={participantsLoading}
              >
                <RefreshCw
                  size={15}
                  className={participantsLoading ? "refresh-spinning" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          {participantsError && (
            <p className="results-live-error" role="alert">
              {participantsError}
            </p>
          )}

          {participantsLoading && participants.length === 0 ? (
            <div className="results-empty">
              <Users size={28} />
              <p>Loading voter details...</p>
            </div>
          ) : participants.length === 0 ? (
            <div className="results-empty">
              <Users size={28} />
              <h3>No identified votes yet</h3>
              <p>Participant details will appear here after someone votes.</p>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "680px",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Participant",
                      "Email",
                      "Selected option(s)",
                      "Voted at",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "13px 14px",
                          background: "#f7f6fc",
                          color: "#625d75",
                          fontSize: "12px",
                          fontWeight: 700,
                          borderBottom: "1px solid #e9e6f2",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {participants.map((participant, index) => (
                    <tr
                      key={`${participant.email}-${participant.votedAt}-${index}`}
                    >
                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid #eeeaf5",
                          fontWeight: 600,
                        }}
                      >
                        {participant.name || "—"}
                      </td>

                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid #eeeaf5",
                        }}
                      >
                        {participant.email || "—"}
                      </td>

                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid #eeeaf5",
                        }}
                      >
                        {(participant.selectedOptions || []).join(", ") || "—"}
                      </td>

                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid #eeeaf5",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {participant.votedAt
                          ? new Date(participant.votedAt).toLocaleString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {liveError && (
        <p className="results-live-error" role="alert">
          Live refresh issue: {liveError}
        </p>
      )}

      <p className="results-footer">
        <CheckCircle2 size={14} />
        Results are based on the votes currently recorded in this application.
      </p>
    </div>
  );
}

export default ResultsPage;
