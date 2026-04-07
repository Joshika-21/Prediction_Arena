"""
function_app.py — Azure Function scoring engine entry point.

WHY THIS FILE EXISTS:
    This is the main file Azure Functions looks for when it starts up.
    It defines one HTTP endpoint that the admin calls when an event outcome
    is known (e.g. "Did Team A win? Yes."). The function then:

        1. Reads the request   — what event? what was the outcome?
        2. Reads Cosmos DB     — who submitted predictions for this event?
        3. Scores predictions  — run brier.py math on every user's prediction
        4. Writes Cosmos DB    — save each user's score permanently
        5. Sends Service Bus   — tell the leaderboard service to update live

WHY AZURE FUNCTIONS (not FastAPI like the prediction service):
    Azure Functions are designed for short, event-triggered tasks — exactly
    what scoring is. An admin resolves an event → function runs → function
    finishes. We don't need a constantly running server for this. It's also
    cheaper (you pay per execution, not per hour of uptime).

HOW IT CONNECTS TO THE REST OF THE SYSTEM:
    Admin HTTP POST
         ↓
    [THIS FILE] resolve_event()
         ↓                    ↓
    Cosmos DB            Service Bus
    (save scores)        (notify leaderboard)
                              ↓
                    Leaderboard service (Dev 3)
                    pushes update via SignalR
"""

import json        # For converting Python dicts to/from JSON in HTTP bodies
import logging     # For writing logs visible in Azure Portal and local terminal
import os          # For reading environment variables (connection strings, names)

import azure.functions as func                          # Azure Functions SDK
from azure.cosmos import CosmosClient                   # Cosmos DB client
from azure.servicebus import ServiceBusClient, ServiceBusMessage  # Service Bus client

from brier import score_all_predictions  # Our pure scoring logic from brier.py

# ── Logging setup ─────────────────────────────────────────────────────────────
# WHY: Python's logging module sends messages to Azure Application Insights
# when deployed, and to your terminal when running locally. Always prefer
# logger.info/error over print() in Azure Functions.
logger = logging.getLogger(__name__)

# ── Azure Function App ─────────────────────────────────────────────────────────
# WHY: func.FunctionApp() is the entry point Azure Functions SDK requires.
# http_auth_level=FUNCTION means callers must include a function key in the
# request — this stops random people on the internet from calling resolve-event.
app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)


# ── HTTP Endpoint ─────────────────────────────────────────────────────────────

