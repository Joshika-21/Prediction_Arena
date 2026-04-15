import azure.functions as func
import json
import os
import logging
from azure.cosmos import CosmosClient
from azure.servicebus import ServiceBusClient, ServiceBusMessage

app = func.FunctionApp()

# Cosmos DB setup
cosmos_client = CosmosClient(
    url=os.getenv("COSMOS_ENDPOINT"),
    credential=os.getenv("COSMOS_KEY")
)
db = cosmos_client.get_database_client(os.getenv("COSMOS_DATABASE", "PredictionArenaDB"))
predictions_container = db.get_container_client("predictions")
scores_container = db.get_container_client("scores")
events_container = db.get_container_client("events")


def calculate_brier_score(confidence: float, outcome: int) -> float:
    probability = confidence / 100.0
    return round((probability - outcome) ** 2, 4)


def notify_leaderboard(event_id: str):
    try:
        connection_string = os.getenv("SERVICE_BUS_CONNECTION_STRING")
        if not connection_string:
            logging.warning("SERVICE_BUS_CONNECTION_STRING not set")
            return
        queue_name = os.getenv("SCORES_QUEUE_NAME", "scores-updated")
        with ServiceBusClient.from_connection_string(connection_string) as client:
            sender = client.get_queue_sender(queue_name)
            with sender:
                sender.send_messages(ServiceBusMessage(
                    json.dumps({"event_id": event_id, "status": "scored"})
                ))
        logging.info(f"Leaderboard notified for event {event_id}")
    except Exception as e:
        logging.warning(f"Could not notify leaderboard: {e}")


@app.route(route="resolve", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def resolve_event(req: func.HttpRequest) -> func.HttpResponse:
    logging.info("resolve_event triggered")
    try:
        body = req.get_json()
        event_id = body.get("event_id")
        outcome = body.get("outcome")

        if not event_id:
            return func.HttpResponse(
                json.dumps({"error": "event_id is required"}),
                status_code=400, mimetype="application/json"
            )
        if outcome not in [0, 1]:
            return func.HttpResponse(
                json.dumps({"error": "outcome must be 0 (NO) or 1 (YES)"}),
                status_code=400, mimetype="application/json"
            )

        # Fetch all pending predictions for this event
        predictions = list(predictions_container.query_items(
            query="SELECT * FROM c WHERE c.eventId = @event_id AND c.status = 'pending'",
            parameters=[{"name": "@event_id", "value": event_id}],
            enable_cross_partition_query=True
        ))
        logging.info(f"Found {len(predictions)} pending predictions for event {event_id}")

        scored_count = 0
        for prediction in predictions:
            confidence = prediction.get("confidence", 50)
            brier = calculate_brier_score(confidence, outcome)

            # Write to scores container
            scores_container.upsert_item({
                "id": f"score_{prediction['id']}",
                "event_id": event_id,
                "user_id": prediction.get("userId"),
                "prediction_id": prediction["id"],
                "confidence": confidence,
                "actual_outcome": outcome,
                "brier_score": brier,
            })

            # Mark prediction resolved
            prediction["status"] = "resolved"
            prediction["brierScore"] = brier
            predictions_container.replace_item(item=prediction["id"], body=prediction)
            scored_count += 1

        # Mark event resolved
        try:
            events = list(events_container.query_items(
                query="SELECT * FROM c WHERE c.id = @event_id",
                parameters=[{"name": "@event_id", "value": event_id}],
                enable_cross_partition_query=True
            ))
            if events:
                event_doc = events[0]
                event_doc["status"] = "resolved"
                event_doc["actual_outcome"] = outcome
                events_container.replace_item(item=event_doc["id"], body=event_doc)
        except Exception as e:
            logging.warning(f"Could not update event status: {e}")

        notify_leaderboard(event_id)

        return func.HttpResponse(
            json.dumps({
                "status": "success",
                "event_id": event_id,
                "outcome": outcome,
                "scored_predictions": scored_count
            }),
            status_code=200, mimetype="application/json"
        )

    except ValueError as e:
        return func.HttpResponse(
            json.dumps({"error": f"Invalid JSON: {str(e)}"}),
            status_code=400, mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"resolve_event failed: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500, mimetype="application/json"
        )


@app.route(route="health", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"status": "Scoring Engine running"}),
        status_code=200, mimetype="application/json"
    )