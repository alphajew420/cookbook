require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { testConnection } = require('./database/db');
const migrate = require('./database/migrate');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scan');
const scanJobsRoutes = require('./routes/scanJobs');
const cookbookRoutes = require('./routes/cookbooks');
const recipeRoutes = require('./routes/recipes');
const fridgeRoutes = require('./routes/fridge');
const matchRoutes = require('./routes/matches');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Railway/reverse proxies)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : [];
    
    // Allow Expo tunnel domains (*.exp.direct)
    if (origin.includes('.exp.direct')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject origin
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Rate limiting
app.use('/api', generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cookbook API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// One-time migration endpoint (remove after use)
app.get('/migrate', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { pool } = require('./database/db');
    
    const client = await pool.connect();
    
    try {
      // Read the scan_jobs migration file
      const migrationPath = path.join(__dirname, 'database', 'add_scan_jobs.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute migration
      await client.query(migration);
      
      res.status(200).json({
        success: true,
        message: 'scan_jobs table created successfully',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Fridge scan history migration endpoint
app.get('/migrate-fridge-scan-history', async (req, res) => {
  try {
    const { pool } = require('./database/db');
    const client = await pool.connect();
    
    try {
      logger.info('Running fridge scan history migration');

      await client.query(`
        ALTER TABLE fridge_items 
        ADD COLUMN IF NOT EXISTS scan_job_id UUID NULL
      `);
      logger.info('Added scan_job_id column');

      try {
        await client.query(`
          ALTER TABLE fridge_items
          ADD CONSTRAINT fk_fridge_items_scan_job 
            FOREIGN KEY (scan_job_id) 
            REFERENCES scan_jobs(id) 
            ON DELETE SET NULL
        `);
        logger.info('Added foreign key constraint');
      } catch (error) {
        if (error.message.includes('already exists')) {
          logger.info('Foreign key constraint already exists, skipping');
        } else {
          throw error;
        }
      }

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fridge_items_scan_job_id 
        ON fridge_items(scan_job_id)
      `);
      logger.info('Created scan_job_id index');

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fridge_items_user_scan_job 
        ON fridge_items(user_id, scan_job_id)
      `);
      logger.info('Created composite index');

      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'fridge_items' AND column_name = 'scan_job_id'
      `);

      logger.info('Fridge scan history migration completed successfully');

      res.status(200).json({
        success: true,
        message: 'Fridge scan history migration completed successfully',
        details: {
          columnAdded: result.rows.length > 0,
          columnInfo: result.rows[0] || null,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Migration failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Recipe matching migration endpoint
app.get('/migrate-recipe-matching', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { pool } = require('./database/db');
    
    const client = await pool.connect();
    
    try {
      logger.info('Running recipe matching migration');
      
      const migrationPath = path.join(__dirname, 'database', 'add_match_tables.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      
      await client.query(migration);
      
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('match_jobs', 'recipe_matches')
      `);
      
      logger.info('Recipe matching migration completed successfully');
      
      res.status(200).json({
        success: true,
        message: 'Recipe matching tables created successfully',
        tables: tablesResult.rows.map(r => r.table_name),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Migration failed', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/scan/jobs', scanJobsRoutes);
app.use('/api/cookbooks', cookbookRoutes);
app.use('/api/cookbook', cookbookRoutes); // Alias for compatibility
app.use('/api/recipes', recipeRoutes);
app.use('/api/recipe', recipeRoutes); // Alias for compatibility
app.use('/api/fridge', fridgeRoutes);
app.use('/api/matches', matchRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Run database migrations
    logger.info('Running database migrations...');
    await migrate();
    logger.info('Database migrations completed');

    // Start worker if enabled
    if (process.env.ENABLE_WORKER === 'true') {
      logger.info('Starting background worker...');
      require('./workers/scanWorker');
    }
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API Base URL: ${process.env.API_BASE_URL || `http://localhost:${PORT}`}`);
      logger.info(`✅ Health check: http://localhost:${PORT}/health`);
      if (process.env.ENABLE_WORKER === 'true') {
        logger.info(`⚙️  Background worker enabled`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
