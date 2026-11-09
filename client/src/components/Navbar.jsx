import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import ErrorMessage from "./ErrorMessage.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Could not contact the server to revoke your session.");
    }
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
          <NavLink to="/profile">Profile</NavLink>
        </div>
        <div className="nav-user">
          <span className="nav-greeting">Hello, {user?.name}</span>
          <button className="button button-quiet button-small" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>
      <ErrorMessage>{logoutError}</ErrorMessage>
    </header>
  );
}
