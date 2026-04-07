"""
brier.py — Pure Brier Score calculation logic.

WHY THIS FILE EXISTS:
    The Brier Score is the mathematical formula that measures how accurate
    a user's prediction was. This file contains ONLY the math — no Azure,
    no database, no HTTP. Keeping it separate means:
      - You can run and test the logic without any cloud setup
      - function_app.py can import and use it cleanly
      - If the formula ever needs to change, there is one place to change it

WHAT IS A BRIER SCORE:
    Brier Score = (predicted_probability - actual_outcome)^2

    - Lower score  = better prediction (0.0 is perfect)
    - Higher score = worse prediction  (1.0 is the worst possible)
    - actual_outcome is always 1 (event happened) or 0 (event did not happen)
    - predicted_probability is the user's confidence, e.g. 0.8 means "80% sure"

EXAMPLES:
    User predicted 0.8 (80% chance), event DID happen:
        (0.8 - 1)^2 = 0.04  → good prediction, low score

    User predicted 0.8 (80% chance), event did NOT happen:
        (0.8 - 0)^2 = 0.64  → bad prediction, high score

    User predicted 0.5 (completely uncertain):
        (0.5 - 1)^2 = 0.25  → neutral, neither good nor bad
"""


def calculate_brier_score(predicted_probability: float, actual_outcome: int) -> float:
    """
    Calculate the Brier Score for a single user prediction.

    WHY: This is the core formula. Every user's prediction gets run through
    this function when an event is resolved by the admin.

    Args:
        predicted_probability: The user's confidence as a float between 0.0
                               and 1.0. Example: 0.75 means "75% sure".
        actual_outcome:        1 if the event actually happened,
                               0 if the event did NOT happen.

    Returns:
        A float between 0.0 (perfect) and 1.0 (worst possible).

    Raises:
        ValueError: If predicted_probability is outside [0.0, 1.0], or if
                    actual_outcome is not 0 or 1. We raise early so bad data
                    never silently produces a misleading score.
    """

    # Guard: probability must be a valid percentage (0% to 100%)
    if not (0.0 <= predicted_probability <= 1.0):
        raise ValueError(
            f"predicted_probability must be between 0.0 and 1.0, got {predicted_probability}"
        )

    # Guard: outcome can only be binary — happened (1) or didn't happen (0)
    if actual_outcome not in (0, 1):
        raise ValueError(
            f"actual_outcome must be 0 or 1, got {actual_outcome}"
        )

    # The Brier Score formula: square the difference between prediction and reality
    return (predicted_probability - actual_outcome) ** 2


def score_all_predictions(predictions: list[dict], actual_outcome: int) -> list[dict]:
    """
    Score every user's prediction for a single resolved event.

    WHY: When an admin resolves an event, there will be many users who each
    submitted a prediction. This function loops over all of them, calls
    calculate_brier_score for each one, and returns the full scored list.
    function_app.py calls this after fetching predictions from Cosmos DB.

    Args:
        predictions:    A list of dicts pulled from Cosmos DB. Each dict must
                        have these two keys:
                          - "user_id"               : str  (e.g. "user-abc-123")
                          - "predicted_probability" : float (e.g. 0.75)

        actual_outcome: 1 if the event happened, 0 if it did not.

    Returns:
        A new list of dicts — one per user — each containing:
          - "user_id"               : str   (copied from input)
          - "predicted_probability" : float (copied from input)
          - "brier_score"           : float (the calculated score)

    Example input:
        predictions = [
            {"user_id": "alice", "predicted_probability": 0.9},
            {"user_id": "bob",   "predicted_probability": 0.2},
        ]
        actual_outcome = 1

    Example output:
        [
            {"user_id": "alice", "predicted_probability": 0.9, "brier_score": 0.01},
            {"user_id": "bob",   "predicted_probability": 0.2, "brier_score": 0.64},
        ]
    """

    results = []

    for prediction in predictions:
        user_id = prediction["user_id"]
        prob    = prediction["predicted_probability"]

        # Calculate this user's score using the formula above
        score = calculate_brier_score(prob, actual_outcome)

        # Build the output dict — keeps original data plus adds brier_score
        results.append({
            "user_id":               user_id,
            "predicted_probability": prob,
            "brier_score":           score,
        })

    return results