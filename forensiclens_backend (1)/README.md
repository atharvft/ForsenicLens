# ForensicLens AI Backend

## 🎯 Project Overview

ForensicLens AI is a forensic photo analysis web application that detects anomalies in photos and upscales/recreates them using advanced AI models, similar to forensic tools used by police and security agencies.

This is the backend API built with FastAPI, designed to run on Google Colab GPU for optimal performance.

### Key Features

- 📤 **Photo Upload & Management** - Secure photo upload with validation
- 🔍 **AI-Powered Anomaly Detection** - Detect tampering, splicing, and manipulations
- 🖼️ **Image Upscaling** - Enhance and upscale images while preserving details
- 🔐 **Authentication & Authorization** - JWT-based user authentication
- 💾 **PostgreSQL Database** - Robust data storage for users, photos, and results
- 🚀 **Google Colab GPU Integration** - Optimized for GPU-accelerated inference
- 🌐 **ngrok Deployment** - Easy tunnel setup for frontend integration

---

## 🏗️ Architecture

### Project Structure

```
forensiclens_backend/
├── app/
│   ├── api/
│   │   ├── endpoints/          # API route handlers
│   │   │   ├── auth.py         # Authentication endpoints
│   │   │   ├── photos.py       # Photo management endpoints
│   │   │   └── health.py       # Health check endpoints
│   │   ├── dependencies/       # Shared dependencies
│   │   │   └── auth.py         # Authentication dependencies
│   │   └── router.py           # Main API router
│   ├── core/
│   │   ├── config.py           # Application configuration
│   │   └── security.py         # Security utilities (JWT, passwords)
│   ├── db/
│   │   ├── base.py             # SQLAlchemy base
│   │   └── session.py          # Database session management
│   ├── models/                 # Database models (SQLAlchemy)
│   │   ├── user.py             # User model
│   │   ├── photo.py            # Photo model
│   │   └── processing_result.py # Processing result model
│   ├── schemas/                # Pydantic schemas (request/response)
│   │   ├── user.py             # User schemas
│   │   ├── photo.py            # Photo schemas
│   │   └── processing_result.py # Processing result schemas
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py     # Authentication service
│   │   ├── photo_service.py    # Photo management service
│   │   └── processing_service.py # AI processing orchestration
│   ├── ai_engine/              # AI model integration
│   │   ├── anomaly_detector.py # Anomaly detection model
│   │   └── upscaler.py         # Image upscaling model
│   ├── utils/
│   │   └── file_handler.py     # File upload/storage utilities
│   └── main.py                 # FastAPI application entry point
├── alembic/                    # Database migrations
├── uploads/                    # File storage
│   ├── original/               # Original uploaded photos
│   └── processed/              # Processed/upscaled photos
├── tests/                      # Test suite
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── alembic.ini                 # Alembic configuration
├── Dockerfile                  # Docker configuration
├── docker-compose.yml          # Docker Compose configuration
└── README.md                   # This file
```

### Module Responsibilities (5-Person Team)

1. **API Layer** (`app/api/`) - Define endpoints and handle requests
2. **Business Logic** (`app/services/`) - Implement core business logic
3. **AI Engine** (`app/ai_engine/`) - Integrate and run AI models
4. **Database** (`app/models/`, `app/db/`) - Data models and persistence
5. **Authentication & Security** (`app/core/security.py`, `app/api/dependencies/auth.py`) - User auth and security

---

## 🚀 Google Colab GPU Setup

### Prerequisites

1. **Google Account** - For Google Colab access
2. **VS Code** - Installed on your local machine
3. **ngrok Account** - For exposing the backend (free tier works)

### Step 1: Install VS Code Extension

1. Open VS Code
2. Go to Extensions (`Cmd/Ctrl + Shift + X`)
3. Search for: **Google Colab**
4. Install the extension: https://marketplace.visualstudio.com/items?itemName=Google.colab

### Step 2: Connect to Colab Runtime

1. Open or create a `.ipynb` notebook in VS Code
2. Click **Select Kernel** (top right)
3. Choose **Colab**
4. Sign in with your Google account
5. Select **GPU Runtime**:
   - Click on the runtime type selector
   - Choose **GPU** (not CPU or TPU)
   - This gives you ~10-100x faster inference for AI models

### Step 3: Setup Backend on Colab

