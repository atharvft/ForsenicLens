#!/bin/bash
# ForensicLens AI Backend - Run Script

set -e

echo "🚀 Starting ForensicLens AI Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration!"
    exit 1
fi

# Create upload directories
echo "📁 Creating upload directories..."
mkdir -p uploads/original uploads/processed models

# Run migrations
echo "🗄️  Running database migrations..."
alembic upgrade head

# Start the server
echo "✅ Starting FastAPI server..."
echo ""
echo "📡 Server will be available at:"
echo "   - API: http://localhost:8000"
echo "   - Docs: http://localhost:8000/docs"
echo "   - ReDoc: http://localhost:8000/redoc"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
