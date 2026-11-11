
import {
  LayoutDashboard,
  PlusCircle,
  Radio,
  History,
  ListChecks,
  Settings,
  LogOut,
} from "lucide-react";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Create Poll", icon: PlusCircle },
  { label: "Active Polls", icon: Radio },
  { label: "Past Polls", icon: History },
  { label: "My Polls", icon: ListChecks },
];

function Sidebar({ activePage, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Radio size={22} />
        </div>
        <span>PulsePoll</span>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-heading">WORKSPACE</p>

        <nav className="sidebar-navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${
                  activePage === item.label ? "active" : ""
                }`}
                onClick={() => onNavigate(item.label)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <button
          type="button"
          className={`nav-item ${
            activePage === "Settings" ? "active" : ""
          }`}
          onClick={() => onNavigate("Settings")}
        >
          <Settings size={19} strokeWidth={1.8} />
          <span>Settings</span>
        </button>

        <button
          type="button"
          className="nav-item logout-item"
          onClick={onLogout}
        >
          <LogOut size={19} strokeWidth={1.8} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
