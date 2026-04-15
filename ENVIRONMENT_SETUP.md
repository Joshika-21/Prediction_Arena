# Prediction Arena — Environment Setup Guide

## Azure Services (Already deployed by Cloud/DevOps)

### Live Service URLs
- Prediction API: https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io
- Scoring Service: https://scoring-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io
- Leaderboard Service: https://leaderboard-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io

### Cosmos DB
- COSMOS_ENDPOINT=https://prediction-arena-db.documents.azure.com:443/
- COSMOS_DATABASE_NAME=PredictionArenaDB
- COSMOS_PREDICTIONS_CONTAINER=predictions
- COSMOS_SCORES_CONTAINER=scores

### Service Bus
- Namespace: prediction-arena-bus.servicebus.windows.net
- Queue 1: predictions-queue
- Queue 2: scores-updated

### Container Registry
- Registry: predictionarenaregistry.azurecr.io

## Local Development Setup

### For Python services (prediction, scoring):
Create a .env file in your service folder with these variables.
Contact the Cloud/DevOps member for the actual key values.

### For C# services (leaderboard):
Add connection strings to appsettings.Development.json.
Contact the Cloud/DevOps member for the actual key values.

## Notes
- Never commit .env files or connection strings to GitHub
- All secrets are stored in GitHub Actions secrets for CI/CD
