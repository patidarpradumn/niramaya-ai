# MediGuard AI ML Engine - Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application directories
COPY data/ ./data/
COPY models/ ./models/
COPY src/ ./src/
COPY api/ ./api/
COPY README.md .

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/v1/health || exit 1

# Launch FastAPI server
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
