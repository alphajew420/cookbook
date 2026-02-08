# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-07

### Added
- Initial release of Cookbook App Backend API
- User authentication with JWT tokens
- Google Gemini AI integration for image processing
- Cookbook page scanning and recipe extraction
- Fridge contents scanning and inventory management
- Intelligent recipe matching algorithm
- PostgreSQL database with full schema
- Redis caching for performance optimization
- AWS S3 integration for image storage
- Comprehensive error handling and validation
- Rate limiting on all endpoints
- RESTful API with full CRUD operations
- Automated database migrations
- Logging with Winston
- Security features (Helmet, CORS, input validation)
- API documentation and examples
- Deployment guides for multiple platforms
- Test suite with Jest
- Docker support

### Features

#### Authentication
- User registration with email and password
- Secure login with JWT tokens
- Password hashing with bcrypt
- Token refresh mechanism
- User profile management

#### Cookbook Scanning
- AI-powered recipe extraction from images
- Support for multiple recipes per page
- Automatic ingredient parsing
- Step-by-step instruction extraction
- Cookbook organization and management
- Image quality validation
- Edge case handling (empty pages, non-cookbook images)

#### Fridge Management
- AI-powered food item identification
- Automatic categorization of items
- Freshness assessment
- Confidence scoring
- Manual item addition and editing
- Expiry date tracking
- Inventory clearing

#### Recipe Matching
- Intelligent ingredient matching algorithm
- Fuzzy matching for ingredient variations
- Percentage-based matching
- Perfect and partial match identification
- Missing ingredient tracking
- Cookbook-specific filtering

#### Performance
- Redis caching for frequently accessed data
- Database connection pooling
- Image optimization before AI processing
- Efficient database queries with indexes
- Rate limiting to prevent abuse

#### Security
- JWT-based authentication
- Password hashing
- Input validation with Joi
- SQL injection prevention
- XSS protection
- Rate limiting
- Helmet security headers
- CORS configuration

### API Endpoints

#### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

#### Scanning
- `POST /api/scan/cookbook` - Scan cookbook page
- `POST /api/scan/fridge` - Scan fridge contents
- `GET /api/scan/:scanId/status` - Get scan status

#### Cookbooks
- `GET /api/cookbooks` - List all cookbooks
- `GET /api/cookbook/:id` - Get cookbook details
- `GET /api/cookbook/:id/recipes` - Get cookbook recipes
- `PUT /api/cookbook/:id` - Update cookbook
- `DELETE /api/cookbook/:id` - Delete cookbook

#### Recipes
- `GET /api/recipe/:id` - Get recipe details
- `POST /api/recipes/match` - Match recipes with fridge

#### Fridge
- `GET /api/fridge/inventory` - Get inventory
- `POST /api/fridge/inventory` - Add items
- `PUT /api/fridge/item/:id` - Update item
- `DELETE /api/fridge/item/:id` - Delete item
- `DELETE /api/fridge/inventory` - Clear inventory

### Documentation
- Comprehensive README with setup instructions
- Detailed API examples and usage guide
- Step-by-step setup guide
- Deployment guide for multiple platforms
- Contributing guidelines
- API reference documentation

### Dependencies
- Express.js 4.18.2 - Web framework
- PostgreSQL (pg) 8.11.3 - Database
- Redis 4.6.12 - Caching
- Google Generative AI 0.2.1 - AI processing
- AWS SDK 2.1543.0 - S3 storage
- Sharp 0.33.1 - Image processing
- JWT 9.0.2 - Authentication
- Bcrypt 2.4.3 - Password hashing
- Joi 17.11.0 - Validation
- Winston 3.11.0 - Logging
- Helmet 7.1.0 - Security
- Multer 1.4.5 - File uploads

### Infrastructure
- Node.js 18+ runtime
- PostgreSQL 14+ database
- Redis 7+ cache
- AWS S3 storage
- Google Gemini API

---

## [Unreleased]

### Planned Features
- Ingredient substitution suggestions
- Shopping list generation from missing ingredients
- Meal planning functionality
- Recipe sharing between users
- Nutritional information extraction
- Multi-language support
- Voice input for ingredients
- Barcode scanning for packaged items
- Recipe collections and favorites
- Cooking timers integration
- Recipe rating and reviews
- Social features (follow users, share recipes)
- Advanced search and filtering
- Recipe recommendations based on preferences
- Dietary restriction filtering
- Batch recipe scanning
- OCR for expiry dates
- Webhook notifications
- GraphQL API option
- Mobile app SDK

### Improvements
- Enhanced AI prompts for better accuracy
- Improved ingredient matching algorithm
- Better error messages
- Performance optimizations
- Enhanced caching strategies
- Database query optimizations
- Better test coverage
- API versioning
- Swagger/OpenAPI documentation
- Rate limiting per user tier
- Image compression improvements
- Async processing for large scans

---

## Version History

- **1.0.0** (2026-02-07) - Initial release

---

For more details, see the [GitHub releases page](https://github.com/your-org/cookbook-app-backend/releases).
