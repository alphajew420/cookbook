const { query } = require('../database/db');
const logger = require('../utils/logger');

const KEEPA_API_KEY = process.env.KEEPA_API_KEY;
const AMAZON_TAG = process.env.AMAZON_ASSOCIATES_TAG || 'cookbookapp-20';
const BOOKS_CATEGORY = 283155;

/**
 * Search Keepa for a cookbook by title and store Amazon data if found.
 * Fire-and-forget — call without awaiting after cookbook creation.
 */
async function lookupAndStoreCookbook(cookbookId, bookTitle) {
  if (!KEEPA_API_KEY) {
    logger.warn('KEEPA_API_KEY not set, skipping Amazon lookup');
    return;
  }

  try {
    const result = await searchBook(bookTitle);
    if (!result) {
      logger.info('No Amazon book found for cookbook', { cookbookId, bookTitle });
      return;
    }

    await query(
      `UPDATE cookbooks
       SET amazon_asin = $1, amazon_image_url = $2, amazon_product_url = $3
       WHERE id = $4`,
      [result.asin, result.imageUrl, result.productUrl, cookbookId]
    );

    logger.info('Stored Amazon data for cookbook', {
      cookbookId,
      bookTitle,
      asin: result.asin,
    });
  } catch (error) {
    logger.error('Keepa lookup failed', { cookbookId, bookTitle, error: error.message });
  }
}

/**
 * Search Keepa for a book by title.
 * Returns { asin, imageUrl, productUrl } or null.
 */
async function searchBook(title) {
  const url = new URL('https://api.keepa.com/search');
  url.searchParams.set('key', KEEPA_API_KEY);
  url.searchParams.set('domain', '1'); // US Amazon
  url.searchParams.set('type', 'product');
  url.searchParams.set('term', title);
  url.searchParams.set('page', '0');
  url.searchParams.set('history', '0');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keepa API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!data.products || data.products.length === 0) {
    return null;
  }

  // Find the first result that is a book
  const book = data.products.find(p => p.rootCategory === BOOKS_CATEGORY);
  if (!book) {
    // Fall back to first result if none matched books category
    // (cookbook names are specific enough that first result is usually correct)
    const fallback = data.products[0];
    return formatResult(fallback);
  }

  return formatResult(book);
}

function formatResult(product) {
  const asin = product.asin;
  if (!asin) return null;

  // Build image URL from imagesCSV
  let imageUrl = null;
  if (product.imagesCSV) {
    const firstImage = product.imagesCSV.split(',')[0];
    if (firstImage) {
      imageUrl = `https://m.media-amazon.com/images/I/${firstImage}`;
    }
  }

  const productUrl = `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

  return { asin, imageUrl, productUrl };
}

/**
 * Normalize book title for fuzzy matching
 * Removes punctuation, lowercases, trims, normalizes spaces
 */
function normalizeBookTitle(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Calculate confidence score for a book match using fuzzy string matching
 * Returns 0-100 percentage
 */
function calculateMatchConfidence(bookTitle, keepaTitle) {
  const { calculateSimilarity } = require('../utils/fuzzyMatch');

  const normalized1 = normalizeBookTitle(bookTitle);
  const normalized2 = normalizeBookTitle(keepaTitle);

  // Exact match
  if (normalized1 === normalized2) return 100;

  // Substring match
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return Math.max(calculateSimilarity(normalized1, normalized2), 95);
  }

  // Levenshtein similarity
  return Math.round(calculateSimilarity(normalized1, normalized2));
}

/**
 * Search Keepa for books with confidence scoring
 * Returns top 3 results with confidence scores
 * Returns array of { asin, title, imageUrl, productUrl, confidence, isBook }
 */
async function searchBooksWithConfidence(title) {
  if (!KEEPA_API_KEY) {
    throw new Error('KEEPA_API_KEY not configured');
  }

  const url = new URL('https://api.keepa.com/search');
  url.searchParams.set('key', KEEPA_API_KEY);
  url.searchParams.set('domain', '1'); // US Amazon
  url.searchParams.set('type', 'product');
  url.searchParams.set('term', title);
  url.searchParams.set('page', '0');
  url.searchParams.set('history', '0');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keepa API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!data.products || data.products.length === 0) {
    return [];
  }

  // Calculate confidence for top results
  const results = [];
  for (const product of data.products.slice(0, 3)) {
    const confidence = calculateMatchConfidence(title, product.title || '');

    // Build image URL
    let imageUrl = null;
    if (product.imagesCSV) {
      const firstImage = product.imagesCSV.split(',')[0];
      if (firstImage) {
        imageUrl = `https://m.media-amazon.com/images/I/${firstImage}`;
      }
    }

    results.push({
      asin: product.asin,
      title: product.title || '',
      imageUrl,
      productUrl: `https://www.amazon.com/dp/${product.asin}?tag=${AMAZON_TAG}`,
      confidence,
      isBook: product.rootCategory === BOOKS_CATEGORY,
    });
  }

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
  lookupAndStoreCookbook,
  searchBook,
  searchBooksWithConfidence,
  calculateMatchConfidence,
  normalizeBookTitle,
};
