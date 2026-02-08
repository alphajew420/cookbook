# API Usage Examples

This document provides practical examples for using the Cookbook App API.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.cookbookapp.com
```

## Authentication Flow

### 1. Register a New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Get User Profile

```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Cookbook Scanning

### Scan a Cookbook Page

```bash
curl -X POST http://localhost:3000/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/cookbook-page.jpg" \
  -F "cookbookName=Italian Classics"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "123e4567-e89b-12d3-a456-426614174000",
    "cookbookId": "550e8400-e29b-41d4-a716-446655440000",
    "recipesFound": 2,
    "recipes": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Spaghetti Carbonara",
        "ingredients": [
          {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "name": "Spaghetti",
            "quantity": "400",
            "unit": "g",
            "notes": null
          },
          {
            "id": "770e8400-e29b-41d4-a716-446655440003",
            "name": "Eggs",
            "quantity": "4",
            "unit": "whole",
            "notes": null
          },
          {
            "id": "770e8400-e29b-41d4-a716-446655440004",
            "name": "Pancetta",
            "quantity": "200",
            "unit": "g",
            "notes": "diced"
          }
        ],
        "instructions": [
          {
            "stepNumber": 1,
            "description": "Boil pasta in salted water until al dente"
          },
          {
            "stepNumber": 2,
            "description": "Cook pancetta until crispy"
          },
          {
            "stepNumber": 3,
            "description": "Mix eggs with cheese"
          },
          {
            "stepNumber": 4,
            "description": "Combine pasta with pancetta and egg mixture"
          }
        ],
        "prepTime": "10 minutes",
        "cookTime": "15 minutes",
        "servings": 4
      }
    ],
    "processingTime": 3500,
    "imageUrl": "https://s3.amazonaws.com/cookbook-app/cookbook/123.jpg"
  }
}
```

### Scan to Existing Cookbook

```bash
curl -X POST http://localhost:3000/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/page2.jpg" \
  -F "cookbookId=550e8400-e29b-41d4-a716-446655440000"
```

---

## Fridge Scanning

### Scan Fridge Contents

```bash
curl -X POST http://localhost:3000/api/scan/fridge \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/fridge-photo.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanId": "789e4567-e89b-12d3-a456-426614174000",
    "itemsFound": 8,
    "items": [
      {
        "id": "890e8400-e29b-41d4-a716-446655440005",
        "name": "Red Bell Pepper",
        "quantity": "2",
        "category": "produce",
        "freshness": "fresh",
        "packaging": "fresh",
        "confidence": "high"
      },
      {
        "id": "890e8400-e29b-41d4-a716-446655440006",
        "name": "Milk",
        "quantity": "1 gallon",
        "category": "dairy",
        "freshness": "fresh",
        "packaging": "bottled",
        "confidence": "high"
      },
      {
        "id": "890e8400-e29b-41d4-a716-446655440007",
        "name": "Eggs",
        "quantity": "12",
        "category": "dairy",
        "freshness": "fresh",
        "packaging": "carton",
        "confidence": "high"
      }
    ],
    "imageQuality": "good",
    "processingTime": 2800,
    "imageUrl": "https://s3.amazonaws.com/cookbook-app/fridge/456.jpg"
  }
}
```

### Replace All Fridge Items

```bash
curl -X POST http://localhost:3000/api/scan/fridge \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/fridge-photo.jpg" \
  -F "replaceExisting=true"
```

---

## Cookbook Management

### Get All Cookbooks

```bash
curl -X GET "http://localhost:3000/api/cookbooks?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cookbooks": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Italian Classics",
        "coverImageUrl": "https://s3.amazonaws.com/...",
        "scannedPages": 12,
        "recipeCount": 24,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T15:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### Get Specific Cookbook

```bash
curl -X GET http://localhost:3000/api/cookbook/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Cookbook Recipes

```bash
curl -X GET http://localhost:3000/api/cookbook/550e8400-e29b-41d4-a716-446655440000/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Cookbook

```bash
curl -X PUT http://localhost:3000/api/cookbook/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Italian Classics - Updated",
    "coverImageUrl": "https://new-cover-url.com/image.jpg"
  }'
```

### Delete Cookbook

```bash
curl -X DELETE http://localhost:3000/api/cookbook/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Recipe Management

### Get Specific Recipe

```bash
curl -X GET http://localhost:3000/api/recipe/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Spaghetti Carbonara",
    "cookbookId": "550e8400-e29b-41d4-a716-446655440000",
    "cookbookName": "Italian Classics",
    "ingredients": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Spaghetti",
        "quantity": "400",
        "unit": "g",
        "notes": null,
        "orderIndex": 0
      }
    ],
    "instructions": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440008",
        "stepNumber": 1,
        "description": "Boil pasta in salted water until al dente"
      }
    ],
    "prepTime": "10 minutes",
    "cookTime": "15 minutes",
    "totalTime": "25 minutes",
    "servings": 4,
    "notes": "Traditional Roman recipe",
    "originalImageUrl": "https://s3.amazonaws.com/...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Fridge Inventory Management

### Get Fridge Inventory

```bash
curl -X GET http://localhost:3000/api/fridge/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "890e8400-e29b-41d4-a716-446655440005",
        "name": "Red Bell Pepper",
        "quantity": "2",
        "category": "produce",
        "freshness": "fresh",
        "expiryDate": null,
        "createdAt": "2024-01-20T10:00:00Z",
        "updatedAt": "2024-01-20T10:00:00Z"
      }
    ],
    "totalItems": 12,
    "categories": {
      "produce": 5,
      "dairy": 3,
      "meat": 2,
      "condiments": 2
    }
  }
}
```

### Filter by Category

```bash
curl -X GET "http://localhost:3000/api/fridge/inventory?category=produce" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Add Items Manually

