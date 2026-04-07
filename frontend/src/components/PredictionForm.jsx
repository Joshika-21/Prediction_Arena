import { useState } from 'react'
import axios from 'axios'
import API_BASE_URL from '../services/api'

function PredictionForm({ event, onClose }) {
  const [confidence, setConfidence] = useState(50)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await axios.post(`${API_BASE_URL}/predictions`, {
        userId: "joshika123",
        eventId: event.id,
        prediction: event.title,
        category: event.category,
        confidence: confidence,
        deadline: event.deadline
      })
      setSuccess(true)
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setError("Something went wrong. Please try again!")
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
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <div className="form-buttons">
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Prediction"}
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