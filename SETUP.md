# Cookbook App Backend - Setup Guide

This guide will walk you through setting up the Cookbook App backend from scratch.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] PostgreSQL 14+ installed and running
- [ ] Redis 7+ installed and running
- [ ] AWS account (for S3 storage)
- [ ] Google Gemini API key

## Step-by-Step Setup

### 1. Install Node.js Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js (web framework)
- PostgreSQL client
- Redis client
- Google Gemini AI SDK
- AWS SDK
- And more...

### 2. Set Up PostgreSQL Database

#### Install PostgreSQL (if not already installed)

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE cookbook_db;

# Create user (optional)
CREATE USER cookbook_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cookbook_db TO cookbook_user;

# Exit
\q
```

#### Run Migrations

```bash
npm run migrate
```

This will create all necessary tables, indexes, and triggers.

### 3. Set Up Redis

#### Install Redis

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Windows:**
Download from [redis.io](https://redis.io/download) or use WSL

#### Test Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 4. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key

**Important:** Keep this key secure and never commit it to version control.

### 5. Set Up AWS S3

#### Create S3 Bucket

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to S3
3. Click "Create bucket"
4. Choose a unique bucket name (e.g., `cookbook-app-images-prod`)
5. Select your preferred region
6. Keep default settings for now
7. Click "Create bucket"

#### Create IAM User for API Access

1. Navigate to IAM in AWS Console
2. Click "Users" → "Add users"
3. User name: `cookbook-api`
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"
6. Click "Attach existing policies directly"
7. Search for and select `AmazonS3FullAccess`
8. Click through to create user
9. **Save the Access Key ID and Secret Access Key** (you won't see them again!)

#### Configure S3 Bucket Policy (Optional - for private images)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAPIAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/cookbook-api"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 6. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=postgresql://cookbook_user:your_password@localhost:5432/cookbook_db
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT Configuration (generate strong secrets!)
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
JWT_EXPIRATION=1h
REFRESH_TOKEN_SECRET=your_super_secret_refresh_token_key
REFRESH_TOKEN_EXPIRATION=7d

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-pro

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
SCAN_COOKBOOK_LIMIT=10
SCAN_FRIDGE_LIMIT=20

# Image Upload
MAX_IMAGE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/jpg

# Logging
LOG_LEVEL=info

# CORS (add your frontend URLs)
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

### 7. Generate Secure JWT Secrets

Use Node.js to generate secure random strings:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this twice and use the outputs for `JWT_SECRET` and `REFRESH_TOKEN_SECRET`.

### 8. Test the Setup

#### Start the server

```bash
npm run dev
```

You should see:

```
🚀 Server running on port 3000
📚 Environment: development
🔗 API Base URL: http://localhost:3000
✅ Health check: http://localhost:3000/health
```

#### Test the health endpoint

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "success": true,
  "message": "Cookbook API is running",
  "timestamp": "2024-01-20T15:45:00.000Z",
  "environment": "development"
}
```

#### Test user registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testPassword123",
    "name": "Test User"
  }'
```

If successful, you'll receive a JWT token!

### 9. Verify Database Tables

Connect to your database and verify tables were created:

```bash
psql cookbook_db

# List all tables
\dt

# You should see:
# - users
# - cookbooks
# - recipes
# - ingredients
# - instructions
# - fridge_items
# - scan_history
```

### 10. Verify Redis Connection

```bash
redis-cli

# Check if any keys exist
KEYS *

# Should return empty array initially: (empty array)
```

## Common Issues and Solutions

### Issue: "Cannot connect to database"

**Solution:**
- Verify PostgreSQL is running: `pg_isready`
- Check your DATABASE_URL in `.env`
- Ensure the database exists: `psql -l`

### Issue: "Redis connection refused"

**Solution:**
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in `.env`
- Start Redis: `brew services start redis` (macOS) or `sudo systemctl start redis` (Linux)

### Issue: "Gemini API error"

**Solution:**
- Verify your API key is correct
- Check you have API access enabled
- Ensure you're not hitting rate limits

### Issue: "S3 upload failed"

**Solution:**
- Verify AWS credentials are correct
- Check bucket name is correct
- Ensure IAM user has S3 permissions
- Verify bucket region matches AWS_REGION

### Issue: "Port 3000 already in use"

**Solution:**
- Change PORT in `.env` to a different port (e.g., 3001)
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill`

## Development Tips

### Using Nodemon for Auto-Reload

The `npm run dev` command uses nodemon to automatically restart the server when files change.

### Viewing Logs

Logs are written to:
- Console (colored output)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

Tail logs in real-time:

```bash
tail -f logs/combined.log
```

### Testing with Postman

1. Import the API endpoints into Postman
2. Create an environment with your base URL
3. Use the register/login endpoints to get a JWT token
4. Add the token to Authorization header for protected routes

### Database Migrations

If you make changes to the schema:

1. Update `src/database/schema.sql`
2. Run migrations: `npm run migrate`

**Warning:** This will drop and recreate all tables in development!

## Next Steps

1. **Test all endpoints** - Use Postman or curl to test each endpoint
2. **Upload a test image** - Try scanning a cookbook page
3. **Set up monitoring** - Consider adding Sentry or similar
4. **Configure production environment** - Set up production database and Redis
5. **Deploy** - Deploy to your hosting platform (AWS, Heroku, DigitalOcean, etc.)

## Production Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique JWT secrets
- [ ] Set up production PostgreSQL database
- [ ] Set up production Redis instance
- [ ] Configure production S3 bucket
- [ ] Set appropriate CORS origins
- [ ] Enable SSL/TLS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Review and adjust rate limits
- [ ] Set up domain and DNS
- [ ] Configure environment variables on hosting platform

## Support

If you encounter issues:

1. Check the logs in `logs/` directory
2. Review this setup guide
3. Check the main README.md
4. Create an issue on GitHub

---

**Happy Coding! 🚀**
