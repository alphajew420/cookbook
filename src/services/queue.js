const Bull = require('bull');
const logger = require('../utils/logger');

// Redis connection config
// Use REDIS_URL if available (Railway format), otherwise use individual vars
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    };

// Create queues
const cookbookQueue = new Bull('cookbook-scans', redisConfig);
const fridgeQueue = new Bull('fridge-scans', redisConfig);

// Queue event listeners
cookbookQueue.on('error', (error) => {
  logger.error('Cookbook queue error', { error: error.message });
});

cookbookQueue.on('failed', (job, error) => {
  logger.error('Cookbook job failed', {
    jobId: job.id,
    error: error.message,
  });
});

fridgeQueue.on('error', (error) => {
  logger.error('Fridge queue error', { error: error.message });
});

fridgeQueue.on('failed', (job, error) => {
  logger.error('Fridge job failed', {
    jobId: job.id,
    error: error.message,
  });
});

/**
 * Add cookbook scan job to queue
 */
const addCookbookJob = async (jobData) => {
  const job = await cookbookQueue.add(jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  });

  logger.info('Cookbook job added to queue', {
    jobId: job.id,
    userId: jobData.userId,
    cookbookName: jobData.cookbookName,
  });

  return job.id;
};

/**
 * Add fridge scan job to queue
 */
const addFridgeJob = async (jobData) => {
  const job = await fridgeQueue.add(jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  });

  logger.info('Fridge job added to queue', {
    jobId: job.id,
    userId: jobData.userId,
  });

  return job.id;
};

/**
 * Get job status
 */
const getJobStatus = async (queueType, jobId) => {
  const queue = queueType === 'cookbook' ? cookbookQueue : fridgeQueue;
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
};

module.exports = {
  cookbookQueue,
  fridgeQueue,
  addCookbookJob,
  addFridgeJob,
  getJobStatus,
};
