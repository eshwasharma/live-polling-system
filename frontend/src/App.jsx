import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import ActivePolls from "./pages/ActivePolls";
import VotingPage from "./pages/VotingPage";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [votedPollIds, setVotedPollIds] = useState([]);

  function handleNavigation(page) {
    setActivePage(page);
    setSelectedPoll(null);
  }

  function handlePublishPoll(newPoll) {
    const pollWithResults = {
      ...newPoll,
      votes: 0,
      optionVotes: newPoll.options.map(() => 0),
    };

    setPolls((currentPolls) => [pollWithResults, ...currentPolls]);
    setActivePage("Active Polls");
  }

  function handleViewPoll(poll) {
    setSelectedPoll(poll);
    setActivePage("Vote");
  }

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

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage === "Vote" ? "Active Polls" : activePage}
        onNavigate={handleNavigation}
      />

      <main className="main-content">
        <Header />

        {activePage === "Dashboard" && <Dashboard />}

        {activePage === "Create Poll" && (
          <CreatePoll onPublish={handlePublishPoll} />
        )}

        {activePage === "Active Polls" && (
          <ActivePolls
            polls={polls}
            onViewPoll={handleViewPoll}
          />
        )}

        {activePage === "Vote" && currentPoll && (
          <VotingPage
            poll={currentPoll}
            onBack={() => setActivePage("Active Polls")}
            onSubmitVote={handleSubmitVote}
            hasVoted={votedPollIds.includes(currentPoll.id)}
          />
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Create Poll" &&
          activePage !== "Active Polls" &&
          activePage !== "Vote" && (
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

export default App;