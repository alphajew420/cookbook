const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
require('dotenv').config();

/**
 * Run database migrations
 */
async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await client.query(schema);
    
    console.log('✓ Database migration completed successfully');
    console.log('✓ All tables created');
    console.log('✓ All indexes created');
    console.log('✓ All triggers created');
    
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrate;
