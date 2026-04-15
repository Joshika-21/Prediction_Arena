from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime
from dotenv import load_dotenv
from typing import Optional
from azure.cosmos import CosmosClient
from azure.servicebus import ServiceBusClient, ServiceBusMessage
import uuid
import os
import json
import bcrypt

# Load environment variables from .env file
load_dotenv()

# Create the FastAPI app
app = FastAPI(title="Prediction Arena API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Cosmos DB
cosmos_client = CosmosClient(
    url=os.getenv("COSMOS_ENDPOINT"),
    credential=os.getenv("COSMOS_KEY")
)

# Predictions container
container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client(
    os.getenv("COSMOS_CONTAINER")
)

# Events container
events_container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client("events")

# Users container
users_container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client("users")

# Scores container
scores_container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client("scores")

# ── Models ─────────────────────────────────────────────────

class PredictionInput(BaseModel):
    userId: str
    eventId: str
    prediction: str
    category: str
    confidence: float = Field(ge=0, le=100)
    deadline: str

class PredictionDocument(BaseModel):
    id: str
    userId: str
    eventId: str
    prediction: str
    category: str
    confidence: float
    deadline: str
    createdAt: str
    status: str
    brierScore: Optional[float] = None

class ResolveEventInput(BaseModel):
    event_id: str
    actual_outcome: int  # 0 (NO) or 1 (YES)

class EventInput(BaseModel):
    title: str
    category: str
    description: str
    deadline: str

class RegisterInput(BaseModel):
    username: str
    password: str

class LoginInput(BaseModel):
    username: str
    password: str

# ── Predictions ────────────────────────────────────────────

@app.post("/predictions")
async def create_prediction(prediction: PredictionInput):
    try:
        doc = PredictionDocument(
            id=str(uuid.uuid4()),
            userId=prediction.userId,
            eventId=prediction.eventId,
            prediction=prediction.prediction,
            category=prediction.category,
            confidence=prediction.confidence,
            deadline=prediction.deadline,
            createdAt=datetime.utcnow().isoformat(),
            status="pending",
            brierScore=None
        )

        servicebus_client = ServiceBusClient.from_connection_string(
            os.getenv("SERVICE_BUS_CONNECTION")
        )
        with servicebus_client:
            sender = servicebus_client.get_queue_sender(
                queue_name="predictions-queue"
            )
            with sender:
                message = ServiceBusMessage(
                    json.dumps(doc.model_dump())
                )
                sender.send_messages(message)

        container.create_item(body=doc.model_dump())

        return {
            "status": "success",
            "message": "Prediction submitted!",
            "predictionId": doc.id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/leaderboard")
async def get_leaderboard():
    try:
        query = """
            SELECT p.userId, p.brierScore
            FROM predictions p
            WHERE p.status = 'resolved'
        """
        results = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        user_scores = {}
        for result in results:
            userId = result["userId"]
            score = result["brierScore"]
            if userId not in user_scores:
                user_scores[userId] = {"scores": [], "total": 0}
            user_scores[userId]["scores"].append(score)
            user_scores[userId]["total"] += 1

        leaderboard = []
        for userId, data in user_scores.items():
            avg_score = sum(data["scores"]) / len(data["scores"])
            leaderboard.append({
                "userId": userId,
                "avgBrierScore": round(avg_score, 4),
                "totalPredictions": data["total"]
            })

        leaderboard.sort(key=lambda x: x["avgBrierScore"])

        for index, player in enumerate(leaderboard):
            player["rank"] = index + 1

        return {"leaderboard": leaderboard}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Resolve Event ──────────────────────────────────────────

@app.post("/resolve-event")
async def resolve_event(data: ResolveEventInput):
    try:
        if data.actual_outcome not in [0, 1]:
            raise HTTPException(status_code=400, detail="actual_outcome must be 0 (NO) or 1 (YES)")

        # Fetch all pending predictions for this event
        predictions = list(container.query_items(
            query="SELECT * FROM c WHERE c.eventId = @event_id AND c.status = 'pending'",
            parameters=[{"name": "@event_id", "value": data.event_id}],
            enable_cross_partition_query=True
        ))

        scored_users = set()
        for prediction in predictions:
            confidence = prediction.get("confidence", 50)
            brier = round((confidence / 100 - data.actual_outcome) ** 2, 4)

            # Upsert score document
            scores_container.upsert_item({
                "id": f"score_{prediction['id']}",
                "event_id": data.event_id,
                "user_id": prediction.get("userId"),
                "prediction_id": prediction["id"],
                "confidence": confidence,
                "actual_outcome": data.actual_outcome,
                "brier_score": brier,
            })

            # Mark prediction resolved
            prediction["status"] = "resolved"
            prediction["brierScore"] = brier
            container.replace_item(item=prediction["id"], body=prediction)
            scored_users.add(prediction.get("userId"))

        # Mark event resolved
        events = list(events_container.query_items(
            query="SELECT * FROM c WHERE c.id = @event_id",
            parameters=[{"name": "@event_id", "value": data.event_id}],
            enable_cross_partition_query=True
        ))
        if events:
            event_doc = events[0]
            event_doc["status"] = "resolved"
            event_doc["actual_outcome"] = data.actual_outcome
            events_container.replace_item(item=event_doc["id"], body=event_doc)

        return {
            "status": "success",
            "event_id": data.event_id,
            "actual_outcome": data.actual_outcome,
            "scored_users": len(scored_users),
            "scored_predictions": len(predictions)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Events ─────────────────────────────────────────────────

@app.get("/events")
async def get_events():
    try:
        query = "SELECT * FROM events e WHERE e.status IN ('active', 'resolved')"
        events = list(events_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/{event_id}")
async def get_event(event_id: str):
    try:
        query = f"SELECT * FROM events e WHERE e.id = '{event_id}'"
        events = list(events_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        if not events:
            raise HTTPException(status_code=404, detail="Event not found")
        return events[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events")
async def create_event(event: EventInput):
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "title": event.title,
            "category": event.category,
            "description": event.description,
            "deadline": event.deadline,
            "createdAt": datetime.utcnow().isoformat(),
            "status": "active",
            "outcome": None,
            "totalPredictions": 0,
            "yesPercent": 50,
            "noPercent": 50
        }
        events_container.create_item(body=doc)
        return {
            "status": "success",
            "message": "Event created!",
            "eventId": doc["id"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/{event_id}/predictions")
async def get_event_predictions(event_id: str):
    try:
        query = f"SELECT * FROM predictions p WHERE p.eventId = '{event_id}'"
        predictions = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        if not predictions:
            return {"totalPredictions": 0, "avgConfidence": 50}

        avg_confidence = sum(p["confidence"] for p in predictions) / len(predictions)

        return {
            "totalPredictions": len(predictions),
            "avgConfidence": round(avg_confidence, 1),
            "yesPercent": round(avg_confidence, 1),
            "noPercent": round(100 - avg_confidence, 1)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Auth ───────────────────────────────────────────────────

@app.post("/register")
async def register(data: RegisterInput):
    try:
        # Check if username already exists
        query = "SELECT * FROM c WHERE c.username = @username"
        params = [{"name": "@username", "value": data.username}]
        existing = list(users_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")

        # Hash the password using bcrypt
        hashed = bcrypt.hashpw(
            data.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')

        # Save user to Cosmos DB
        user = {
            "id": str(uuid.uuid4()),
            "username": data.username,
            "password": hashed,
            "createdAt": datetime.utcnow().isoformat(),
            "totalPredictions": 0
        }
        users_container.create_item(body=user)

        return {
            "status": "success",
            "message": "Account created!",
            "userId": user["id"],
            "username": user["username"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login")
async def login(data: LoginInput):
    try:
        # Find user by username
        query = "SELECT * FROM c WHERE c.username = @username"
        params = [{"name": "@username", "value": data.username}]
        users = list(users_container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

        if not users:
            raise HTTPException(status_code=401, detail="Username not found")

        user = users[0]

        # Verify password using bcrypt
        if not bcrypt.checkpw(
            data.password.encode('utf-8'),
            user["password"].encode('utf-8')
        ):
            raise HTTPException(status_code=401, detail="Wrong password")

        return {
            "status": "success",
            "message": "Login successful!",
            "userId": user["id"],
            "username": user["username"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── User Predictions ───────────────────────────────────────

@app.get("/users/{username}/predictions")
async def get_user_predictions(username: str):
    try:
        # Get all predictions for this user
        query = "SELECT * FROM c WHERE c.userId = @username"
        params = [{"name": "@username", "value": username}]
        predictions = list(container.query_items(
            query=query,
            parameters=params,
            enable_cross_partition_query=True
        ))

        # Get all scores for this user
        scores_container = cosmos_client.get_database_client(
            os.getenv("COSMOS_DATABASE")
        ).get_container_client("scores")
        scores = list(scores_container.query_items(
            query="SELECT * FROM c WHERE c.user_id = @username",
            parameters=[{"name": "@username", "value": username}],
            enable_cross_partition_query=True
        ))

        # Build lookup of event_id -> brier_score
        score_map = {s["event_id"]: s["brier_score"] for s in scores}

        # Update prediction statuses based on scores
        for p in predictions:
            if p["eventId"] in score_map:
                p["status"] = "resolved"
                p["brierScore"] = score_map[p["eventId"]]

        # Sort by createdAt descending
        predictions.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

        return {"predictions": predictions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))