Use the provided `forensiclens_colab.ipynb` notebook (see below) or run these commands in Colab:

```python
# Cell 1: Clone repository and install dependencies
!git clone <your-repo-url> /content/forensiclens_backend
%cd /content/forensiclens_backend
!pip install -r requirements.txt

# Cell 2: Setup environment variables
import os
os.environ['DATABASE_URL'] = 'postgresql://user:pass@host/db'
os.environ['SECRET_KEY'] = 'your-secret-key'
os.environ['NGROK_AUTH_TOKEN'] = 'your-ngrok-token'
os.environ['USE_GPU'] = 'True'

# Cell 3: Start the server with ngrok
!python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Cell 4: Start ngrok tunnel
from pyngrok import ngrok, conf
conf.get_default().auth_token = os.environ['NGROK_AUTH_TOKEN']
public_url = ngrok.connect(8000)
print(f"Backend URL: {public_url}")
```

### Step 4: Get ngrok Auth Token

1. Go to https://dashboard.ngrok.com/signup
2. Sign up for free account
3. Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
4. Add it to your `.env` file or Colab environment

---

## 💻 Local Development Setup

### Prerequisites

- Python 3.10+
- PostgreSQL 14+
- pip or conda

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd forensiclens_backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Setup PostgreSQL database**
   ```bash
   # Create database
   createdb forensiclens_db
   
   # Or using psql
   psql -U postgres
   CREATE DATABASE forensiclens_db;
   ```

5. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

7. **Start the server**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

8. **Access the API**
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

---

## 🐳 Docker Setup (Optional)

### Using Docker Compose

1. **Build and start services**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations**
   ```bash
   docker-compose exec api alembic upgrade head
   ```

3. **View logs**
   ```bash
   docker-compose logs -f api
   ```

4. **Stop services**
   ```bash
   docker-compose down
   ```

---

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=johndoe&password=securepassword123
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

### Photo Endpoints

#### Upload Photo
```http
POST /api/v1/photos/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <image_file>
```

#### Get User Photos
```http
GET /api/v1/photos/?skip=0&limit=10&status_filter=completed
Authorization: Bearer <access_token>
```

#### Process Photo
```http
POST /api/v1/photos/{photo_id}/process
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "detect_anomalies": true,
  "upscale": true,
  "upscale_factor": 2.0
}
```

#### Get Processing Status
```http
GET /api/v1/photos/{photo_id}/status
Authorization: Bearer <access_token>
```

#### Download Photo
```http
GET /api/v1/photos/{photo_id}/download?processed=true
Authorization: Bearer <access_token>
```

### Health Check Endpoints

#### Basic Health Check
```http
GET /api/v1/health/health
```

#### System Status (includes GPU info)
```http
GET /api/v1/health/status
```

---

## 🧪 Testing

### Run Tests
```bash
pytest tests/ -v
```

### Run Tests with Coverage
```bash
pytest tests/ --cov=app --cov-report=html
```

### Test Specific Module
```bash
pytest tests/test_auth.py -v
```

---

## 🤝 Team Collaboration Guidelines

### Git Workflow

1. **Branch Naming Convention**
   - Feature: `feature/feature-name`
   - Bugfix: `bugfix/bug-description`
   - Hotfix: `hotfix/issue-description`

2. **Commit Message Format**
   ```
   [TYPE] Short description
   
   Detailed description of changes
   ```
   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

3. **Pull Request Process**
   - Create feature branch from `main`
   - Make changes and commit
   - Push to remote and create PR
   - Request review from team members
   - Merge after approval

### Module Ownership

| Module | Owner | Responsibilities |
|--------|-------|------------------|
| API Routes | Person 1 | Endpoint definitions, request/response handling |
| Business Logic | Person 2 | Services, business rules, orchestration |
| AI Engine | Person 3 | Model integration, inference, GPU optimization |
| Database | Person 4 | Models, migrations, queries |
| Auth & Security | Person 5 | JWT, permissions, security |

### Development Workflow

1. **Daily Standup** - Share progress, blockers
2. **Code Review** - All PRs require 1 approval
3. **Testing** - Write tests for new features
4. **Documentation** - Update README and docstrings
5. **Integration** - Merge to `main` after testing

---

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options.

