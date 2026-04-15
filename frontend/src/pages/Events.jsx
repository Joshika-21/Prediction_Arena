import { useState, useEffect } from 'react'
import PredictionForm from '../components/PredictionForm'

const API_BASE = "https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io"

function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE}/events`)
      const data = await response.json()
      setEvents(data)
      setError(null)
    } catch (err) {
      setError("Failed to load events. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page"><h1>Loading events... ⏳</h1></div>
  if (error) return <div className="page"><h1>{error}</h1></div>

  return (
    <div className="page">
      <h1>Active Events 🎯</h1>
      <p>Pick an event and submit your prediction!</p>
      <div className="events-grid">
        {events.filter(e => e.status !== 'resolved').map(event => (
          <div key={event.id} className="event-card">
            <span className="category-badge">{event.category}</span>
            <h3>{event.title}</h3>
            <p>Deadline: {new Date(event.deadline).toLocaleDateString()}</p>
            <button
              className="btn-primary"
              onClick={() => setSelectedEvent(event)}
            >
              Predict
            </button>
          </div>
        ))}
      </div>
      {selectedEvent && (
        <PredictionForm
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

export default Events