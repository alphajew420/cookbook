function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
}

function normalizeIngredientName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

function fuzzyMatchIngredient(recipeIngredient, fridgeItems, threshold = 85) {
  const normalizedRecipe = normalizeIngredientName(recipeIngredient);

  for (const fridgeItem of fridgeItems) {
    const normalizedFridge = normalizeIngredientName(fridgeItem.name);

    if (normalizedRecipe === normalizedFridge) {
      return { matched: true, fridgeItem, similarity: 100 };
    }

    if (normalizedRecipe.includes(normalizedFridge) || normalizedFridge.includes(normalizedRecipe)) {
      return { matched: true, fridgeItem, similarity: 95 };
    }

    const similarity = calculateSimilarity(normalizedRecipe, normalizedFridge);
    if (similarity >= threshold) {
      return { matched: true, fridgeItem, similarity };
    }
  }

  return { matched: false, fridgeItem: null, similarity: 0 };
}

module.exports = {
  fuzzyMatchIngredient,
  normalizeIngredientName,
  calculateSimilarity,
};
