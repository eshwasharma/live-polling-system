
import { useState, useEffect } from "react";
import { Routes, Route, useParams } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import ActivePolls from "./pages/ActivePolls";
import VotingPage from "./pages/VotingPage";
import ResultsPage from "./pages/ResultsPage";
import PublicVotingPage from "./pages/PublicVotingPage";

import "./App.css";

// Temporary public poll route.
// We will connect this page to MongoDB in the next step.
function PublicPollRoute() {
  return <PublicVotingPage />;
}

// Your existing dashboard application.
function DashboardApp() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [votedPollIds, setVotedPollIds] = useState([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [apiError, setApiError] = useState("");

  function formatPoll(poll) {
    return {
      ...poll,
      options: (poll.options || []).map((option) => option.text),
      votes: poll.votes || 0,
      optionVotes: poll.options?.map(() => 0) || [],
      showResults: poll.settings?.showResults || "after-voting",
      allowMultiple: poll.settings?.allowMultipleAnswers || false,
      anonymous: poll.settings?.anonymousVoting ?? true,
    };
  }

  async function fetchPolls() {
    setLoadingPolls(true);
    setApiError("");

    try {
      const response = await fetch("/api/polls/");

      if (!response.ok) {
        throw new Error("Unable to fetch polls.");
      }

      const data = await response.json();

      if (data.success) {
        setPolls(data.polls.map(formatPoll));
      } else {
        throw new Error(data.message || "Failed to load polls.");
      }
    } catch (error) {
      console.error("Fetch polls error:", error);
      setApiError(error.message);
    } finally {
      setLoadingPolls(false);
    }
  }

  useEffect(() => {
    fetchPolls();
  }, []);

  function handleNavigation(page) {
    setActivePage(page);
    setSelectedPoll(null);

    if (page === "Active Polls") {
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

      const savedPoll = formatPoll(data.poll);

      setPolls((currentPolls) => [
        savedPoll,
        ...currentPolls.filter((poll) => poll.id !== savedPoll.id),
      ]);

      setActivePage("Active Polls");
    } catch (error) {
      console.error("Publish poll error:", error);
      setApiError(error.message);
      throw error;
    }
  }

  function handleViewPoll(poll) {
    setSelectedPoll(poll);
    setActivePage("Vote");
  }

  // Temporary frontend-only voting logic.
  function handleSubmitVote(pollId, selectedOptions) {
    setPolls((currentPolls) =>
      currentPolls.map((poll) => {
        if (poll.id !== pollId) return poll;

        const updatedOptionVotes = poll.options.map((option, index) =>
          selectedOptions.includes(option)
            ? poll.optionVotes[index] + 1
            : poll.optionVotes[index]
        );

        return {
          ...poll,
          votes: poll.votes + 1,
          optionVotes: updatedOptionVotes,
        };
      })
    );

    setVotedPollIds((currentIds) => [...currentIds, pollId]);
  }

  const currentPoll = polls.find(
    (poll) => poll.id === selectedPoll?.id
  );

  function canViewResults(poll) {
    if (!poll) return false;

    if (poll.showResults === "always") {
      return true;
    }

    if (poll.showResults === "after-voting") {
      return votedPollIds.includes(poll.id);
    }

    return false;
  }

  
async function handleViewResults() {
  if (!currentPoll) return;

  setApiError("");

  try {
    const response = await fetch(
      `/api/polls/${currentPoll.id}/results`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to load poll results.");
    }

    // Update the poll with actual MongoDB vote counts.
    setPolls((currentPolls) =>
      currentPolls.map((poll) =>
        poll.id === currentPoll.id
          ? {
              ...poll,
              votes: data.totalVotes,
              optionVotes: data.options.map((option) => option.votes),
            }
          : poll
      )
    );

    setActivePage("Results");
  } catch (error) {
    console.error("Fetch results error:", error);
    setApiError(error.message);
  }
}


  return (
    <div className="app-layout">
      <Sidebar
        activePage={
          activePage === "Vote" || activePage === "Results"
            ? "Active Polls"
            : activePage
        }
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

        {activePage === "Dashboard" && <Dashboard />}

        {activePage === "Create Poll" && (
          <CreatePoll onPublish={handlePublishPoll} />
        )}

        {activePage === "Active Polls" && (
          <ActivePolls
            polls={polls}
            onViewPoll={handleViewPoll}
            loading={loadingPolls}
          />
        )}

        {activePage === "Vote" && currentPoll && (
          <VotingPage
            poll={currentPoll}
            onBack={() => setActivePage("Active Polls")}
            onSubmitVote={handleSubmitVote}
            hasVoted={votedPollIds.includes(currentPoll.id)}
            onViewResults={handleViewResults}
            canViewResults={canViewResults(currentPoll)}
          />
        )}

        {activePage === "Results" && currentPoll && (
          <ResultsPage
            poll={currentPoll}
            onBack={() => setActivePage("Active Polls")}
            canViewResults={canViewResults(currentPoll)}
          />
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Create Poll" &&
          activePage !== "Active Polls" &&
          activePage !== "Vote" &&
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
