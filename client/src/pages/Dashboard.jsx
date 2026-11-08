import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <main className="page-shell">
      <section className="welcome-panel">
        <p className="eyebrow">Your health, one step at a time</p>
        <h1>Welcome, {user?.name}</h1>
        <p>
          Keep your glucose readings together and review your progress whenever
          you need.
        </p>
        <Link className="button button-primary" to="/reports">
          View your reports
        </Link>
      </section>
      <section className="info-card">
        <span className="info-icon" aria-hidden="true">♥</span>
        <div>
          <h2>A little consistency goes a long way</h2>
          <p>
            Record readings at your usual times to make your personal patterns
            easier to see.
          </p>
        </div>
      </section>
    </main>
  );
}