```bash
curl -X POST http://localhost:3000/api/fridge/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "name": "Tomatoes",
        "quantity": "4",
        "category": "produce",
        "expiryDate": "2024-02-01"
      },
      {
        "name": "Cheddar Cheese",
        "quantity": "200g",
        "category": "dairy"
      }
    ]
  }'
```

### Update Fridge Item

```bash
curl -X PUT http://localhost:3000/api/fridge/item/890e8400-e29b-41d4-a716-446655440005 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": "1",
    "expiryDate": "2024-02-05"
  }'
```

### Delete Fridge Item

```bash
curl -X DELETE http://localhost:3000/api/fridge/item/890e8400-e29b-41d4-a716-446655440005 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Clear Entire Inventory

```bash
curl -X DELETE http://localhost:3000/api/fridge/inventory \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Recipe Matching

### Match Recipes with Fridge Ingredients

```bash
curl -X POST http://localhost:3000/api/recipes/match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "minMatchPercentage": 75,
    "includePartialMatches": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "recipe": {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "name": "Spaghetti Carbonara",
          "cookbookId": "550e8400-e29b-41d4-a716-446655440000",
          "cookbookName": "Italian Classics",
          "prepTime": "10 minutes",
          "servings": 4,
          "ingredients": [...]
        },
        "matchPercentage": 100,
        "availableIngredients": [
          {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "name": "Spaghetti",
            "quantity": "400",
            "unit": "g"
          },
          {
            "id": "770e8400-e29b-41d4-a716-446655440003",
            "name": "Eggs",
            "quantity": "4",
            "unit": "whole"
          }
        ],
        "missingIngredients": [],
        "canMakeNow": true
      },
      {
        "recipe": {
          "id": "660e8400-e29b-41d4-a716-446655440009",
          "name": "Chicken Stir Fry",
          "cookbookId": "550e8400-e29b-41d4-a716-446655440000",
          "prepTime": "15 minutes",
          "servings": 4,
          "ingredients": [...]
        },
        "matchPercentage": 75,
        "availableIngredients": [...],
        "missingIngredients": [
          {
            "name": "Soy Sauce",
            "quantity": "3",
            "unit": "tbsp"
          }
        ],
        "canMakeNow": false
      }
    ],
    "totalMatches": 2,
    "perfectMatches": 1,
    "partialMatches": 1
  }
}
```

### Match from Specific Cookbook

```bash
curl -X POST http://localhost:3000/api/recipes/match \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cookbookId": "550e8400-e29b-41d4-a716-446655440000",
    "minMatchPercentage": 50
  }'
```

---

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "\"email\" must be a valid email"
      }
    ],
    "timestamp": "2024-01-20T15:45:00Z"
  }
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No authentication token provided",
    "timestamp": "2024-01-20T15:45:00Z"
  }
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Recipe not found",
    "timestamp": "2024-01-20T15:45:00Z"
  }
}
```

### 422 Unprocessable Entity

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COOKBOOK_IMAGE",
    "message": "This doesn't appear to be a cookbook page.",
    "timestamp": "2024-01-20T15:45:00Z"
  }
}
```

### 429 Rate Limit Exceeded

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many cookbook scans. Limit is 10 per hour.",
    "timestamp": "2024-01-20T15:45:00Z"
  }
}
```

---

## JavaScript/TypeScript Examples

### Using Fetch API

```javascript
// Register user
async function registerUser(email, password, name) {
  const response = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Store token
    localStorage.setItem('token', data.data.token);
    return data.data.user;
  } else {
    throw new Error(data.error.message);
  }
}

// Scan cookbook
async function scanCookbook(imageFile, cookbookName) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('cookbookName', cookbookName);
  
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:3000/api/scan/cookbook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return await response.json();
}

// Match recipes
async function matchRecipes(minMatchPercentage = 75) {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:3000/api/recipes/match', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      minMatchPercentage,
      includePartialMatches: true,
    }),
  });
  
  return await response.json();
}
```

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Register
const registerUser = async (email, password, name) => {
  const { data } = await api.post('/auth/register', { email, password, name });
  localStorage.setItem('token', data.data.token);
  return data.data.user;
};

// Scan cookbook
const scanCookbook = async (imageFile, cookbookName) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('cookbookName', cookbookName);
  
  const { data } = await api.post('/scan/cookbook', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return data;
};

// Get cookbooks
const getCookbooks = async () => {
  const { data } = await api.get('/cookbooks');
  return data.data.cookbooks;
};
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/register` | 5 requests | 15 minutes |
| `/auth/login` | 5 requests | 15 minutes |
| `/scan/cookbook` | 10 requests | 1 hour |
| `/scan/fridge` | 20 requests | 1 hour |
| All other endpoints | 1000 requests | 1 hour |

---

**For more information, see the main README.md**
