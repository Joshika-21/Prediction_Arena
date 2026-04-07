from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
from dotenv import load_dotenv
from typing import Optional
from azure.cosmos import CosmosClient
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import json


# Load environment variables from .env file
load_dotenv()

# Create the FastAPI app
app = FastAPI(title="Prediction Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",       
        "http://localhost:3000",       
        "*"                            
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Cosmos DB
cosmos_client = CosmosClient(
    url=os.getenv("COSMOS_ENDPOINT"),
    credential=os.getenv("COSMOS_KEY")
)

container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client(
    os.getenv("COSMOS_CONTAINER")
)

events_container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client("events")

# What user sends
class PredictionInput(BaseModel):
    userId: str
    eventId: str
    prediction: str
    category: str
    confidence: float = Field(ge=0, le=100)
    deadline: str

# What we store in database
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

@app.post("/predictions")
async def create_prediction(prediction: PredictionInput):
    try:
        # Step 1 - Create the full document
        doc = PredictionDocument(
            id=str(uuid.uuid4()),
            userId=prediction.userId,
            eventId = prediction.eventId,
            prediction=prediction.prediction,
            category=prediction.category,
            confidence=prediction.confidence,
            deadline=prediction.deadline,
            createdAt=datetime.utcnow().isoformat(),
            status="pending",
            brierScore=None
        )

        # Step 2 - Send to Service Bus queue
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

        # Step 3 - Save to Cosmos DB
        print("Saving document:", doc.model_dump())
        container.create_item(body=doc.model_dump())

        # Step 4 - Return success
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
        # Fetch all resolved predictions
        query = """
            SELECT p.userId, p.brierScore
            FROM predictions p
            WHERE p.status = 'resolved'
        """
        results = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        # Group by userId and calculate average in Python
        user_scores = {}
        for result in results:
            userId = result["userId"]
            score = result["brierScore"]
            if userId not in user_scores:
                user_scores[userId] = {"scores": [], "total": 0}
            user_scores[userId]["scores"].append(score)
            user_scores[userId]["total"] += 1

        # Calculate average for each user
        leaderboard = []
        for userId, data in user_scores.items():
            avg_score = sum(data["scores"]) / len(data["scores"])
            leaderboard.append({
                "userId": userId,
                "avgBrierScore": round(avg_score, 4),
                "totalPredictions": data["total"]
            })

        # Sort by avgBrierScore (lowest first = best predictor)
        leaderboard.sort(key=lambda x: x["avgBrierScore"])

        # Add ranks
        for index, player in enumerate(leaderboard):
            player["rank"] = index + 1

        return {"leaderboard": leaderboard}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        