
import { Search, Bell, ChevronDown } from "lucide-react";

function Header() {
  return (
    <header className="top-header">
      <div className="header-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search polls..."
        />
        <span className="search-shortcut">⌘ K</span>
      </div>

      <div className="header-actions">
        <button className="notification-button" aria-label="Notifications">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        <div className="header-divider"></div>

        <button className="profile-button">
          <div className="profile-avatar">ES</div>
          <div className="profile-details">
            <span className="profile-name">User</span>
            <span className="profile-role">Member</span>
          </div>
          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}

export default Header;
