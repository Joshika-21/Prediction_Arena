# Dockerfile — Packages the scoring Azure Function into a Docker container
#
# WHY THIS FILE EXISTS:
#   Azure Container Apps runs services as Docker containers. This file tells
#   Docker how to build an image for the scoring service so it can be deployed
#   to Azure — just like the prediction service already has its own Dockerfile.
#
# WHY A DIFFERENT BASE IMAGE THAN THE PREDICTION SERVICE:
#   The prediction service uses "python:3.11-slim" (plain Python + FastAPI).
#   This service uses Microsoft's official Azure Functions base image because
#   Azure Functions needs extra runtime components (the Functions host, worker
#   process, binding extensions) that aren't in plain Python images.
#
# HOW THIS GETS USED:
#   Locally:  docker build -t scoring-service .
#             docker run -p 7071:80 scoring-service
#   In CI/CD: The GitHub Actions workflow builds and pushes this to Azure
#             Container Registry, then deploys to Azure Container Apps.

# ── Base image ────────────────────────────────────────────────────────────────
# Microsoft's official Azure Functions image with Python 3.11.
# "4" = Azure Functions runtime version 4 (matches our host.json "version": "2.0")
# Always use a specific Python version — never "latest" which changes over time.
FROM mcr.microsoft.com/azure-functions/python:4-python3.11

# ── Environment variables ─────────────────────────────────────────────────────
# WHY AzureWebJobsScriptRoot:
#   Tells the Azure Functions host where to find function_app.py.
#   Must point to the directory containing host.json and function_app.py.
#
# WHY AzureFunctionsJobHost__Logging__Console__IsEnabled:
#   Enables log output to the container's stdout/stderr, which Azure Container
#   Apps collects and shows in the Azure Portal logs. Without this you'd see
#   no logs at all when deployed.
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# ── Install dependencies ───────────────────────────────────────────────────────
# WHY COPY requirements.txt FIRST (before copying the rest of the code):
#   Docker builds in layers and caches each layer. If we copy all files first,
#   ANY code change forces a full pip install reinstall even if requirements.txt
#   didn't change. Copying requirements.txt first means pip only re-runs when
#   the dependencies actually change — much faster rebuilds.
COPY requirements.txt /home/site/wwwroot/requirements.txt

RUN cd /home/site/wwwroot && pip install --no-cache-dir -r requirements.txt
#   --no-cache-dir: Don't cache downloaded packages inside the image.
#   This keeps the image smaller — important for faster deployments.

# ── Copy application code ─────────────────────────────────────────────────────
# WHY COPY . LAST:
#   Code changes frequently during development. Copying it last means Docker
#   reuses the cached pip install layer and only rebuilds from this point,
#   making iterative development much faster.
#
# This copies: function_app.py, brier.py, host.json
# It does NOT copy: local.settings.json (listed in .dockerignore / .gitignore)
# because secrets must never be baked into a Docker image.
COPY . /home/site/wwwroot

# ── Port ──────────────────────────────────────────────────────────────────────
# WHY 80 (not 8000 like the prediction service):
#   The Azure Functions base image is pre-configured to listen on port 80.
#   When running locally with 'func start', it uses port 7071 instead —
#   that's handled by the Functions Core Tools, not Docker.
EXPOSE 80