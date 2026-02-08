# Cookbook App Backend - Setup Instructions

A Node.js backend API for the Cookbook App with AI-powered recipe extraction and fridge inventory management.

## Prerequisites

- **Railway Account** ([Sign up here](https://railway.app))
- **Google Gemini API Key** ([Get one here](https://makersuite.google.com/app/apikey))
- **AWS S3 Bucket** (for image storage)
- **GitHub Account** (to connect your repo to Railway)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Push to GitHub

Make sure your code is on GitHub:

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

**Important:** Ensure `package-lock.json` is committed (remove it from `.gitignore` if present)

### 3. Deploy to Railway

1. Go to [Railway](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect the Dockerfile

### 4. Add PostgreSQL Database

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. The `DATABASE_URL` environment variable will be auto-added to your service

### 5. Add Redis

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"Add Redis"**
3. Railway will automatically create a Redis instance
4. The `REDIS_URL` environment variable will be auto-added to your service

### 6. Configure Environment Variables

In your Railway service settings, add these environment variables:

**Required Variables:**
```
NODE_ENV=production
JWT_SECRET=<generate-random-64-char-string>
REFRESH_TOKEN_SECRET=<generate-random-64-char-string>
GEMINI_API_KEY=your-gemini-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

**Generate JWT secrets** (run locally):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Note:** `DATABASE_URL` and `REDIS_URL` are automatically set by Railway when you add the databases.

### 7. Run Database Migrations

After deployment, run migrations in Railway:

1. Go to your service in Railway
2. Click on **"Settings"** → **"Deploy"**
3. Add a **"Custom Start Command"** (one-time):
   ```
   npm run migrate && node src/server.js
   ```

Or run manually in Railway's terminal:
```bash
npm run migrate
```

### 8. Deploy!

Railway will automatically deploy your app. Once deployed, you'll get a URL like:
```
https://your-app.up.railway.app
```

## Verify Deployment

### 1. Health Check

Replace `your-app.up.railway.app` with your actual Railway URL:

```bash
curl https://your-app.up.railway.app/health
```

Expected response:
```json
{
  "success": true,
  "message": "Cookbook API is running",
  "timestamp": "2026-02-07T...",
  "environment": "production"
}
```

### 2. Register a Test User

```bash
curl -X POST https://your-app.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!",
    "name": "Test User"
  }'
```

Save the `token` from the response!

### 3. Test Authentication

```bash
curl https://your-app.up.railway.app/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Scanning
- `POST /api/scan/cookbook` - Scan cookbook page (multipart/form-data)
- `POST /api/scan/fridge` - Scan fridge contents (multipart/form-data)

### Cookbooks
- `GET /api/cookbooks` - List all cookbooks
- `GET /api/cookbook/:id` - Get cookbook details
- `GET /api/cookbook/:id/recipes` - Get cookbook recipes
- `PUT /api/cookbook/:id` - Update cookbook
- `DELETE /api/cookbook/:id` - Delete cookbook

### Recipes
- `GET /api/recipe/:id` - Get recipe details
- `POST /api/recipes/match` - Match recipes with fridge ingredients

### Fridge Inventory
- `GET /api/fridge/inventory` - Get fridge inventory
- `POST /api/fridge/inventory` - Add items manually
- `PUT /api/fridge/item/:id` - Update item
- `DELETE /api/fridge/item/:id` - Delete item
- `DELETE /api/fridge/inventory` - Clear entire inventory

## Example: Scan a Cookbook

```bash
curl -X POST http://localhost:3000/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/cookbook-page.jpg" \
  -F "cookbookName=Italian Classics"
```

## Example: Match Recipes

```bash
curl -X POST http://localhost:3000/api/recipes/match \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "minMatchPercentage": 75,
    "includePartialMatches": true
  }'
```

## Local Development (Optional)

If you want to run the app locally for development:

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Setup
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure
3. Create database: `createdb cookbook_db`
4. Run migrations: `npm run migrate`
5. Start server: `npm run dev`

The server will run at `http://localhost:3000`

## Troubleshooting

### Railway deployment fails with "npm ci" error
**Solution:** Make sure `package-lock.json` is committed to your repo
```bash
# Remove package-lock.json from .gitignore if present
# Then commit it
git add package-lock.json
git commit -m "Add package-lock.json"
git push origin main
```

### Database connection error on Railway
**Solution:** 
- Make sure you added PostgreSQL database in Railway
- The `DATABASE_URL` variable should be automatically set
- Check Railway logs for specific error messages

### Redis connection error on Railway
**Solution:**
- Make sure you added Redis in Railway
- The `REDIS_URL` variable should be automatically set
- Redis is optional for basic functionality

### Migrations not running
**Solution:**
- Run migrations manually in Railway's terminal
- Or use custom start command: `npm run migrate && node src/server.js`

### Environment variables not working
**Solution:**
- Check all required variables are set in Railway dashboard
- Variables are case-sensitive
- Redeploy after adding new variables

## Project Structure

```
src/
├── controllers/      # Request handlers
├── database/         # Database config and migrations
├── middleware/       # Express middleware
├── routes/           # API routes
├── services/         # Business logic (Gemini AI)
├── utils/            # Utilities (logger, Redis, S3)
└── server.js         # Main application
```

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI**: Google Gemini 1.5 Pro
- **Storage**: AWS S3
- **Auth**: JWT

## Features

- ✅ AI-powered recipe extraction from cookbook images
- ✅ Fridge inventory scanning and management
- ✅ Intelligent recipe matching algorithm
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Input validation
- ✅ Error handling
- ✅ Caching with Redis
- ✅ Image storage with S3
- ✅ Comprehensive logging

## License

MIT

## Support

For issues or questions, open an issue on GitHub.

---

**Built with ❤️ by Season Solutions**
