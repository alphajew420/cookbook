# Cookbook App - Backend Setup Guide

Complete setup instructions for deploying and running the Cookbook App backend API.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Running Migrations](#running-migrations)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

Before setting up the backend, ensure you have:

- **Node.js** v18.x or higher
- **PostgreSQL** v14 or higher
- **Redis** v6 or higher
- **AWS Account** (for S3 image storage)
- **Google AI Studio Account** (for Gemini API)

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@host:port/database_name
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis (for job queue and caching)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_URL=redis://:password@host:port

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret-key
REFRESH_TOKEN_EXPIRATION=7d

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro

# AWS S3 (for image storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SCAN_COOKBOOK_LIMIT=10
SCAN_FRIDGE_LIMIT=10

# Image Upload
MAX_IMAGE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/jpg

# Logging
LOG_LEVEL=info

# CORS (comma-separated list of allowed origins)
CORS_ORIGIN=https://your-frontend-domain.com,https://your-app.com
```

### Getting API Keys

#### Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste into `GEMINI_API_KEY`

#### AWS S3 Setup
1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 permissions
3. Generate access keys
4. Update `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `S3_BUCKET_NAME`

## 🗄️ Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE cookbook_app;

# Create user (optional)
CREATE USER cookbook_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cookbook_app TO cookbook_user;
```

### 2. Run Initial Schema

```bash
# From the project root
psql -U your_user -d cookbook_app -f src/database/schema.sql
```

### 3. Run Additional Migrations

```bash
# Scan jobs table
psql -U your_user -d cookbook_app -f src/database/add_scan_jobs.sql

# Fridge scan history
psql -U your_user -d cookbook_app -f src/database/add_scan_job_id_to_fridge_items.sql

# Recipe matching feature
psql -U your_user -d cookbook_app -f src/database/add_match_tables.sql
```

**OR** use the browser-based migration endpoints after deployment:
- `https://your-domain.com/migrate-fridge-scan-history`
- `https://your-domain.com/migrate-recipe-matching`

## 💻 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Local Environment

Create `.env` file with local configuration (see Environment Variables section above).

### 3. Start Redis (if running locally)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install Redis locally
redis-server
```

### 4. Start Development Server

```bash
# Start API server
npm run dev

# In a separate terminal, start worker processes
node src/workers/scanWorker.js
```

The API will be available at `http://localhost:3000`

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

## 🚀 Production Deployment

### Recommended Platforms

- **Render.com** (recommended for easy setup)
- **Railway.app**
- **Heroku**
- **AWS ECS/Fargate**
- **DigitalOcean App Platform**

### Deployment Steps (Render.com Example)

1. **Create Web Service**
   - Connect your GitHub repository
   - Build Command: `npm install`
   - Start Command: `npm start`

2. **Create Background Worker**
   - Same repository
   - Build Command: `npm install`
   - Start Command: `node src/workers/scanWorker.js`

3. **Add PostgreSQL Database**
   - Create PostgreSQL instance
   - Copy `DATABASE_URL` to environment variables

4. **Add Redis Instance**
   - Create Redis instance
   - Copy connection details to environment variables

5. **Configure Environment Variables**
   - Add all variables from `.env` template
   - Set `NODE_ENV=production`

6. **Deploy**
   - Push to main branch
   - Render will auto-deploy

### Post-Deployment

1. **Run Migrations**
   - Visit `https://your-domain.com/migrate-fridge-scan-history`
   - Visit `https://your-domain.com/migrate-recipe-matching`

2. **Verify Health**
   - Check `https://your-domain.com/health`

3. **Test Authentication**
   - Register a test user via `/api/auth/register`

## 🔄 Running Migrations

### Option 1: Browser-Based (Easiest)

After deployment, open these URLs in your browser:

```
https://your-domain.com/migrate-fridge-scan-history
https://your-domain.com/migrate-recipe-matching
```

### Option 2: SQL Files

```bash
# Connect to production database
psql $DATABASE_URL

# Run migrations
\i src/database/add_scan_job_id_to_fridge_items.sql
\i src/database/add_match_tables.sql
```

## 📚 API Documentation

### Base URL
```
Production: https://your-domain.com
Local: http://localhost:3000
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Main Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

#### Cookbook Scanning
- `POST /api/scan/cookbook` - Scan cookbook pages
- `GET /api/scan/jobs` - List scan jobs
- `GET /api/scan/jobs/:jobId` - Get scan job details

#### Fridge Scanning
- `POST /api/scan/fridge` - Scan fridge contents
- `GET /api/scan/jobs/:jobId/items` - Get items from fridge scan

#### Cookbooks & Recipes
- `GET /api/cookbooks` - List user's cookbooks
- `GET /api/cookbooks/:id` - Get cookbook details
- `GET /api/cookbooks/:id/recipes` - Get cookbook recipes
- `GET /api/recipes/:id` - Get recipe details

#### Fridge Inventory
- `GET /api/fridge` - Get fridge inventory
- `POST /api/fridge` - Add fridge items manually
- `PUT /api/fridge/:id` - Update fridge item
- `DELETE /api/fridge/:id` - Delete fridge item

#### Recipe Matching
- `POST /api/matches` - Create match job
- `GET /api/matches` - List match jobs
- `GET /api/matches/:matchId` - Get match job details
- `GET /api/matches/:matchId/results` - Get match results
- `DELETE /api/matches/:matchId` - Delete match job

### Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "timestamp": "2026-02-13T00:00:00.000Z"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Column does not exist" errors
**Solution:** Run the database migrations (see Running Migrations section)

#### 2. CORS errors from mobile app
**Solution:** The backend now allows Expo tunnel domains and requests with no origin. Ensure `NODE_ENV=development` for local testing or add your domain to `CORS_ORIGIN`.

#### 3. 400 Bad Request on registration
**Causes:**
- Missing `Content-Type: application/json` header
- Password less than 8 characters
- Invalid email format
- Missing required fields

**Solution:** Ensure your request includes:
```javascript
headers: {
  'Content-Type': 'application/json'
},
body: JSON.stringify({
  email: 'user@example.com',
  password: 'password123', // 8+ characters
  name: 'John Doe' // optional
})
```

#### 4. Jobs stuck in "pending" status
**Solution:** Ensure the worker process is running:
```bash
node src/workers/scanWorker.js
```

#### 5. Redis connection errors
**Solution:** 
- Verify Redis is running
- Check `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` are correct
- Test connection: `redis-cli -h your-host -p 6379 -a your-password ping`

#### 6. S3 upload failures
**Solution:**
- Verify AWS credentials are correct
- Check S3 bucket permissions
- Ensure bucket exists and is in the correct region

### Logs

Check application logs for detailed error messages:

```bash
# Local development
npm run dev

# Production (Render.com)
# View logs in Render dashboard

# Production (manual)
pm2 logs
```

## 🔒 Security Checklist

Before going to production:

- [ ] Change all default secrets in `.env`
- [ ] Use strong, unique JWT secrets (32+ characters)
- [ ] Enable HTTPS/SSL on your domain
- [ ] Set appropriate CORS origins (don't use `*` in production)
- [ ] Configure rate limiting appropriately
- [ ] Set up database backups
- [ ] Enable Redis password authentication
- [ ] Review and restrict S3 bucket permissions
- [ ] Set `NODE_ENV=production`
- [ ] Monitor logs for suspicious activity

## 📞 Support

For issues or questions:
- Check logs for detailed error messages
- Review this setup guide
- Verify all environment variables are set correctly
- Ensure all migrations have been run

## 🎉 You're Ready!

Your Cookbook App backend is now set up and ready to use. The API supports:
- ✅ User authentication
- ✅ Cookbook scanning with AI
- ✅ Fridge inventory scanning
- ✅ Recipe matching against fridge contents
- ✅ Async job processing
- ✅ Image storage in S3
- ✅ Mobile app support (React Native/Expo)
