# Contributing to ForensicLens AI Backend

Thank you for contributing to ForensicLens AI! This guide will help you get started.

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test your changes
6. Submit a pull request

## 📋 Development Setup

### Prerequisites
- Python 3.10+
- PostgreSQL 14+
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/forensiclens_backend.git
cd forensiclens_backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

## 🌿 Branch Naming Convention

- **Feature:** `feature/description-of-feature`
- **Bugfix:** `bugfix/description-of-bug`
- **Hotfix:** `hotfix/critical-issue`
- **Docs:** `docs/description-of-changes`
- **Refactor:** `refactor/description-of-refactor`

Examples:
- `feature/add-face-detection`
- `bugfix/fix-upload-validation`
- `docs/update-api-documentation`

## 💬 Commit Message Format

Use the following format for commit messages:

```
[TYPE] Short description (max 50 chars)

Detailed description of what changed and why.
Wrap at 72 characters.

Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
[feat] Add anomaly detection endpoint

Implemented POST /api/v1/photos/{id}/detect endpoint
that processes photos using the anomaly detection model.
Includes request validation and error handling.

Fixes #45
```

```
[fix] Resolve file upload size validation

Fixed issue where files larger than MAX_UPLOAD_SIZE
were not being rejected properly.

Fixes #67
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v

# Run specific test
pytest tests/test_auth.py::test_user_registration -v
```

### Writing Tests

- Place tests in `tests/` directory
- Name test files with `test_` prefix
- Name test functions with `test_` prefix
- Use descriptive test names
- Include docstrings
- Test both success and failure cases

**Example:**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_user_registration_success():
    """Test successful user registration"""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "securepassword123"
        }
    )
    assert response.status_code == 201
    assert "id" in response.json()

def test_user_registration_duplicate_email():
    """Test registration with duplicate email"""
    # First registration
    client.post(...)
    
    # Duplicate registration
    response = client.post(...)
    assert response.status_code == 400
```

## 📝 Code Style

### Python Style Guide

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use 4 spaces for indentation
- Maximum line length: 100 characters
- Use type hints
- Write docstrings for all functions/classes

### Docstring Format

Use Google-style docstrings:

```python
def process_photo(photo_id: int, config: ProcessConfig) -> ProcessResult:
    """Process a photo with AI models.
    
    Args:
        photo_id: ID of the photo to process
        config: Processing configuration
        
    Returns:
        Processing result with anomaly detection and upscaling info
        
    Raises:
        HTTPException: If photo not found or processing fails
    """
    pass
```

### Code Formatting

We recommend using:
- **Black** for code formatting
- **isort** for import sorting
- **flake8** for linting

```bash
# Install tools
pip install black isort flake8

# Format code
black app/
isort app/

# Check linting
flake8 app/
```

## 🔍 Code Review Process

### Before Submitting PR

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Added tests for new features
- [ ] Updated documentation
- [ ] No merge conflicts
- [ ] Commit messages follow format

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
Describe how you tested these changes.

## Screenshots (if applicable)

## Related Issues
Fixes #123
```

### Review Criteria

1. **Functionality** - Does it work as intended?
2. **Code Quality** - Is it clean and maintainable?
3. **Tests** - Are there adequate tests?
4. **Documentation** - Is it well documented?
5. **Performance** - Any performance concerns?
6. **Security** - Any security issues?

## 📦 Module Responsibilities

### API Layer (`app/api/`)
**Owner:** Team Member 1
- Define API endpoints
- Handle request/response validation
- Error handling
- API documentation

### Business Logic (`app/services/`)
**Owner:** Team Member 2
- Implement core business logic
- Orchestrate between layers
- Data validation and transformation

### AI Engine (`app/ai_engine/`)
**Owner:** Team Member 3
- AI model integration
- Model inference optimization
- GPU utilization
- Batch processing

### Database (`app/models/`, `app/db/`)
**Owner:** Team Member 4
- Database models
- Migrations
- Query optimization
- Data integrity

### Security (`app/core/security.py`, `app/api/dependencies/auth.py`)
**Owner:** Team Member 5
- Authentication
- Authorization
- JWT handling
- Security best practices

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description** - Clear description of the bug
2. **Steps to Reproduce** - How to reproduce the issue
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment** - OS, Python version, etc.
6. **Screenshots/Logs** - If applicable

## 💡 Feature Requests

When requesting features, please include:

1. **Problem** - What problem does this solve?
2. **Proposed Solution** - How should it work?
3. **Alternatives** - Other solutions considered
4. **Additional Context** - Any other relevant info

## 📞 Getting Help

- Check existing issues
- Read the documentation
- Ask in team chat
- Create a new issue with `[QUESTION]` tag

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Give constructive feedback
- Focus on what's best for the project

---

**Thank you for contributing to ForensicLens AI!** 🙏
