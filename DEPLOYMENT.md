# Deployment Guide

This guide covers deploying the Cookbook App backend to various platforms.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Deployment Platforms](#deployment-platforms)
5. [Post-Deployment](#post-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] S3 bucket created and configured
- [ ] Gemini API key obtained
- [ ] Redis instance provisioned
- [ ] SSL/TLS certificates ready
- [ ] Domain name configured
- [ ] Monitoring tools set up
- [ ] Backup strategy in place

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file (never commit this):

```env
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Database (use connection pooling)
DATABASE_URL=postgresql://user:password@host:5432/cookbook_prod
DB_POOL_MIN=5
DB_POOL_MAX=20

# Redis
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password

# JWT (use strong secrets!)
JWT_SECRET=<generate-with-crypto.randomBytes(64).toString('hex')>
JWT_EXPIRATION=1h
REFRESH_TOKEN_SECRET=<generate-with-crypto.randomBytes(64).toString('hex')>
REFRESH_TOKEN_EXPIRATION=7d

# Google Gemini
GEMINI_API_KEY=your-production-gemini-key
GEMINI_MODEL=gemini-1.5-pro

# AWS S3
AWS_ACCESS_KEY_ID=your-production-access-key
AWS_SECRET_ACCESS_KEY=your-production-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=cookbook-app-prod

# Rate Limiting (adjust based on expected traffic)
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000
SCAN_COOKBOOK_LIMIT=10
SCAN_FRIDGE_LIMIT=20

# Image Upload
MAX_IMAGE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/jpg

# Logging
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn

# CORS (your frontend URLs)
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

---

## Database Setup

### PostgreSQL Production Setup

#### 1. Managed Database (Recommended)

Use a managed PostgreSQL service:
- **AWS RDS**
- **Google Cloud SQL**
- **DigitalOcean Managed Databases**
- **Heroku Postgres**

#### 2. Self-Hosted PostgreSQL

If self-hosting:

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create production database
sudo -u postgres psql
CREATE DATABASE cookbook_prod;
CREATE USER cookbook_user WITH ENCRYPTED PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE cookbook_prod TO cookbook_user;
\q

# Configure PostgreSQL for production
sudo nano /etc/postgresql/14/main/postgresql.conf
```

Recommended settings:
```
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

#### 3. Run Migrations

```bash
NODE_ENV=production npm run migrate
```

#### 4. Set Up Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump cookbook_prod > /backups/cookbook_$DATE.sql
# Upload to S3
aws s3 cp /backups/cookbook_$DATE.sql s3://your-backup-bucket/
```

---

## Deployment Platforms

### Option 1: AWS EC2

#### 1. Launch EC2 Instance

- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (or larger)
- Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

#### 2. Connect and Setup

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx
```

#### 3. Deploy Application

```bash
# Clone repository
git clone your-repo-url
cd cookbook-app-backend

# Install dependencies
npm ci --production

# Set up environment
cp .env.production .env

# Run migrations
npm run migrate

# Start with PM2
pm2 start src/server.js --name cookbook-api
pm2 save
pm2 startup
```

#### 4. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/cookbook-api
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cookbook-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Set Up SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

### Option 2: Heroku

#### 1. Install Heroku CLI

```bash
curl https://cli-assets.heroku.com/install.sh | sh
heroku login
```

#### 2. Create Heroku App

```bash
heroku create cookbook-api-prod

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:premium-0
```

#### 3. Configure Environment Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
heroku config:set GEMINI_API_KEY=your-key
heroku config:set AWS_ACCESS_KEY_ID=your-key
heroku config:set AWS_SECRET_ACCESS_KEY=your-secret
heroku config:set S3_BUCKET_NAME=your-bucket
# ... set all other env vars
```

#### 4. Deploy

```bash
git push heroku main

# Run migrations
heroku run npm run migrate
```

---

### Option 3: DigitalOcean App Platform

#### 1. Create App

- Go to DigitalOcean App Platform
- Connect your GitHub repository
- Select branch: `main`

#### 2. Configure Build

```yaml
name: cookbook-api
services:
  - name: api
    github:
      repo: your-username/cookbook-app-backend
      branch: main
    build_command: npm ci
    run_command: npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: professional-xs
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
      # Add all other env vars
databases:
  - name: db
    engine: PG
    version: "14"
```

#### 3. Add Redis

- Add a managed Redis database
- Connect to your app

---

### Option 4: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/cookbook
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=cookbook
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### 3. Deploy

```bash
docker-compose up -d
docker-compose exec api npm run migrate
```

---

## Post-Deployment

### 1. Health Check

```bash
curl https://api.yourdomain.com/health
```

### 2. Test Endpoints

```bash
# Register a user
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'
```

### 3. Monitor Logs

```bash
# PM2
pm2 logs cookbook-api

# Heroku
heroku logs --tail

# Docker
docker-compose logs -f api
```

### 4. Set Up Monitoring

#### Sentry (Error Tracking)

```bash
npm install @sentry/node
```

Add to `src/server.js`:

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### Uptime Monitoring

Use services like:
- UptimeRobot
- Pingdom
- StatusCake

---

## Monitoring & Maintenance

### Performance Monitoring

1. **Database Performance**
   - Monitor query times
   - Check connection pool usage
   - Review slow queries

2. **API Performance**
   - Track response times
   - Monitor rate limit hits
   - Check cache hit rates

3. **Resource Usage**
   - CPU usage
   - Memory usage
   - Disk space

### Regular Maintenance

#### Daily
- Check error logs
- Monitor API health
- Review rate limit violations

#### Weekly
- Review performance metrics
- Check database size
- Update dependencies (security patches)

#### Monthly
- Full backup verification
- Security audit
- Performance optimization review

### Scaling Considerations

#### Horizontal Scaling

```bash
# PM2 cluster mode
pm2 start src/server.js -i max --name cookbook-api
```

#### Database Scaling

- Read replicas for read-heavy operations
- Connection pooling optimization
- Query optimization

#### Caching Strategy

- Increase Redis memory
- Implement CDN for images
- Cache frequently accessed data

---

## Rollback Procedure

If deployment fails:

```bash
# PM2
pm2 stop cookbook-api
git checkout previous-version
npm ci
pm2 restart cookbook-api

# Heroku
heroku releases:rollback

# Docker
docker-compose down
git checkout previous-version
docker-compose up -d
```

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API keys rotated
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled (Helmet)
- [ ] Input validation active
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Regular security updates

---

## Support

For deployment issues:
- Check logs first
- Review this guide
- Contact DevOps team
- Create support ticket

---

**Good luck with your deployment! 🚀**
