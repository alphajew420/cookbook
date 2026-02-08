# Quick Start Guide

Get the Cookbook App backend running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running locally
- Redis running locally

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Minimum required configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/cookbook_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars
GEMINI_API_KEY=your-gemini-api-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET_NAME=your-bucket-name
```

### 3. Create Database

```bash
# Using psql
createdb cookbook_db

# Or using SQL
psql postgres -c "CREATE DATABASE cookbook_db;"
```

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Start the Server

```bash
npm run dev
```

You should see:

```
🚀 Server running on port 3000
📚 Environment: development
✅ Health check: http://localhost:3000/health
```

## Test the API

### 1. Check Health

```bash
curl http://localhost:3000/health
```

### 2. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "name": "Test User"
  }'
```

Save the `token` from the response!

### 3. Scan a Cookbook (with your token)

```bash
curl -X POST http://localhost:3000/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "image=@/path/to/cookbook-page.jpg" \
  -F "cookbookName=My First Cookbook"
```

## Next Steps

- Read the full [README.md](README.md)
- Check [API_EXAMPLES.md](API_EXAMPLES.md) for more examples
- See [SETUP.md](SETUP.md) for detailed setup
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env`

### "Redis connection refused"
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL in `.env`

### "Port 3000 already in use"
- Change PORT in `.env` to a different port

## Getting Help

- Check the documentation
- Open an issue on GitHub
- Contact support@cookbookapp.com

---

**Happy coding! 🚀**
