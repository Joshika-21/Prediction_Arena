from azure.cosmos import CosmosClient
from dotenv import load_dotenv
import os

load_dotenv()

cosmos_client = CosmosClient(
    url = os.getenv("COSMOS_ENDPOINT"),
    credential = os.getenv("COSMOS_KEY")
)
container = cosmos_client.get_database_client(
    os.getenv("COSMOS_DATABASE")
).get_container_client(
    os.getenv("COSMOS_CONTAINER")
)

def calculate_brier_score(confidence: float, outcome: int) -> float:
    confidence_decimal = confidence / 100
    brier_score = (confidence_decimal - outcome) ** 2
    return round(brier_score, 4)

def score_event(event_id: str, outcome: int):
    query = f"SELECT * FROM predictions p WHERE p.eventId = '{event_id}' AND p.status = 'pending'"
    
    print(f"Running query: {query}")  # ← add this
    
    predictions = list(container.query_items(
        query=query,
        enable_cross_partition_query=True
    ))
    
    print(f"Found {len(predictions)} predictions")  # ← add this
    print(f"Predictions: {predictions}")  # ← add this
    
    for prediction in predictions:
        brier_score = calculate_brier_score(
            prediction["confidence"],
            outcome
        )
        prediction["brierScore"] = brier_score
        prediction["status"] = "resolved"
        container.replace_item(
            item=prediction["id"],
            body=prediction
        )
        print(f"Scored prediction {prediction['id']}: {brier_score}")
    return len(predictions)

def main(event_id: str, outcome: int):
    print(f"Starting scoring for event: {event_id}")
    print(f"Outcome: {outcome}")
    #Validate outcomes is only 0 or 1
    if outcome not in [0, 1]:
        raise ValueError("Outcome must be 0 (didn't happen) or 1 (happened)")
    # Score all predictions for this event
    total_scored = score_event(event_id, outcome)
    print(f"Successfully scored {total_scored} predictions!")
    return total_scored
#This lets us test it directly
if __name__ == "__main__":
    main(
        event_id = "event_001",
        outcome = 1
    )