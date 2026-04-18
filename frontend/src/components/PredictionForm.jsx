import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE

function PredictionForm({ event, user, onClose }) {
  const [confidence, setConfidence] = useState(50)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = user?.username || 'guest'
      const response = await fetch(`${API_BASE}/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          eventId: event.id,
          prediction: event.title,
          category: event.category,
          confidence,
          deadline: event.deadline
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Submission failed')
      }
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Make Your Prediction 🎯</h2>
        <p>{event.title}</p>

        <div className="confidence-slider">
          <label>Confidence Level: {confidence}%</label>
          <input
            type="range"
            min="1"
            max="99"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          />
          <div className="confidence-labels">
            <span>Not confident</span>
            <span>Very confident</span>
          </div>
        </div>

        {success ? (
          <div className="success-message">
            ✅ Prediction submitted successfully!
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div className="form-buttons">
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Prediction'}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  )
}

export default PredictionForm