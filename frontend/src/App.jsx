
import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import ActivePolls from "./pages/ActivePolls";
import MyPolls from "./pages/MyPolls";
import ResultsPage from "./pages/ResultsPage";
import PublicVotingPage from "./pages/PublicVotingPage";

import "./App.css";

// Public poll route connected to MongoDB.
function PublicPollRoute() {
  return <PublicVotingPage />;
}

// Existing dashboard application.
function DashboardApp() {
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState("Dashboard");
  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [votedPollIds, setVotedPollIds] = useState([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [apiError, setApiError] = useState("");

  function formatPoll(poll) {
    return {
      ...poll,
      options: (poll.options || []).map((option) =>
        typeof option === "string" ? option : option.text
      ),
      votes: poll.votes || 0,
      optionVotes: poll.options?.map(() => 0) || [],
      showResults: poll.settings?.showResults || "after-voting",
      allowMultiple: poll.settings?.allowMultipleAnswers || false,
      anonymous: poll.settings?.anonymousVoting ?? true,
    };
  }

  // Fetch the latest poll data from MongoDB.
  const fetchPolls = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingPolls(true);
      setApiError("");
    }

    try {
      const response = await fetch("/api/polls/");

      if (!response.ok) {
        throw new Error("Unable to fetch polls.");
      }

      const data = await response.json();

      if (data.success) {
        setPolls((data.polls || []).map(formatPoll));
      } else {
        throw new Error(data.message || "Failed to load polls.");
      }
    } catch (error) {
      console.error("Fetch polls error:", error);

      if (!silent) {
        setApiError(error.message);
      }
    } finally {
      if (!silent) {
        setLoadingPolls(false);
      }
    }
  }, []);

  // Fetch immediately and refresh automatically every 10 seconds.
  useEffect(() => {
    fetchPolls();

    const refreshInterval = setInterval(() => {
      fetchPolls(true);
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [fetchPolls]);

  function handleNavigation(page) {
    setActivePage(page);
    setSelectedPoll(null);

    if (
      page === "Dashboard" ||
      page === "Active Polls" ||
      page === "Past Polls" ||
      page === "My Polls"
    ) {
      fetchPolls();
    }
  }

  async function handlePublishPoll(newPoll) {
    setApiError("");

    const pollData = {
      title: newPoll.title,
      description: newPoll.description,
      question: newPoll.title,

      options: newPoll.options.map((option) => ({
        text: option,
      })),

      settings: {
        allowMultipleAnswers: newPoll.allowMultiple,
        anonymousVoting: newPoll.anonymous,
        showResults: newPoll.showResults,
      },

      startTime: newPoll.startTime
        ? new Date(newPoll.startTime).toISOString()
        : null,

      endTime: newPoll.endTime
        ? new Date(newPoll.endTime).toISOString()
        : null,
    };

    try {
      const response = await fetch("/api/polls/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pollData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to publish poll.");
      }

      await fetchPolls(true);

      setActivePage("Active Polls");
    } catch (error) {
      console.error("Publish poll error:", error);
      setApiError(error.message);
      throw error;
    }
  }

  // Open the backend-connected public voting page.
  function handleViewPoll(poll) {
    navigate(`/poll/${poll.id}`);
  }

  // Fetch results for the poll selected from My Polls.
  async function handleViewResults(poll) {
    if (!poll) return;

    setApiError("");
    setSelectedPoll(poll);

    try {
      const response = await fetch(
        `/api/polls/${poll.id}/results`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load poll results.");
      }

      setPolls((currentPolls) =>
        currentPolls.map((currentPoll) =>
          currentPoll.id === poll.id
            ? {
                ...currentPoll,
                votes: data.totalVotes,
                optionVotes: data.options.map(
                  (option) => option.votes
                ),
              }
            : currentPoll
        )
      );

      setActivePage("Results");
    } catch (error) {
      console.error("Fetch results error:", error);
      setApiError(error.message);
    }
  }

  const currentPoll = polls.find(
    (poll) => poll.id === selectedPoll?.id
  );

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigation}
      />

      <main className="main-content">
        <Header />

        {apiError && (
          <div className="dashboard-content">
            <p role="alert" className="publish-message">
              {apiError}
            </p>
          </div>
        )}

        {activePage === "Dashboard" && (
          <Dashboard
            polls={polls}
            onNavigate={handleNavigation}
          />
        )}

        {activePage === "Create Poll" && (
          <CreatePoll onPublish={handlePublishPoll} />
        )}

        {activePage === "Active Polls" && (
          <ActivePolls
            polls={polls.filter(
              (poll) =>
                poll.status === "active" ||
                poll.status === "scheduled"
            )}
            onViewPoll={handleViewPoll}
            loading={loadingPolls}
            onRefresh={fetchPolls}
            pageTitle="Active Polls"
          />
        )}

        {activePage === "Past Polls" && (
          <ActivePolls
            polls={polls.filter(
              (poll) => poll.status === "completed"
            )}
            onViewPoll={handleViewPoll}
            loading={loadingPolls}
            onRefresh={fetchPolls}
            pageTitle="Past Polls"
          />
        )}

        {activePage === "My Polls" && (
          <MyPolls
            polls={polls}
            onViewPoll={handleViewPoll}
            onViewResults={handleViewResults}
          />
        )}

        {activePage === "Results" && currentPoll && (
          <ResultsPage
            poll={currentPoll}
            onBack={() => setActivePage("My Polls")}
            canViewResults={true}
          />
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Create Poll" &&
          activePage !== "Active Polls" &&
          activePage !== "Past Polls" &&
          activePage !== "My Polls" &&
          activePage !== "Results" && (
            <div className="dashboard-content">
              <h1>{activePage}</h1>
              <p className="welcome-description">
                This section will be implemented in the next stages.
              </p>
            </div>
          )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardApp />} />
      <Route path="/poll/:id" element={<PublicPollRoute />} />
    </Routes>
  );
}

export default App;
