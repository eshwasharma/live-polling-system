
import { useEffect, useState } from "react";
import {
  User,
  Palette,
  Bell,
  Save,
  Sun,
  Moon,
  CheckCircle2,
} from "lucide-react";

function SettingsPage() {
  const [profile, setProfile] = useState({
    name: localStorage.getItem("pulsepoll-profile-name") || "",
    email: localStorage.getItem("pulsepoll-profile-email") || "",
  });

  const [theme, setTheme] = useState(
    localStorage.getItem("pulsepoll-theme") || "light"
  );

  const [notifications, setNotifications] = useState({
    pollUpdates:
      localStorage.getItem("pulsepoll-notify-updates") !== "false",
    newVotes:
      localStorage.getItem("pulsepoll-notify-votes") !== "false",
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const app = document.querySelector(".app-layout");

    if (app) {
      app.classList.toggle("theme-dark", theme === "dark");
    }

    localStorage.setItem("pulsepoll-theme", theme);
  }, [theme]);

  const handleSave = () => {
    localStorage.setItem("pulsepoll-profile-name", profile.name);
    localStorage.setItem("pulsepoll-profile-email", profile.email);
    localStorage.setItem(
      "pulsepoll-notify-updates",
      String(notifications.pollUpdates)
    );
    localStorage.setItem(
      "pulsepoll-notify-votes",
      String(notifications.newVotes)
    );

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="dashboard-content app-settings-page">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h1>Settings</h1>
          <p className="welcome-description">
            Manage your profile and customize your PulsePoll experience.
          </p>
        </div>
      </section>

      {saved && (
        <div className="settings-success">
          <CheckCircle2 size={17} />
          Settings saved successfully!
        </div>
      )}

      {/* Profile */}
      <section className="app-settings-card">
        <div className="app-settings-heading">
          <div className="app-settings-icon">
            <User size={20} />
          </div>
          <div>
            <h2>Profile</h2>
            <p>Manage your display information.</p>
          </div>
        </div>

        <div className="app-settings-fields">
          <label>
            Display Name
            <input
              type="text"
              placeholder="Enter your name"
              value={profile.name}
              onChange={(e) =>
                setProfile({ ...profile, name: e.target.value })
              }
            />
          </label>

          <label>
            Email Address
            <input
              type="email"
              placeholder="Enter your email"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </label>
        </div>

        <p className="settings-note">
          These details are currently saved in this browser only.
          Account login and profile synchronization can be added with authentication.
        </p>
      </section>

      {/* Appearance */}
      <section className="app-settings-card">
        <div className="app-settings-heading">
          <div className="app-settings-icon">
            <Palette size={20} />
          </div>
          <div>
            <h2>Appearance</h2>
            <p>Choose how PulsePoll looks on your device.</p>
          </div>
        </div>

        <div className="theme-options">
          <button
            type="button"
            className={`theme-option ${theme === "light" ? "selected" : ""}`}
            onClick={() => setTheme("light")}
          >
            <Sun size={21} />
            <span>Light Mode</span>
            <small>Clean and bright</small>
          </button>

          <button
            type="button"
            className={`theme-option ${theme === "dark" ? "selected" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <Moon size={21} />
            <span>Dark Mode</span>
            <small>Comfortable in low light</small>
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="app-settings-card">
        <div className="app-settings-heading">
          <div className="app-settings-icon">
            <Bell size={20} />
          </div>
          <div>
            <h2>Notifications</h2>
            <p>Choose which notification preferences you want.</p>
          </div>
        </div>

        <div className="notification-setting">
          <div>
            <strong>Poll updates</strong>
            <p>Receive updates about your polls.</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.pollUpdates}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                pollUpdates: e.target.checked,
              })
            }
          />
        </div>

        <div className="notification-setting">
          <div>
            <strong>New vote notifications</strong>
            <p>Enable notifications for new poll votes.</p>
          </div>
          <input
            type="checkbox"
            checked={notifications.newVotes}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                newVotes: e.target.checked,
              })
            }
          />
        </div>

        <p className="settings-note">
          These preferences are saved locally. Actual email or browser
          notifications are not connected yet.
        </p>
      </section>

      <div className="settings-save-area">
        <button
          type="button"
          className="settings-save-button"
          onClick={handleSave}
        >
          <Save size={17} />
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
