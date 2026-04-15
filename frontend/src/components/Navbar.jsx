import { Link, useLocation } from 'react-router-dom'

function Navbar({ user, onLogout }) {
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          ⚡ Prediction Arena
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={isActive('/') ? 'nav-link active' : 'nav-link'}>
          Markets
        </Link>
        {user && (
          <Link to="/my-predictions" className={isActive('/my-predictions') ? 'nav-link active' : 'nav-link'}>
            My Predictions
          </Link>
        )}
        <Link to="/admin" className={isActive('/admin') ? 'nav-link active' : 'nav-link'}>
          Admin
        </Link>
        {user ? (
          <span className="nav-user">
            👤 {user.username}
            <button onClick={onLogout} className="btn-logout">Sign Out</button>
          </span>
        ) : (
          <Link to="/login" className={isActive('/login') ? 'nav-link active' : 'nav-link'}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}

export default Navbar