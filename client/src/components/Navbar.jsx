import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <NavLink className="brand" to="/dashboard">
          Sweety
        </NavLink>
        <div className="nav-links">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </div>
        <div className="nav-user">
          <span className="nav-greeting">Hello, {user?.name}</span>
          <button className="button button-quiet button-small" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
