const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');

/**
 * Get page count from PDF buffer
 * @param {Buffer} pdfBuffer
 * @returns {Promise<number>}
 */
async function getPdfPageCount(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  return data.numpages;
}

/**
 * Convert PDF pages to image buffers using pdf2pic
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<Buffer[]>} Array of image buffers (one per page)
 */
async function extractPagesAsImages(pdfBuffer) {
  const { fromBuffer } = require('pdf2pic');
  const pageCount = await getPdfPageCount(pdfBuffer);
  logger.info('PDF page count', { pageCount });

  const converter = fromBuffer(pdfBuffer, {
    density: 200,
    format: 'jpeg',
    width: 2048,
    height: 2048,
    preserveAspectRatio: true,
  });

  const imageBuffers = [];
  for (let i = 1; i <= pageCount; i++) {
    const result = await converter(i, { responseType: 'buffer' });
    imageBuffers.push(result.buffer);
    logger.info('Extracted PDF page as image', { page: i, total: pageCount, size: result.buffer.length });
  }

  return imageBuffers;
}

module.exports = { extractPagesAsImages, getPdfPageCount };
