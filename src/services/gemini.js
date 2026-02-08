const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const logger = require('../utils/logger');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3-pro-preview' });

// Prompts
const COOKBOOK_PROMPT = `You are a recipe extraction assistant. Analyze this cookbook page image and extract ALL recipes visible.

For EACH recipe found, provide:
1. Recipe name (exact as written)
2. Complete list of ingredients with quantities and units
3. Step-by-step instructions (numbered)
4. Prep time (if mentioned)
5. Cook time (if mentioned)
6. Total time (if mentioned)
7. Servings/yield (if mentioned)
8. Any special notes or tips

Return the data in the following JSON format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": "amount",
          "unit": "measurement unit",
          "notes": "optional preparation notes"
        }
      ],
      "instructions": [
        "Step 1 description",
        "Step 2 description"
      ],
      "prepTime": "10 minutes",
      "cookTime": "20 minutes",
      "totalTime": "30 minutes",
      "servings": 4,
      "notes": "Any additional notes or tips"
    }
  ],
  "pageNumber": "page number if visible",
  "bookTitle": "cookbook title if visible on page",
  "isValidCookbook": true
}

IMPORTANT RULES:
- If no recipes are found, return empty recipes array
- If image is not a cookbook page, set "isValidCookbook": false
- Extract exact quantities as written (e.g., "1/2 cup", "2-3 cloves")
- Preserve original recipe names and terminology
- If ingredients are unclear, mark with "notes": "quantity unclear"
- If multiple recipes on one page, extract ALL of them
- Return ONLY valid JSON, no additional text`;

const FRIDGE_PROMPT = `You are a food identification assistant. Analyze this refrigerator/fridge image and identify ALL visible food items and ingredients.

For EACH item found, provide:
1. Item name (be specific, e.g., "red bell pepper" not just "pepper")
2. Estimated quantity (if determinable)
3. Category (produce, dairy, meat, condiments, beverages, etc.)
4. Freshness assessment (fresh, slightly aged, unclear)
5. Packaging type (if relevant: bottled, packaged, fresh, etc.)

Return the data in the following JSON format:
{
  "items": [
    {
      "name": "item name",
      "quantity": "estimated amount or count",
      "category": "food category",
      "freshness": "fresh",
      "packaging": "description of packaging",
      "location": "shelf location if multiple shelves visible",
      "confidence": "high"
    }
  ],
  "totalItemsFound": 0,
  "imageQuality": "good",
  "isValidFridge": true
}

IMPORTANT RULES:
- If image is not a fridge/refrigerator, set "isValidFridge": false
- Only identify food items and beverages
- Be conservative with quantities - use "unclear" if uncertain
- Group similar items (e.g., "3 eggs" not three separate entries)
- Ignore non-food items (containers, shelves, etc.)
- If fridge is empty, return empty items array
- Mark confidence level for each item (high, medium, low)
- If image is too dark/blurry, note in imageQuality
- Return ONLY valid JSON, no additional text`;

/**
 * Optimize image for Gemini processing
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimizeImage(imageBuffer) {
  try {
    const optimized = await sharp(imageBuffer)
      .resize(2048, 2048, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    logger.debug('Image optimized', {
      originalSize: imageBuffer.length,
      optimizedSize: optimized.length,
    });
    
    return optimized;
  } catch (error) {
    logger.error('Image optimization error', { error: error.message });
    throw new Error('Failed to optimize image');
  }
}

/**
 * Extract JSON from Gemini response
 * @param {string} text - Response text
 * @returns {Object} Parsed JSON
 */
function extractJSON(text) {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }
  
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    logger.error('JSON parse error', { text: jsonMatch[0] });
    throw new Error('Invalid JSON in AI response');
  }
}

/**
 * Process cookbook image with Gemini
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} Extracted recipe data
 */
async function processCookbookImage(imageBuffer) {
  const startTime = Date.now();
  
  try {
    // Optimize image
    const optimizedImage = await optimizeImage(imageBuffer);
    const base64Image = optimizedImage.toString('base64');
    
    logger.info('Sending cookbook image to Gemini');
    
    // Send to Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      { text: COOKBOOK_PROMPT },
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    logger.debug('Gemini response received', {
      responseLength: text.length,
    });
    
    // Parse JSON response
    const data = extractJSON(text);
    
    // Validate response
    if (!data.hasOwnProperty('isValidCookbook')) {
      data.isValidCookbook = true; // Default to true if not specified
    }
    
    if (!data.isValidCookbook) {
      return {
        success: false,
        error: 'INVALID_COOKBOOK_IMAGE',
        message: "This doesn't appear to be a cookbook page.",
        processingTime: Date.now() - startTime,
      };
    }
    
    if (!data.recipes || !Array.isArray(data.recipes)) {
      throw new Error('Invalid response format: missing recipes array');
    }
    
    logger.info('Cookbook processed successfully', {
      recipesFound: data.recipes.length,
      processingTime: Date.now() - startTime,
    });
    
    return {
      success: true,
      data: data,
      processingTime: Date.now() - startTime,
    };
    
  } catch (error) {
    logger.error('Gemini cookbook processing error', { error: error.message });
    throw error;
  }
}

/**
 * Process fridge image with Gemini
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} Identified fridge items
 */
async function processFridgeImage(imageBuffer) {
  const startTime = Date.now();
  
  try {
    // Optimize image
    const optimizedImage = await optimizeImage(imageBuffer);
    const base64Image = optimizedImage.toString('base64');
    
    logger.info('Sending fridge image to Gemini');
    
    // Send to Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
      { text: FRIDGE_PROMPT },
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    logger.debug('Gemini response received', {
      responseLength: text.length,
    });
    
    // Parse JSON response
    const data = extractJSON(text);
    
    // Validate response
    if (!data.hasOwnProperty('isValidFridge')) {
      data.isValidFridge = true; // Default to true if not specified
    }
    
    if (!data.isValidFridge) {
      return {
        success: false,
        error: 'INVALID_FRIDGE_IMAGE',
        message: "This doesn't appear to be a refrigerator image.",
        processingTime: Date.now() - startTime,
      };
    }
    
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid response format: missing items array');
    }
    
    logger.info('Fridge processed successfully', {
      itemsFound: data.items.length,
      processingTime: Date.now() - startTime,
    });
    
    return {
      success: true,
      data: data,
      processingTime: Date.now() - startTime,
    };
    
  } catch (error) {
    logger.error('Gemini fridge processing error', { error: error.message });
    throw error;
  }
}

module.exports = {
  processCookbookImage,
  processFridgeImage,
};
