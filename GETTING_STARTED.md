# Getting Started with Cookbook App Backend

Welcome! This guide will help you get the Cookbook App backend up and running.

## 📋 What You'll Need

Before starting, make sure you have:

### Required
- ✅ Node.js 18+ ([Download](https://nodejs.org/))
- ✅ PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- ✅ Redis 7+ ([Download](https://redis.io/download))
- ✅ Google Gemini API Key ([Get one](https://makersuite.google.com/app/apikey))
- ✅ AWS Account for S3 ([Sign up](https://aws.amazon.com/))

### Optional but Recommended
- Git for version control
- Postman or similar for API testing
- Docker (if you want to use containers)

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/cookbook_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-key-here-min-32-chars

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
S3_BUCKET_NAME=your-bucket-name
```

### Step 3: Set Up Database

```bash
# Create database
createdb cookbook_db

# Run migrations
npm run migrate
```

### Step 4: Start the Server

```bash
npm run dev
```

✅ **Success!** Your server should be running at `http://localhost:3000`

## 🧪 Test Your Setup

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Cookbook API is running"
}
```

### 2. Register a Test User

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

### 3. Get Your Profile

```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📚 Next Steps

Now that your backend is running:

### 1. Learn the API
- Read [API_EXAMPLES.md](API_EXAMPLES.md) for detailed examples
- Try different endpoints with Postman
- Scan a cookbook page or fridge image

### 2. Understand the Code
- Explore the `src/` directory
- Read controller files to understand logic
- Check middleware for security features

### 3. Customize
- Adjust rate limits in `.env`
- Modify AI prompts in `src/services/gemini.js`
- Add custom validation rules

### 4. Deploy
- Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production
- Set up monitoring and logging
- Configure backups

## 🎯 Common Tasks

### Add a New Endpoint

1. Create controller function in `src/controllers/`
2. Add route in `src/routes/`
3. Add validation schema if needed
4. Test with curl or Postman

### Modify Database Schema

1. Edit `src/database/schema.sql`
2. Run `npm run migrate`
3. Update controllers if needed

### Change AI Prompts

Edit prompts in `src/services/gemini.js`:
- `COOKBOOK_PROMPT` for recipe extraction
- `FRIDGE_PROMPT` for fridge scanning

## 🐛 Troubleshooting

### Server won't start

**Check:**
- Is PostgreSQL running? `pg_isready`
- Is Redis running? `redis-cli ping`
- Are environment variables set correctly?
- Is port 3000 available?

### Database connection error

**Fix:**
```bash
# Check PostgreSQL status
pg_isready

# Restart PostgreSQL
brew services restart postgresql  # macOS
sudo systemctl restart postgresql  # Linux
```

### Redis connection error

**Fix:**
```bash
# Check Redis status
redis-cli ping

# Restart Redis
brew services restart redis  # macOS
sudo systemctl restart redis  # Linux
```

### Gemini API error

**Check:**
- Is your API key correct?
- Do you have API access enabled?
- Are you within rate limits?

### S3 upload error

**Check:**
- Are AWS credentials correct?
- Does the bucket exist?
- Do you have write permissions?

## 📖 Documentation Guide

- **README.md** - Overview and main documentation
- **QUICKSTART.md** - 5-minute setup guide
- **SETUP.md** - Detailed setup instructions
- **API_EXAMPLES.md** - API usage examples
- **DEPLOYMENT.md** - Production deployment
- **PROJECT_SUMMARY.md** - Technical overview
- **CONTRIBUTING.md** - How to contribute

## 💡 Tips for Success

### Development
- Use `npm run dev` for auto-reload
- Check logs in `logs/` directory
- Use environment variables for config
- Test endpoints as you build

### Testing
- Write tests for new features
- Run `npm test` before committing
- Maintain test coverage above 70%

### Security
- Never commit `.env` file
- Use strong JWT secrets
- Keep dependencies updated
- Follow security best practices

### Performance
- Monitor Redis cache hit rates
- Optimize database queries
- Use indexes appropriately
- Profile slow endpoints

## 🎓 Learning Resources

### Node.js & Express
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Database
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [Redis Documentation](https://redis.io/documentation)

### AI Integration
- [Google Gemini Docs](https://ai.google.dev/docs)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

### API Design
- [REST API Best Practices](https://restfulapi.net/)
- [HTTP Status Codes](https://httpstatuses.com/)

## 🤝 Getting Help

### Documentation
- Check the docs in this repository
- Review code comments
- Read error messages carefully

### Community
- Open an issue on GitHub
- Ask questions in discussions
- Check existing issues first

### Support
- Email: support@cookbookapp.com
- Documentation: All .md files in this repo

## ✅ Setup Checklist

Use this checklist to track your progress:

- [ ] Node.js installed and working
- [ ] PostgreSQL installed and running
- [ ] Redis installed and running
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured (`.env`)
- [ ] Database created
- [ ] Migrations run successfully
- [ ] Server starts without errors
- [ ] Health check passes
- [ ] Test user registered
- [ ] API endpoints working
- [ ] Gemini API key configured
- [ ] S3 bucket configured
- [ ] Documentation reviewed

## 🎉 You're Ready!

Congratulations! You now have a fully functional Cookbook App backend.

### What's Next?

1. **Explore the API** - Try all endpoints
2. **Scan a cookbook** - Test the AI features
3. **Build your frontend** - Connect your React Native app
4. **Customize** - Make it your own
5. **Deploy** - Share with the world

---

**Need help? Check the documentation or open an issue!**

**Happy coding! 🚀**
