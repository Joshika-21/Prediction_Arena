import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Events from './pages/Events'
import Leaderboard from './pages/Leaderboard'
import Navbar from './components/Navbar'
import './styles/App.css'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App