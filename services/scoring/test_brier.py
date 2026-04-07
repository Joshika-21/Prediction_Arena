"""
test_brier.py — Unit tests for brier.py

WHY THIS FILE EXISTS:
    Before connecting to any Azure service, you need to prove the math is
    correct. These tests run entirely locally with no cloud setup needed —
    just Python and pytest. They test every edge case of the Brier Score
    formula so you can be confident the scoring engine is correct before
    wiring up Cosmos DB and Service Bus.

WHY UNIT TESTS MATTER FOR A CLASS PROJECT:
    - They prove your logic works independently of infrastructure
    - If a teammate changes something that breaks scoring, tests catch it
    - They demonstrate to your professor that you understood what the code does
    - They run in under 1 second — much faster than deploying to Azure to test

HOW TO RUN:
    From the services/scoring/ directory:

        # Install pytest (only needed once)
        pip install pytest

        # Run all tests with verbose output
        python -m pytest test_brier.py -v

    Expected output: 13 tests, all PASSED

WHAT WE ARE TESTING:
    1. calculate_brier_score() — the single-prediction formula
    2. score_all_predictions() — the batch scoring function
"""

import pytest

# Import the two functions we want to test from brier.py
# WHY: We import only these — if brier.py had Azure imports they would fail
# locally. brier.py has NONE, which is why we kept it pure.
from brier import calculate_brier_score, score_all_predictions


# ── Tests for calculate_brier_score() ─────────────────────────────────────────

class TestCalculateBrierScore:
    """
    Tests for the single-prediction Brier Score formula.

    WHY A CLASS: Grouping related tests in a class keeps the output organised.
    pytest will show "TestCalculateBrierScore::test_name" making it easy to
    see which category of tests passed or failed.
    """

    def test_perfect_prediction_event_happened(self):
        """
        The absolute best possible score.
        User said 1.0 (100% certain), event DID happen.
        (1.0 - 1)^2 = 0.0 — perfect score.
        """
        assert calculate_brier_score(1.0, 1) == 0.0

    def test_perfect_prediction_event_did_not_happen(self):
        """
        The other perfect scenario.
        User said 0.0 (0% chance), event did NOT happen.
        (0.0 - 0)^2 = 0.0 — perfect score.
        """
        assert calculate_brier_score(0.0, 0) == 0.0

    def test_worst_prediction_event_happened(self):
        """
        The worst possible prediction.
        User said 0.0 (0% chance), but event DID happen.
        (0.0 - 1)^2 = 1.0 — worst score.
        """
        assert calculate_brier_score(0.0, 1) == 1.0

    def test_worst_prediction_event_did_not_happen(self):
        """
        The other worst-case scenario.
        User said 1.0 (100% certain), but event did NOT happen.
        (1.0 - 0)^2 = 1.0 — worst score.
        """
        assert calculate_brier_score(1.0, 0) == 1.0

    def test_neutral_prediction_event_happened(self):
        """
        A completely uncertain user who said 50/50.
        (0.5 - 1)^2 = 0.25 — neither good nor bad.
        """
        assert calculate_brier_score(0.5, 1) == 0.25

    def test_neutral_prediction_event_did_not_happen(self):
        """
        Same 50/50 prediction, opposite outcome — score is the same.
        (0.5 - 0)^2 = 0.25
        WHY THIS MATTERS: Confirms the formula is symmetric around 0.5.
        """
        assert calculate_brier_score(0.5, 0) == 0.25

    def test_good_prediction_event_happened(self):
        """
        A good (but not perfect) prediction.
        User said 0.8, event DID happen.
        (0.8 - 1)^2 = (-0.2)^2 = 0.04
        WHY abs(...) < 1e-9: Floating point arithmetic isn't perfectly exact.
        1e-9 is a tolerance of 0.000000001 — effectively zero.
        """
        assert abs(calculate_brier_score(0.8, 1) - 0.04) < 1e-9

    def test_bad_prediction_event_happened(self):
        """
        A bad prediction — user was overconfident in the WRONG direction.
        User said 0.2 (only 20% chance), event DID happen.
        (0.2 - 1)^2 = (-0.8)^2 = 0.64 — high (bad) score.
        """
        assert abs(calculate_brier_score(0.2, 1) - 0.64) < 1e-9

    def test_invalid_probability_above_1(self):
        """
        Probability cannot exceed 1.0 (you can't be 110% sure).
        brier.py should raise ValueError — we verify it does.
        WHY: If bad data silently gets through, scores would be mathematically
        invalid and the leaderboard rankings would be wrong.
        """
        with pytest.raises(ValueError):
            calculate_brier_score(1.1, 1)

    def test_invalid_probability_below_0(self):
        """
        Probability cannot be negative (you can't be -10% sure).
        Should raise ValueError.
        """
        with pytest.raises(ValueError):
            calculate_brier_score(-0.1, 1)

    def test_invalid_outcome(self):
        """
        actual_outcome must be 0 or 1 — nothing else is valid.
        Passing 2 should raise ValueError.
        """
        with pytest.raises(ValueError):
            calculate_brier_score(0.5, 2)