@app.route(route="resolve-event", methods=["POST"])
def resolve_event(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP POST /api/resolve-event

    WHY THIS ENDPOINT EXISTS:
        When an admin decides an event is over and knows the real outcome,
        they POST to this endpoint. It triggers the full scoring pipeline
        for every user who predicted on that event.

    REQUEST BODY (JSON):
        {
            "event_id":       "event-abc-123",
            "actual_outcome": 1               (1 = happened, 0 = did not happen)
        }

    SUCCESS RESPONSE (200 JSON):
        {
            "event_id":     "event-abc-123",
            "actual_outcome": 1,
            "scored_users": 3,
            "scores": [
                {"user_id": "alice", "brier_score": 0.01},
                {"user_id": "bob",   "brier_score": 0.64},
                {"user_id": "carol", "brier_score": 0.25}
            ]
        }

    ERROR RESPONSES:
        400 — bad request body (missing fields, wrong types)
        404 — no predictions found for this event_id
        500 — database or service bus failure
    """
    logger.info("resolve-event triggered")

    # ── Step 1: Parse the request body ────────────────────────────────────
    # WHY: We need to know WHICH event was resolved and WHAT the outcome was.
    # We wrap this in try/except because the caller might send malformed JSON
    # or forget a required field — we return a clear 400 instead of crashing.
    try:
        body           = req.get_json()
        event_id       = body["event_id"]
        actual_outcome = int(body["actual_outcome"])
    except (ValueError, KeyError) as e:
        return func.HttpResponse(
            json.dumps({"error": f"Invalid request body: {e}"}),
            status_code=400,
            mimetype="application/json",
        )

    # Extra validation: outcome must be exactly 0 or 1, not some other number
    if actual_outcome not in (0, 1):
        return func.HttpResponse(
            json.dumps({"error": "actual_outcome must be 0 or 1"}),
            status_code=400,
            mimetype="application/json",
        )

    # ── Step 2: Read predictions from Cosmos DB ───────────────────────────
    # WHY: We need to know every user's predicted_probability for this event
    # so we can score them. The prediction service (Dev 1) wrote these records
    # when users submitted their predictions.
    try:
        predictions = _get_predictions_from_cosmos(event_id)
    except Exception as e:
        logger.error("Failed to read from Cosmos DB: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to read predictions from database"}),
            status_code=500,
            mimetype="application/json",
        )

    # If nobody predicted on this event, there's nothing to score
    if not predictions:
        return func.HttpResponse(
            json.dumps({"error": f"No predictions found for event_id '{event_id}'"}),
            status_code=404,
            mimetype="application/json",
        )

    # ── Step 3: Calculate Brier Scores ────────────────────────────────────
    # WHY: This is the core of your role — run every user's prediction through
    # the Brier Score formula. score_all_predictions() is imported from brier.py.
    scored = score_all_predictions(predictions, actual_outcome)
    logger.info("Scored %d predictions for event %s", len(scored), event_id)

    # ── Step 4: Write scores back to Cosmos DB ────────────────────────────
    # WHY: Scores need to be persisted so the leaderboard can rank users.
    # We upsert (insert or update) so re-resolving an event safely overwrites
    # old scores rather than creating duplicate records.
    try:
        _write_scores_to_cosmos(event_id, actual_outcome, scored)
    except Exception as e:
        logger.error("Failed to write scores to Cosmos DB: %s", e)
        return func.HttpResponse(
            json.dumps({"error": "Failed to save scores to database"}),
            status_code=500,
            mimetype="application/json",
        )

    # ── Step 5: Notify leaderboard via Service Bus ────────────────────────
    # WHY: The leaderboard service (Dev 3) needs to know that new scores are
    # available so it can push a real-time update to all connected browsers
    # via SignalR. We use Service Bus (a message queue) rather than calling
    # the leaderboard directly because it decouples the services — if the
    # leaderboard is temporarily down, the message waits in the queue safely.
    #
    # NOTE: This step is non-fatal. If Service Bus fails, we log a warning
    # but still return success — the scores ARE saved, the leaderboard just
    # won't update live until the next time it polls.
    try:
        _send_service_bus_message(event_id, scored)
    except Exception as e:
        logger.warning(
            "Service Bus notification failed (scores still saved): %s", e
        )

    # ── Step 6: Return summary to the caller ─────────────────────────────
    response_body = {
        "event_id":     event_id,
        "actual_outcome": actual_outcome,
        "scored_users": len(scored),
        "scores": [
            {"user_id": s["user_id"], "brier_score": s["brier_score"]}
            for s in scored
        ],
    }
    return func.HttpResponse(
        json.dumps(response_body),
        status_code=200,
        mimetype="application/json",
    )


# ── Cosmos DB helpers ─────────────────────────────────────────────────────────

def _get_cosmos_container(container_name: str):
    """
    Return a Cosmos DB container client.

    WHY: Both read and write operations need a container client. This helper
    avoids duplicating the connection setup code. It reads credentials from
    environment variables (set in local.settings.json locally, and in Azure
    App Settings when deployed) so secrets are never hardcoded in source code.
    """
    client = CosmosClient.from_connection_string(
        os.environ["COSMOS_CONNECTION_STRING"]   # Set in local.settings.json
    )
    db = client.get_database_client(
        os.environ["COSMOS_DATABASE_NAME"]       # e.g. "predictionarena"
    )
    return db.get_container_client(container_name)


def _get_predictions_from_cosmos(event_id: str) -> list[dict]:
    """
    Fetch all predictions for a given event from the 'predictions' container.

    WHY: Before scoring, we need every user's predicted_probability for this
    event. Dev 1's prediction service writes these documents when users submit
    predictions. We query by event_id to get only predictions for THIS event.

    EXPECTED DOCUMENT SHAPE IN COSMOS DB (written by Dev 1):
        {
            "id":                    "some-unique-id",
            "event_id":              "event-abc-123",
            "user_id":               "user-xyz-456",
            "predicted_probability": 0.75
        }

    RETURNS:
        A list of simplified dicts ready for brier.py:
        [
            {"user_id": "user-xyz-456", "predicted_probability": 0.75},
            ...
        ]
    """
    container = _get_cosmos_container(
        # Falls back to "predictions" if env var not set — matches Dev 1's container name
        os.environ.get("COSMOS_PREDICTIONS_CONTAINER", "predictions")
    )

    # Parameterised query — using @event_id prevents SQL injection attacks
    query  = "SELECT * FROM c WHERE c.event_id = @event_id"
    params = [{"name": "@event_id", "value": event_id}]

    items = list(container.query_items(query=query, parameters=params))

    # Return only the two fields brier.py needs, ignoring Cosmos metadata fields
    return [
        {
            "user_id":               item["user_id"],
            "predicted_probability": float(item["predicted_probability"]),
        }
        for item in items
    ]


def _write_scores_to_cosmos(
    event_id: str, actual_outcome: int, scored: list[dict]
) -> None:
    """
    Write scoring results to the 'scores' container in Cosmos DB.

    WHY: Scores must be saved permanently so the leaderboard can rank users
    across all events, not just the current one. The leaderboard service
    (Dev 3) reads from this container to build rankings.

    WHY UPSERT (not insert):
        If an admin accidentally resolves the same event twice, upsert safely
        overwrites the old score instead of creating duplicate documents or
        throwing an error.

    DOCUMENT SHAPE WRITTEN TO COSMOS DB:
        {
            "id":                    "event-abc-123_user-xyz-456",  ← composite key
            "event_id":              "event-abc-123",
            "user_id":               "user-xyz-456",
            "brier_score":           0.04,
            "actual_outcome":        1,
            "predicted_probability": 0.8
        }

    WHY COMPOSITE ID ("event_id_user_id"):
        Cosmos DB requires a unique "id" per document. Combining event_id and
        user_id guarantees uniqueness — one score per user per event.
    """
    container = _get_cosmos_container(
        os.environ.get("COSMOS_SCORES_CONTAINER", "scores")
    )

    for entry in scored:
        doc = {
            # Composite ID ensures one document per user per event
            "id":                    f"{event_id}_{entry['user_id']}",
            "event_id":              event_id,
            "user_id":               entry["user_id"],
            "brier_score":           entry["brier_score"],
            "actual_outcome":        actual_outcome,
            "predicted_probability": entry["predicted_probability"],
        }
        # upsert_item = insert if new, update if already exists
        container.upsert_item(doc)


# ── Service Bus helper ────────────────────────────────────────────────────────

def _send_service_bus_message(event_id: str, scored: list[dict]) -> None:
    """
    Send a message to the Service Bus queue to trigger a leaderboard update.

    WHY SERVICE BUS (not a direct HTTP call to the leaderboard):
        Service Bus is a message queue. If we called the leaderboard service
        directly and it was temporarily down or slow, our scoring function
        would fail or hang. With Service Bus:
          - The message sits in the queue safely if leaderboard is down
          - The leaderboard picks it up when it's ready
          - The two services are decoupled — changes to one don't break the other

    WHY THIS MESSAGE FORMAT:
        We send the full scores list so the leaderboard service doesn't need
        to make its own Cosmos DB query — it has everything it needs to push
        an update to connected browsers via SignalR immediately.

    MESSAGE BODY (JSON string sent to the queue):
        {
            "event_id": "event-abc-123",
            "scores": [
                {"user_id": "alice", "brier_score": 0.01},
                {"user_id": "bob",   "brier_score": 0.64}
            ]
        }

    QUEUE NAME ("scores-updated"):
        Dev 3's leaderboard service listens on this queue. The name must
        match exactly — set via SERVICE_BUS_QUEUE_NAME env var.
    """
    payload = json.dumps({
        "event_id": event_id,
        "scores": [
            {"user_id": s["user_id"], "brier_score": s["brier_score"]}
            for s in scored
        ],
    })

    # 'with' blocks ensure the connection is closed cleanly even if an error occurs
    with ServiceBusClient.from_connection_string(
        os.environ["SERVICE_BUS_CONNECTION_STRING"]
    ) as sb_client:
        queue_name = os.environ.get("SERVICE_BUS_QUEUE_NAME", "scores-updated")
        with sb_client.get_queue_sender(queue_name) as sender:
            sender.send_messages(ServiceBusMessage(payload))

    logger.info("Service Bus message sent for event %s", event_id)