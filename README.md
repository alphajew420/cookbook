# Cookbook App - Backend API

A powerful Node.js backend API for the Cookbook App, featuring AI-powered recipe extraction from cookbook images and intelligent fridge inventory management using Google Gemini AI.

## 🚀 Features

- **AI-Powered Recipe Extraction**: Scan cookbook pages and automatically extract recipes, ingredients, and instructions using Google Gemini Vision API
- **Fridge Inventory Management**: Scan your fridge to identify and catalog food items
- **Intelligent Recipe Matching**: Find recipes you can make with available ingredients
- **User Authentication**: Secure JWT-based authentication
- **Cloud Storage**: Image storage using AWS S3
- **Caching**: Redis-based caching for optimal performance
- **Rate Limiting**: Protect API from abuse
- **Comprehensive Error Handling**: Detailed error responses with proper HTTP status codes

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 7+
- AWS S3 account (or compatible storage)
- Google Gemini API key

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd cookbook-app-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cookbook_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_secure_secret_key_here
JWT_EXPIRATION=1h

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=cookbook-app-images
```

### 4. Set up the database

Create a PostgreSQL database:

```bash
createdb cookbook_db
```

Run migrations:

```bash
npm run migrate
```

### 5. Start the server

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## 📚 API Documentation

### Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Endpoints

#### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/profile` - Get current user profile

#### Scanning

- `POST /scan/cookbook` - Scan a cookbook page (multipart/form-data)
- `POST /scan/fridge` - Scan fridge contents (multipart/form-data)
- `GET /scan/cookbook/:scanId/status` - Get scan status

#### Cookbooks

- `GET /cookbooks` - Get all user's cookbooks
- `GET /cookbook/:id` - Get specific cookbook
- `GET /cookbook/:id/recipes` - Get all recipes from cookbook
- `PUT /cookbook/:id` - Update cookbook
- `DELETE /cookbook/:id` - Delete cookbook

#### Recipes

- `GET /recipe/:id` - Get specific recipe
- `POST /recipes/match` - Match recipes with fridge ingredients

#### Fridge Inventory

- `GET /fridge/inventory` - Get fridge inventory
- `POST /fridge/inventory` - Add items manually
- `PUT /fridge/item/:id` - Update fridge item
- `DELETE /fridge/item/:id` - Delete fridge item
- `DELETE /fridge/inventory` - Clear entire inventory

### Example Requests

#### Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
  }'
```

#### Scan a Cookbook Page

```bash
curl -X POST http://localhost:3000/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/cookbook-page.jpg" \
  -F "cookbookName=Italian Classics"
```

#### Match Recipes

```bash
curl -X POST http://localhost:3000/api/recipes/match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "minMatchPercentage": 75,
    "includePartialMatches": true
  }'
```

## 🏗️ Project Structure

```
cookbook-app-backend/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── authController.js
│   │   ├── scanController.js
│   │   ├── cookbookController.js
│   │   ├── recipeController.js
│   │   ├── fridgeController.js
│   │   └── matchController.js
│   ├── database/           # Database configuration
│   │   ├── db.js
│   │   ├── schema.sql
│   │   └── migrate.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   ├── upload.js
│   │   └── rateLimiter.js
│   ├── routes/            # API routes
│   │   ├── auth.js
│   │   ├── scan.js
│   │   ├── cookbooks.js
│   │   ├── recipes.js
│   │   └── fridge.js
│   ├── services/          # Business logic
│   │   └── gemini.js
│   ├── utils/             # Utilities
│   │   ├── logger.js
│   │   ├── redis.js
│   │   └── s3.js
│   └── server.js          # Main application file
├── logs/                  # Application logs
├── .env.example          # Example environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🧪 Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm test -- --coverage
```

## 🔒 Security

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Helmet.js for security headers
- Input validation with Joi
- SQL injection prevention with parameterized queries
- File upload validation and size limits

## 📊 Performance

- Redis caching for frequently accessed data
- Database connection pooling
- Image optimization before AI processing
- Efficient database queries with indexes

## 🐛 Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional context",
    "timestamp": "2024-01-20T15:45:00Z",
    "requestId": "uuid"
  }
}
```

## 📝 Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## 🚀 Deployment

### Environment Variables

Ensure all production environment variables are set:

- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production database
- Set up production Redis instance
- Configure AWS S3 bucket
- Set appropriate CORS origins

### Database Migration

Run migrations on production:

```bash
NODE_ENV=production npm run migrate
```

### Process Management

Use PM2 for process management:

```bash
npm install -g pm2
pm2 start src/server.js --name cookbook-api
pm2 save
pm2 startup
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@cookbookapp.com

## 🎯 Roadmap

- [ ] Ingredient substitution suggestions
- [ ] Shopping list generation
- [ ] Meal planning features
- [ ] Recipe sharing between users
- [ ] Nutritional information extraction
- [ ] Multi-language support
- [ ] Voice input for ingredients
- [ ] Barcode scanning for packaged items

---

**Built with ❤️ by Season Solutions**
