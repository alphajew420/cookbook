const { query } = require('../database/db');
const logger = require('../utils/logger');

const runFridgeScanMigration = async (req, res, next) => {
  try {
    logger.info('Running fridge scan history migration');

    await query(`
      ALTER TABLE fridge_items 
      ADD COLUMN IF NOT EXISTS scan_job_id UUID NULL
    `);
    logger.info('Added scan_job_id column');

    try {
      await query(`
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

    await query(`
      CREATE INDEX IF NOT EXISTS idx_fridge_items_scan_job_id 
      ON fridge_items(scan_job_id)
    `);
    logger.info('Created scan_job_id index');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_fridge_items_user_scan_job 
      ON fridge_items(user_id, scan_job_id)
    `);
    logger.info('Created composite index');

    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fridge_items' AND column_name = 'scan_job_id'
    `);

    logger.info('Fridge scan history migration completed successfully');

    res.status(200).json({
      success: true,
      message: 'Migration completed successfully',
      details: {
        columnAdded: result.rows.length > 0,
        columnInfo: result.rows[0] || null,
      },
    });
  } catch (error) {
    logger.error('Migration failed', { error: error.message, stack: error.stack });
    next(error);
  }
};

module.exports = {
  runFridgeScanMigration,
};