**Key Variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret (generate with `openssl rand -hex 32`)
- `CORS_ORIGINS` - Allowed frontend URLs
- `USE_GPU` - Enable GPU for AI models
- `NGROK_AUTH_TOKEN` - ngrok authentication token
- `NGROK_ENABLED` - Enable ngrok tunnel

### Database Configuration

PostgreSQL connection string format:
```
postgresql://username:password@host:port/database
```

Example:
```
DATABASE_URL=postgresql://forensiclens:password123@localhost:5432/forensiclens_db
```

### AI Model Configuration

Place your trained models in the `models/` directory:
- `models/anomaly_detector/` - Anomaly detection model
- `models/upscaler/` - Upscaling model

Update paths in `.env`:
```
ANOMALY_MODEL_PATH=models/anomaly_detector
UPSCALING_MODEL_PATH=models/upscaler
```

---

## 🚀 Deployment

### ngrok Deployment (Colab)

1. Get ngrok auth token
2. Set `NGROK_ENABLED=True` in `.env`
3. Set `NGROK_AUTH_TOKEN` in `.env`
4. Run the application
5. ngrok will print the public URL

### Production Deployment

For production, consider:

1. **Cloud Providers**
   - AWS EC2 with GPU (p2/p3 instances)
   - Google Cloud Compute Engine with GPU
   - Azure with GPU support

2. **Container Orchestration**
   - Kubernetes with GPU node pools
   - Docker Swarm

3. **Database**
   - Managed PostgreSQL (AWS RDS, Google Cloud SQL)
   - Connection pooling
   - Backup strategy

4. **Security**
   - HTTPS/TLS certificates
   - Strong JWT secret keys
   - Rate limiting
   - Input validation
   - SQL injection prevention (SQLAlchemy ORM)

5. **Monitoring**
   - Logging (ELK stack, CloudWatch)
   - Error tracking (Sentry)
   - Performance monitoring (New Relic, DataDog)

---

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Error**
```
sqlalchemy.exc.OperationalError: could not connect to server
```
**Solution:** Check PostgreSQL is running and DATABASE_URL is correct

**2. GPU Not Available**
```
GPU available: False
```
**Solution:** Ensure you selected GPU runtime in Colab, or install CUDA locally

**3. Module Import Error**
```
ModuleNotFoundError: No module named 'app'
```
**Solution:** Run from project root directory, check PYTHONPATH

**4. JWT Token Error**
```
Could not validate credentials
```
**Solution:** Check SECRET_KEY is set correctly, token not expired

**5. File Upload Error**
```
File size exceeds maximum allowed size
```
**Solution:** Adjust MAX_UPLOAD_SIZE in configuration

---

## 📝 AI Team Integration Guide

### Anomaly Detector Integration

File: `app/ai_engine/anomaly_detector.py`

**What to implement:**

1. **Model Loading** (`_load_model` method)
   ```python
   def _load_model(self):
       self.model = YourAnomalyModel.load(self.model_path)
       self.model.to(self.device)
       self.model.eval()
   ```

2. **Preprocessing** (`preprocess_image` method)
   ```python
   def preprocess_image(self, image: Image.Image) -> torch.Tensor:
       # Your preprocessing pipeline
       # Resize, normalize, convert to tensor, etc.
       pass
   ```

3. **Inference** (`detect` method)
   ```python
   def detect(self, image_path: str) -> Dict:
       # Run model inference
       # Return detection results
       pass
   ```

**Expected Output Format:**
```python
{
    "has_anomalies": bool,
    "anomaly_score": float (0.0 to 1.0),
    "anomaly_details": {
        "model_version": str,
        "detection_types": List[str],
        "confidence": float
    },
    "anomaly_regions": [
        {
            "x": int,
            "y": int,
            "width": int,
            "height": int,
            "confidence": float,
            "anomaly_type": str
        }
    ]
}
```

### Upscaler Integration

File: `app/ai_engine/upscaler.py`

**What to implement:**

1. **Model Loading** (`_load_model` method)
2. **Preprocessing** (`preprocess_image` method)
3. **Postprocessing** (`postprocess_output` method)
4. **Upscaling** (`upscale` method)

**Expected Output:**
- Save upscaled image to `output_path`
- Return tuple: `(output_path, width, height)`

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test
4. Submit pull request

---

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Contact team lead
- Check documentation at `/docs`

---

**Built with ❤️ by the ForensicLens AI Team**
