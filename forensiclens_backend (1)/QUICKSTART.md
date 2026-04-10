# ForensicLens AI Backend - Quick Start Guide

## 🚀 5-Minute Setup

### Option 1: Google Colab GPU (Recommended for Hackathon)

1. **Open the Colab Notebook**
   - Upload `forensiclens_colab.ipynb` to Google Colab
   - Or open directly in VS Code with Google Colab extension

2. **Set Runtime to GPU**
   - Runtime → Change runtime type → GPU
   
3. **Update Environment Variables** (Cell 3)
   ```python
   # Update these values:
   os.environ['DATABASE_URL'] = 'your-postgres-url'
   os.environ['SECRET_KEY'] = 'generate-with-openssl-rand-hex-32'
   os.environ['NGROK_AUTH_TOKEN'] = 'get-from-ngrok-dashboard'
   ```

4. **Run All Cells**
   - Cell → Run all
   - Copy the ngrok URL that appears
   - Use this URL in your Next.js frontend

**That's it!** Your backend is running on GPU! 🎉

---

### Option 2: Local Development

```bash
# 1. Clone repository
git clone <your-repo-url>
cd forensiclens_backend

# 2. Run the setup script
chmod +x run.sh
./run.sh

# 3. Update .env file
# Edit .env with your database and configuration

# 4. Access the API
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

---

### Option 3: Docker (Easiest Local Setup)

```bash
# Start everything (backend + database)
docker-compose up -d

# Run migrations
docker-compose exec api alembic upgrade head

# Access the API
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
# pgAdmin: http://localhost:5050
```

---

## 🔑 Quick Configuration

### 1. Get ngrok Token
- Go to: https://dashboard.ngrok.com/get-started/your-authtoken
- Copy your auth token
- Add to `.env`: `NGROK_AUTH_TOKEN=your-token`

### 2. Generate JWT Secret
```bash
openssl rand -hex 32
```
Add to `.env`: `SECRET_KEY=generated-key`

### 3. Setup PostgreSQL
```bash
# Local PostgreSQL
createdb forensiclens_db

# Or use connection string in .env
DATABASE_URL=postgresql://user:pass@host:5432/forensiclens_db
```

---

## 🧪 Quick Test

### Test Health Endpoint
```bash
curl http://localhost:8000/api/v1/health/health
```

### Register a User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=password123"
```

### Upload Photo (with token)
```bash
curl -X POST http://localhost:8000/api/v1/photos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@image.jpg"
```

---

## 📋 Team Workflow

### 1. Module Assignments

| Team Member | Module | Files to Work On |
|------------|--------|------------------|
| Person 1 | API Routes | `app/api/endpoints/*.py` |
| Person 2 | Business Logic | `app/services/*.py` |
| Person 3 | AI Models | `app/ai_engine/*.py` |
| Person 4 | Database | `app/models/*.py`, `alembic/versions/` |
| Person 5 | Auth & Security | `app/core/security.py`, `app/api/dependencies/auth.py` |

### 2. Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Make changes
# ... edit files ...

# 4. Test locally
pytest tests/ -v

# 5. Commit and push
git add .
git commit -m "[feat] Your feature description"
git push origin feature/your-feature

# 6. Create Pull Request
# Go to GitHub and create PR
```

### 3. AI Team Integration

**File to implement:** `app/ai_engine/anomaly_detector.py` and `app/ai_engine/upscaler.py`

Key methods to implement:
1. `_load_model()` - Load your trained models
2. `preprocess_image()` - Prepare images for inference
3. `detect()` or `upscale()` - Run inference
4. Return results in the expected format (see docstrings)

**Test your implementation:**
```python
from app.ai_engine.anomaly_detector import get_anomaly_detector

detector = get_anomaly_detector()
result = detector.detect("path/to/image.jpg")
print(result)
```

---

## 🐛 Common Issues

### Issue: Database connection error
**Solution:**
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:pass@localhost:5432/forensiclens_db
```

### Issue: GPU not available in Colab
**Solution:**
1. Runtime → Change runtime type → GPU
2. Restart runtime
3. Re-run cells

### Issue: Import errors
**Solution:**
```bash
# Run from project root
cd /path/to/forensiclens_backend
python -m app.main
```

### Issue: Module not found
**Solution:**
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

---

## 📚 Important Files

| File | Purpose |
|------|---------|
| `README.md` | Complete documentation |
| `CONTRIBUTING.md` | Contribution guidelines |
| `QUICKSTART.md` | This file - quick setup |
| `.env.example` | Environment variables template |
| `requirements.txt` | Python dependencies |
| `forensiclens_colab.ipynb` | Colab notebook |
| `docker-compose.yml` | Docker setup |
| `run.sh` | Local development script |

---

## 🔗 Important URLs

### When Running Locally
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/api/v1/health/health

### When Running on Colab
- Use the ngrok URL printed in the notebook
- Example: https://abc123.ngrok.io

### External Resources
- ngrok Dashboard: https://dashboard.ngrok.com
- FastAPI Docs: https://fastapi.tiangolo.com
- SQLAlchemy Docs: https://docs.sqlalchemy.org
- PyTorch Docs: https://pytorch.org/docs

---

## 💡 Pro Tips

1. **Use the API Docs**: Visit `/docs` to test endpoints interactively
2. **Check Logs**: Look at terminal output for errors and debugging info
3. **GPU Status**: Visit `/api/v1/health/status` to check GPU availability
4. **Hot Reload**: Use `--reload` flag for automatic code reloading during development
5. **Database GUI**: Use pgAdmin (included in docker-compose) to view database

---

## 🆘 Need Help?

1. Check the README.md for detailed documentation
2. Check CONTRIBUTING.md for development guidelines
3. Look at existing code for examples
4. Ask your team members
5. Check FastAPI documentation

---

## ✅ Pre-Deployment Checklist

Before deploying or presenting:

- [ ] All team members can run the backend locally
- [ ] Database migrations are up to date
- [ ] Environment variables are configured
- [ ] API endpoints are tested and working
- [ ] AI models are integrated (or placeholder works)
- [ ] ngrok tunnel is working (for Colab)
- [ ] Frontend can connect to backend
- [ ] Documentation is updated
- [ ] Code is committed and pushed

---

**Good luck with your hackathon! 🚀**
