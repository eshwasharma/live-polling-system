import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import ActivePolls from "./pages/ActivePolls";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [polls, setPolls] = useState([]);

  function handleNavigation(page) {
    setActivePage(page);
  }

  function handlePublishPoll(newPoll) {
    setPolls((currentPolls) => [newPoll, ...currentPolls]);
    setActivePage("Active Polls");
  }

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigation}
      />

      <main className="main-content">
        <Header />

        {activePage === "Dashboard" && <Dashboard />}

        {activePage === "Create Poll" && (
          <CreatePoll onPublish={handlePublishPoll} />
        )}

        {activePage === "Active Polls" && (
          <ActivePolls polls={polls} />
        )}

        {activePage !== "Dashboard" &&
          activePage !== "Create Poll" &&
          activePage !== "Active Polls" && (
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