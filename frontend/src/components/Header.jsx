
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  UserRound,
  X,
  Info,
} from "lucide-react";

function Header({
  user,
  onLogout,
  searchQuery = "",
  onSearchChange,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "User";

  const displayRole = user?.role || "Member";

  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  // Keyboard shortcut: Ctrl + K / Cmd + K.
  useEffect(() => {
    const handleShortcut = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape") {
        setShowNotifications(false);
        setShowProfile(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  // Close dropdowns when clicking outside.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const toggleNotifications = () => {
    setShowNotifications((previous) => !previous);
    setShowProfile(false);
  };

  const toggleProfile = () => {
    setShowProfile((previous) => !previous);
    setShowNotifications(false);
  };

  const handleLogout = () => {
    setShowProfile(false);
    onLogout?.();
  };

  return (
    <header className="top-header">
      <div className="header-search">
        <Search size={18} />

        <input
          ref={searchRef}
          type="search"
          placeholder="Search polls by title or description..."
          value={searchQuery}
          onChange={(event) =>
            onSearchChange?.(event.target.value)
          }
          aria-label="Search polls"
        />

        {searchQuery && (
          <button
            type="button"
            className="header-search-clear"
            onClick={() => onSearchChange?.("")}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}

        <span className="search-shortcut">Ctrl K</span>
      </div>

      <div className="header-actions">
        {/* Notifications */}
        <div className="header-dropdown-wrapper" ref={notificationRef}>
          <button
            type="button"
            className={`notification-button ${
              showNotifications ? "dropdown-active" : ""
            }`}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            onClick={toggleNotifications}
          >
            <Bell size={20} />
          </button>

          {showNotifications && (
            <div className="header-dropdown notification-dropdown">
              <div className="header-dropdown-heading">
                <div>
                  <h3>Notifications</h3>
                  <p>Your latest updates</p>
                </div>

                <button
                  type="button"
                  className="dropdown-close-button"
                  onClick={() => setShowNotifications(false)}
                  aria-label="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="notification-empty">
                <div className="notification-empty-icon">
                  <Info size={22} />
                </div>

                <strong>No notifications yet</strong>

                <p>
                  Poll updates and activity notifications will appear here
                  when notification support is connected.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider"></div>

        {/* User profile */}
        <div className="header-dropdown-wrapper" ref={profileRef}>
          <button
            type="button"
            className="profile-button"
            onClick={toggleProfile}
            aria-expanded={showProfile}
            aria-label="Open profile menu"
          >
            <div className="profile-avatar">
              {initials || "U"}
            </div>

            <div className="profile-details">
              <span className="profile-name">{displayName}</span>
              <span className="profile-role">{displayRole}</span>
            </div>

            <ChevronDown
              size={16}
              className={showProfile ? "profile-chevron-open" : ""}
            />
          </button>

          {showProfile && (
            <div className="header-dropdown profile-dropdown">
              <div className="profile-dropdown-user">
                <div className="profile-avatar">
                  {initials || "U"}
                </div>

                <div>
                  <strong>{displayName}</strong>
                  <span>{user?.email || displayRole}</span>
                </div>
              </div>

              <div className="profile-dropdown-divider"></div>

              <button
                type="button"
                className="profile-dropdown-item"
                onClick={handleLogout}
              >
                <LogOut size={17} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
