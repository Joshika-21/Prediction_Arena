import {Link} from 'react-router-dom'
function Navbar() {
    return (
        <nav className = "navbar">
            <div className = "navbar-brand">
                🎯Prediction Arena
            </div>
            <div className = "navbar-links">
                <Link to = "/">Home</Link>
                <Link to = "/events">Events</Link>
                <Link to = "/leaderboard">Leaderboard</Link>
            </div>
        </nav>
    )
}
export default Navbar