# ── Tests for score_all_predictions() ─────────────────────────────────────────

class TestScoreAllPredictions:
    """
    Tests for the batch scoring function that processes multiple users at once.

    WHY SEPARATE CLASS: These tests are about the list-processing logic,
    not the formula itself. Keeping them separate makes failures easier to
    diagnose — a formula bug shows up in TestCalculateBrierScore, a
    list-handling bug shows up here.
    """

    def test_basic_scoring_ranks_correctly(self):
        """
        The most important integration test: given two users, the one who
        predicted more confidently in the correct direction gets a lower
        (better) Brier Score.

        Alice predicted 0.9 → (0.9 - 1)^2 = 0.01  ← lower = better
        Bob   predicted 0.1 → (0.1 - 1)^2 = 0.81  ← higher = worse
        """
        predictions = [
            {"user_id": "alice", "predicted_probability": 0.9},
            {"user_id": "bob",   "predicted_probability": 0.1},
        ]
        results = score_all_predictions(predictions, actual_outcome=1)

        # Should return one result per user
        assert len(results) == 2

        alice = next(r for r in results if r["user_id"] == "alice")
        bob   = next(r for r in results if r["user_id"] == "bob")

        # Alice predicted correctly → lower score than Bob
        assert alice["brier_score"] < bob["brier_score"]
        assert abs(alice["brier_score"] - 0.01) < 1e-9
        assert abs(bob["brier_score"]   - 0.81) < 1e-9

    def test_empty_predictions_returns_empty_list(self):
        """
        If no one predicted on an event, return an empty list — don't crash.
        WHY: function_app.py already handles the 404 case before calling this,
        but defensive code is good practice.
        """
        results = score_all_predictions([], actual_outcome=1)
        assert results == []

    def test_output_contains_required_keys(self):
        """
        Verify every result dict has exactly the three keys function_app.py
        expects to write to Cosmos DB. If a key is missing, the Cosmos write
        will silently store incomplete data.
        """
        predictions = [{"user_id": "carol", "predicted_probability": 0.6}]
        results     = score_all_predictions(predictions, actual_outcome=0)

        assert set(results[0].keys()) == {
            "user_id",
            "predicted_probability",
            "brier_score",
        }

    def test_correct_prediction_of_no_event(self):
        """
        Verify scoring works when the event did NOT happen (outcome = 0).
        User correctly predicted 0.0 → perfect score of 0.0.
        WHY: Most examples use outcome=1. This confirms outcome=0 also works.
        """
        predictions = [{"user_id": "dave", "predicted_probability": 0.0}]
        results     = score_all_predictions(predictions, actual_outcome=0)
        assert results[0]["brier_score"] == 0.0

    def test_input_probability_preserved_in_output(self):
        """
        Verify the original predicted_probability is carried through to the
        output. function_app.py stores it in Cosmos DB for record-keeping.
        """
        predictions = [{"user_id": "eve", "predicted_probability": 0.73}]
        results     = score_all_predictions(predictions, actual_outcome=1)
        assert results[0]["predicted_probability"] == 0.73