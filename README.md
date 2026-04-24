# Prediction Arena

A cloud-native prediction market platform where users predict real-world events and get scored on accuracy using the Brier Score. Built as a final project for CSC 4311 Cloud Computing at Georgia State University.

---

## What It Does

Users browse 40+ prediction markets across 10 categories, select YES or NO on events, set a confidence level (1–99%), and submit their prediction. When an event resolves, every prediction is automatically scored using the Brier Score formula. Scores appear on a live leaderboard ranked from most to least accurate.

Market probabilities are powered by real external data — not made-up numbers:
- **Crypto** → [CoinGecko API](https://docs.coingecko.com/reference/introduction)
- **Economics** → [FRED API](https://fred.stlouisfed.org/docs/api/fred) (Federal Reserve)
- **Sports** → [The Odds API](https://the-odds-api.com)
- **Politics** → [Polymarket](https://polymarket.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Prediction Service | Python FastAPI |
| Scoring Engine | Python Azure Functions |
| Leaderboard Service | C# ASP.NET Core + SignalR |
| Database | Azure Cosmos DB |
| Message Queue | Azure Service Bus |
| Container Registry | Azure Container Registry |
| Hosting | Azure Container Apps |
| CI/CD | GitHub Actions |

---

## Project Structure

```
Prediction_Arena/
├── frontend/                   # React + Vite web application
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Events.jsx
│   │   │   ├── EventDetail.jsx
│   │   │   ├── MyPredictions.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Admin.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── PredictionForm.jsx
│   │   ├── api.js
│   │   └── App.jsx
│   └── package.json
│
├── services/
│   ├── prediction/             # FastAPI backend (Python)
│   │   ├── main.py             # All API endpoints
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   │
│   ├── scoring/                # Scoring Engine (Python Azure Functions)
│   │   ├── function_app.py
│   │   ├── brier.py            # Brier Score logic
│   │   ├── test_brier.py       # Unit tests
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── leaderboard/            # Leaderboard Service (C# ASP.NET Core)
│       ├── Program.cs
│       ├── leaderboard.csproj
│       └── Dockerfile
│
├── .github/
│   └── workflows/
│       ├── deploy.yml          # CI/CD for Prediction Service
│       └── deploy-scoring.yml  # CI/CD for Scoring Engine
│
└── README.md
```

---

## Architecture

```
React Frontend
      │
      ▼
Prediction Service (FastAPI)  ──────────►  Azure Service Bus
      │                                           │
      ▼                                           ▼
Azure Cosmos DB  ◄──────────────────  Scoring Engine (Azure Functions)
      │
      ▼
Leaderboard Service (C# + SignalR)
      │
      ▼
React Frontend (real-time push)
```

**Data flow:**
1. User submits prediction → saved to Cosmos DB + message sent to Service Bus
2. Admin resolves event → Brier Score calculated for all pending predictions
3. Scores written to Cosmos DB → Leaderboard Service pushes updates via SignalR

---

## Brier Score

The scoring formula used by professional forecasters:

```
Brier Score = (Predicted Probability − Actual Outcome)²
```

| Example | Score | Quality |
|---------|-------|---------|
| 90% YES, event happened | 0.01 | Excellent |
| 50% YES, either outcome | 0.25 | Random baseline |
| 90% YES, event didn't happen | 0.81 | Poor |

Range: **0.0** (perfect) → **1.0** (worst). Lower is better.

---

## API Endpoints

Base URL: `https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/events` | Get all active and resolved events |
| `GET` | `/events/{event_id}` | Get a single event |
| `POST` | `/events` | Create a new event (Admin) |
| `GET` | `/events/{event_id}/predictions` | Get community stats for an event |
| `POST` | `/predictions` | Submit a prediction |
| `POST` | `/register` | Register a new user |
| `POST` | `/login` | Login and get userId |
| `GET` | `/users/{username}/predictions` | Get a user's prediction history |
| `POST` | `/resolve-event` | Resolve an event and score predictions (Admin) |

---

## Running Locally

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (optional, for running services in containers)

### 1. Clone the repo

```bash
git clone https://github.com/Joshika-21/Prediction_Arena.git
cd Prediction_Arena
```

### 2. Set up environment variables

Create a `.env` file inside `services/prediction/`:

```env
COSMOS_ENDPOINT=your_cosmos_endpoint
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=PredictionArenaDB
COSMOS_CONTAINER=predictions
SERVICE_BUS_CONNECTION=your_service_bus_connection_string
```

### 3. Run the backend

```bash
cd services/prediction
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`

> **Note:** The frontend is configured to point to the live Azure backend by default. To use a local backend, update the API base URL in `frontend/src/api.js`.

---

## Deployment

The backend is deployed automatically via GitHub Actions on every push to `main` that includes changes in `services/prediction/`.

### CI/CD Pipeline

```
Push to main
    │
    ▼
GitHub Actions triggered
    │
    ▼
Docker image built (linux/amd64)
    │
    ▼
Image pushed to Azure Container Registry
with versioned tag (e.g. :v8)
    │
    ▼
az containerapp update deploys new image
    │
    ▼
Live in ~3 minutes
```

### Manual deployment

```bash
# Login to Azure
az login

# Update the container app manually
az containerapp update \
  --name prediction-service \
  --resource-group prediction-arena-rg \
  --image predictionarenaregistry.azurecr.io/prediction-service:v8
```

> **Important:** Always use versioned tags (`:v1`, `:v2`) — never `:latest`. Azure Container Apps caches the `:latest` tag and will not pull fresh images.

---

## Running Tests

```bash
cd services/scoring
pip install -r requirements.txt
python -m pytest test_brier.py -v
```

Expected output:
```
test_brier.py::test_perfect_prediction PASSED
test_brier.py::test_worst_prediction PASSED
test_brier.py::test_random_baseline PASSED
test_brier.py::test_edge_case_low PASSED
test_brier.py::test_edge_case_high PASSED
```

---

## Seeding Events

To seed the 43 default events into Cosmos DB:

```bash
cd services/prediction
pip install azure-cosmos
python seed_events.py
```

This populates the events container with markets across all 10 categories.

---

## Team

| Name | Role |
|------|------|
| Joshika Reddy Avuthu | Cloud / DevOps — Azure infrastructure, Dockerfiles, CI/CD pipelines |
| Tahia Islam | Backend Developer 1 — Prediction Service (FastAPI) |
| Lasya Sai Jonnalagadda | Backend Developer 2 — Scoring Engine (Azure Functions) |
| Yewon Cho | Backend Developer 3 — Leaderboard Service (C# / SignalR) |
| Krishna Charitha Kidambi | Frontend Developer — React web application |

---

## Known Limitations

- The React frontend is not publicly deployed — it runs locally with `npm run dev`
- Live probability data is only available for Crypto and Economics categories; other categories default to 50/50
- Events must be created manually through the Admin panel

---

## License

This project was built for academic purposes as part of CSC 4311 Cloud Computing at Georgia State University, Spring 2026.
