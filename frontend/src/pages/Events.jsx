import { useState } from 'react'
import PredictionForm from '../components/PredictionForm'

function Events() {
  const [selectedEvent, setSelectedEvent] = useState(null)
  // Sample events for now - later these will come from the API
  const events = [
    {
      id: "event_001",
      title: "Will Bitcoin hit $100k by December 2026?",
      category: "Crypto",
      deadline: "2026-12-31"
    },
    {
      id: "event_002", 
      title: "Will it rain in Atlanta this weekend?",
      category: "Weather",
      deadline: "2026-03-22"
    },
    {
      id: "event_003",
      title: "Will the Lakers make the playoffs?",
      category: "Sports",
      deadline: "2026-04-15"
    }
  ]
  return (
    <div className="page">
      <h1>Active Events 🎯</h1>
      <p>Pick an event and submit your prediction!</p>
      <div className="events-grid">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <span className="category-badge">{event.category}</span>
            <h3>{event.title}</h3>
            <p>Deadline: {event.deadline}</p>
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