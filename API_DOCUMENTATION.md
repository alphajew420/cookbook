# Cookbook App Backend - API Documentation

**Base URL:** `https://your-app.up.railway.app`

**Version:** 1.0.0

All endpoints return JSON responses with the following structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  }
}
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [Scanning](#scanning)
3. [Cookbooks](#cookbooks)
4. [Recipes](#recipes)
5. [Fridge Inventory](#fridge-inventory)
6. [Error Codes](#error-codes)

---

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### 1. Register User

**Endpoint:** `POST /api/auth/register`

**Description:** Create a new user account

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 6 characters, required
- `name`: String, required

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2026-02-07T20:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

**Error Responses:**
- `400` - Validation error (invalid email, weak password)
- `409` - Email already exists

---

### 2. Login User

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate user and receive JWT token

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2026-02-07T20:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

**Token Expiration:**
- `token`: Expires in 1 hour
- `refreshToken`: Expires in 7 days

**Error Responses:**
- `400` - Validation error
- `401` - Invalid credentials

---

### 3. Get User Profile

**Endpoint:** `GET /api/auth/profile`

**Description:** Get current user's profile information

**Authentication:** Required

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2026-02-07T20:30:00.000Z"
    }
  }
}
```

**Error Responses:**
- `401` - Invalid or expired token

---

## Scanning

### 4. Scan Cookbook Page

**Endpoint:** `POST /api/scan/cookbook`

**Description:** Upload a cookbook page image and extract recipes using AI

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Request Body (Form Data):**
```
image: <file> (required, max 10MB, jpg/jpeg/png)
cookbookName: "Italian Classics" (required, string)
```

**Example using curl:**
```bash
curl -X POST https://your-app.up.railway.app/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/cookbook-page.jpg" \
  -F "cookbookName=Italian Classics"
```

**Example using JavaScript/Fetch:**
```javascript
const formData = new FormData();
formData.append('image', imageFile);
formData.append('cookbookName', 'Italian Classics');

const response = await fetch('https://your-app.up.railway.app/api/scan/cookbook', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "scanId": "650e8400-e29b-41d4-a716-446655440001",
    "cookbook": {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "name": "Italian Classics",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "imageUrl": "https://s3.amazonaws.com/bucket/cookbooks/uuid.jpg",
      "recipeCount": 2,
      "createdAt": "2026-02-07T20:35:00.000Z"
    },
    "recipes": [
      {
        "id": "850e8400-e29b-41d4-a716-446655440003",
        "title": "Classic Spaghetti Carbonara",
        "servings": 4,
        "prepTime": "10 minutes",
        "cookTime": "15 minutes",
        "ingredients": [
          {
            "id": "950e8400-e29b-41d4-a716-446655440004",
            "name": "spaghetti",
            "quantity": "400",
            "unit": "g",
            "normalized": "spaghetti"
          },
          {
            "id": "a50e8400-e29b-41d4-a716-446655440005",
            "name": "eggs",
            "quantity": "4",
            "unit": "whole",
            "normalized": "egg"
          },
          {
            "id": "b50e8400-e29b-41d4-a716-446655440006",
            "name": "pancetta",
            "quantity": "200",
            "unit": "g",
            "normalized": "pancetta"
          }
        ],
        "instructions": [
          {
            "id": "c50e8400-e29b-41d4-a716-446655440007",
            "stepNumber": 1,
            "instruction": "Bring a large pot of salted water to boil"
          },
          {
            "id": "d50e8400-e29b-41d4-a716-446655440008",
            "stepNumber": 2,
            "instruction": "Cook spaghetti according to package directions"
          }
        ]
      }
    ]
  },
  "message": "Cookbook scanned successfully. Found 2 recipes."
}
```

**Error Responses:**
- `400` - Invalid image format or missing fields
- `413` - Image too large (max 10MB)
- `422` - AI could not extract recipes from image
- `429` - Rate limit exceeded (max 10 scans per hour)

**Edge Cases:**
- Empty page: Returns success with 0 recipes
- Multiple recipes: All extracted and returned
- Poor image quality: May return partial data or error

---

### 5. Scan Fridge Contents

**Endpoint:** `POST /api/scan/fridge`

**Description:** Upload a fridge image and identify food items using AI

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Request Body (Form Data):**
```
image: <file> (required, max 10MB, jpg/jpeg/png)
```

**Example using curl:**
```bash
curl -X POST https://your-app.up.railway.app/api/scan/fridge \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/fridge-photo.jpg"
```

**Example using JavaScript/Fetch:**
```javascript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('https://your-app.up.railway.app/api/scan/fridge', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "scanId": "e50e8400-e29b-41d4-a716-446655440009",
    "imageUrl": "https://s3.amazonaws.com/bucket/fridge/uuid.jpg",
    "itemsFound": 5,
    "items": [
      {
        "id": "f50e8400-e29b-41d4-a716-446655440010",
        "name": "milk",
        "category": "dairy",
        "quantity": "1",
        "unit": "carton",
        "normalized": "milk",
        "freshness": "fresh",
        "confidence": 0.95,
        "expiryDate": null,
        "addedAt": "2026-02-07T20:40:00.000Z"
      },
      {
        "id": "050e8400-e29b-41d4-a716-446655440011",
        "name": "eggs",
        "category": "dairy",
        "quantity": "12",
        "unit": "pieces",
        "normalized": "egg",
        "freshness": "fresh",
        "confidence": 0.92,
        "expiryDate": null,
        "addedAt": "2026-02-07T20:40:00.000Z"
      },
      {
        "id": "150e8400-e29b-41d4-a716-446655440012",
        "name": "tomatoes",
        "category": "vegetables",
        "quantity": "5",
        "unit": "pieces",
        "normalized": "tomato",
        "freshness": "fresh",
        "confidence": 0.88,
        "expiryDate": null,
        "addedAt": "2026-02-07T20:40:00.000Z"
      }
    ]
  },
  "message": "Fridge scanned successfully. Found 5 items."
}
```

**Field Descriptions:**
- `name`: Original item name from AI
- `category`: Food category (dairy, meat, vegetables, fruits, grains, condiments, other)
- `normalized`: Standardized name for matching
- `freshness`: AI assessment (fresh, moderate, questionable)
- `confidence`: AI confidence score (0.0 to 1.0)
- `expiryDate`: Optional, if detected by AI

**Error Responses:**
- `400` - Invalid image format
- `413` - Image too large
- `422` - No food items detected in image
- `429` - Rate limit exceeded (max 20 scans per hour)

---

### 6. Get Scan Status

**Endpoint:** `GET /api/scan/:scanId/status`

**Description:** Check the status of an async scan operation

**Authentication:** Required

**URL Parameters:**
- `scanId`: UUID of the scan

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "scanId": "e50e8400-e29b-41d4-a716-446655440009",
    "status": "completed",
    "type": "fridge",
    "createdAt": "2026-02-07T20:40:00.000Z",
    "completedAt": "2026-02-07T20:40:05.000Z"
  }
}
```

**Status Values:**
- `processing`: Scan in progress
- `completed`: Scan finished successfully
- `failed`: Scan failed (check error message)

**Error Responses:**
- `404` - Scan not found

---

## Cookbooks

### 7. Get All Cookbooks

**Endpoint:** `GET /api/cookbooks`

**Description:** Get all cookbooks for the authenticated user

**Authentication:** Required

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20

**Example:**
```
GET /api/cookbooks?page=1&limit=10
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "cookbooks": [
      {
        "id": "750e8400-e29b-41d4-a716-446655440002",
        "name": "Italian Classics",
        "imageUrl": "https://s3.amazonaws.com/bucket/cookbooks/uuid.jpg",
        "recipeCount": 15,
        "createdAt": "2026-02-07T20:35:00.000Z",
        "updatedAt": "2026-02-07T20:35:00.000Z"
      },
      {
        "id": "850e8400-e29b-41d4-a716-446655440013",
        "name": "Asian Cuisine",
        "imageUrl": "https://s3.amazonaws.com/bucket/cookbooks/uuid2.jpg",
        "recipeCount": 8,
        "createdAt": "2026-02-06T15:20:00.000Z",
        "updatedAt": "2026-02-06T15:20:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

**Error Responses:**
- `401` - Unauthorized

---

### 8. Get Cookbook by ID

**Endpoint:** `GET /api/cookbook/:id`

**Description:** Get detailed information about a specific cookbook

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the cookbook

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "cookbook": {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "name": "Italian Classics",
      "imageUrl": "https://s3.amazonaws.com/bucket/cookbooks/uuid.jpg",
      "recipeCount": 2,
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-02-07T20:35:00.000Z",
      "updatedAt": "2026-02-07T20:35:00.000Z"
    }
  }
}
```

**Error Responses:**
- `404` - Cookbook not found
- `403` - Not authorized to view this cookbook

---

### 9. Get Cookbook Recipes

**Endpoint:** `GET /api/cookbook/:id/recipes`

**Description:** Get all recipes from a specific cookbook

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the cookbook

**Query Parameters:**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "cookbook": {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "name": "Italian Classics"
    },
    "recipes": [
      {
        "id": "850e8400-e29b-41d4-a716-446655440003",
        "title": "Classic Spaghetti Carbonara",
        "servings": 4,
        "prepTime": "10 minutes",
        "cookTime": "15 minutes",
        "ingredientCount": 6,
        "instructionCount": 5,
        "createdAt": "2026-02-07T20:35:00.000Z"
      },
      {
        "id": "950e8400-e29b-41d4-a716-446655440014",
        "title": "Margherita Pizza",
        "servings": 2,
        "prepTime": "20 minutes",
        "cookTime": "12 minutes",
        "ingredientCount": 8,
        "instructionCount": 6,
        "createdAt": "2026-02-07T20:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

**Error Responses:**
- `404` - Cookbook not found
- `403` - Not authorized

---

### 10. Update Cookbook

**Endpoint:** `PUT /api/cookbook/:id`

**Description:** Update cookbook name

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the cookbook

**Request Body:**
```json
{
  "name": "Updated Cookbook Name"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "cookbook": {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "name": "Updated Cookbook Name",
      "imageUrl": "https://s3.amazonaws.com/bucket/cookbooks/uuid.jpg",
      "recipeCount": 2,
      "updatedAt": "2026-02-07T21:00:00.000Z"
    }
  },
  "message": "Cookbook updated successfully"
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Cookbook not found
- `403` - Not authorized

---

### 11. Delete Cookbook

**Endpoint:** `DELETE /api/cookbook/:id`

**Description:** Delete a cookbook and all its recipes

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the cookbook

**Success Response (200):**
```json
{
  "success": true,
  "message": "Cookbook and 15 recipes deleted successfully"
}
```

**Note:** This will cascade delete all recipes, ingredients, and instructions associated with the cookbook.

**Error Responses:**
- `404` - Cookbook not found
- `403` - Not authorized

---

## Recipes

### 12. Get Recipe by ID

**Endpoint:** `GET /api/recipe/:id`

**Description:** Get complete recipe details including ingredients and instructions

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the recipe

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "recipe": {
      "id": "850e8400-e29b-41d4-a716-446655440003",
      "title": "Classic Spaghetti Carbonara",
      "servings": 4,
      "prepTime": "10 minutes",
      "cookTime": "15 minutes",
      "cookbookId": "750e8400-e29b-41d4-a716-446655440002",
      "cookbookName": "Italian Classics",
      "createdAt": "2026-02-07T20:35:00.000Z",
      "ingredients": [
        {
          "id": "950e8400-e29b-41d4-a716-446655440004",
          "name": "spaghetti",
          "quantity": "400",
          "unit": "g",
          "normalized": "spaghetti"
        },
        {
          "id": "a50e8400-e29b-41d4-a716-446655440005",
          "name": "eggs",
          "quantity": "4",
          "unit": "whole",
          "normalized": "egg"
        },
        {
          "id": "b50e8400-e29b-41d4-a716-446655440006",
          "name": "pancetta",
          "quantity": "200",
          "unit": "g",
          "normalized": "pancetta"
        },
        {
          "id": "c50e8400-e29b-41d4-a716-446655440015",
          "name": "parmesan cheese",
          "quantity": "100",
          "unit": "g",
          "normalized": "parmesan"
        },
        {
          "id": "d50e8400-e29b-41d4-a716-446655440016",
          "name": "black pepper",
          "quantity": "1",
          "unit": "tsp",
          "normalized": "black pepper"
        },
        {
          "id": "e50e8400-e29b-41d4-a716-446655440017",
          "name": "salt",
          "quantity": "to taste",
          "unit": "",
          "normalized": "salt"
        }
      ],
      "instructions": [
        {
          "id": "f50e8400-e29b-41d4-a716-446655440018",
          "stepNumber": 1,
          "instruction": "Bring a large pot of salted water to boil"
        },
        {
          "id": "050e8400-e29b-41d4-a716-446655440019",
          "stepNumber": 2,
          "instruction": "Cook spaghetti according to package directions until al dente"
        },
        {
          "id": "150e8400-e29b-41d4-a716-446655440020",
          "stepNumber": 3,
          "instruction": "While pasta cooks, fry pancetta in a large pan until crispy"
        },
        {
          "id": "250e8400-e29b-41d4-a716-446655440021",
          "stepNumber": 4,
          "instruction": "Beat eggs with grated parmesan and black pepper"
        },
        {
          "id": "350e8400-e29b-41d4-a716-446655440022",
          "stepNumber": 5,
          "instruction": "Drain pasta, add to pancetta pan, remove from heat, and quickly stir in egg mixture"
        }
      ]
    }
  }
}
```

**Error Responses:**
- `404` - Recipe not found
- `403` - Not authorized

---

### 13. Match Recipes with Fridge

**Endpoint:** `POST /api/recipes/match`

**Description:** Find recipes that can be made with ingredients in your fridge

**Authentication:** Required

**Request Body:**
```json
{
  "minMatchPercentage": 75,
  "includePartialMatches": true,
  "cookbookId": "750e8400-e29b-41d4-a716-446655440002"
}
```

**Field Descriptions:**
- `minMatchPercentage` (optional): Minimum match % to return, default 50
- `includePartialMatches` (optional): Include recipes with missing ingredients, default true
- `cookbookId` (optional): Filter by specific cookbook, default all cookbooks

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "recipe": {
          "id": "850e8400-e29b-41d4-a716-446655440003",
          "title": "Classic Spaghetti Carbonara",
          "servings": 4,
          "prepTime": "10 minutes",
          "cookTime": "15 minutes",
          "cookbookName": "Italian Classics"
        },
        "matchPercentage": 100,
        "matchType": "perfect",
        "totalIngredients": 6,
        "matchedIngredients": 6,
        "missingIngredients": [],
        "availableIngredients": [
          {
            "name": "spaghetti",
            "quantity": "400",
            "unit": "g",
            "inFridge": true
          },
          {
            "name": "eggs",
            "quantity": "4",
            "unit": "whole",
            "inFridge": true
          },
          {
            "name": "pancetta",
            "quantity": "200",
            "unit": "g",
            "inFridge": true
          },
          {
            "name": "parmesan cheese",
            "quantity": "100",
            "unit": "g",
            "inFridge": true
          },
          {
            "name": "black pepper",
            "quantity": "1",
            "unit": "tsp",
            "inFridge": true
          },
          {
            "name": "salt",
            "quantity": "to taste",
            "unit": "",
            "inFridge": true
          }
        ]
      },
      {
        "recipe": {
          "id": "950e8400-e29b-41d4-a716-446655440014",
          "title": "Margherita Pizza",
          "servings": 2,
          "prepTime": "20 minutes",
          "cookTime": "12 minutes",
          "cookbookName": "Italian Classics"
        },
        "matchPercentage": 75,
        "matchType": "partial",
        "totalIngredients": 8,
        "matchedIngredients": 6,
        "missingIngredients": [
          {
            "name": "pizza dough",
            "quantity": "1",
            "unit": "ball"
          },
          {
            "name": "fresh basil",
            "quantity": "10",
            "unit": "leaves"
          }
        ],
        "availableIngredients": [
          {
            "name": "tomato sauce",
            "quantity": "200",
            "unit": "ml",
            "inFridge": true
          },
          {
            "name": "mozzarella",
            "quantity": "250",
            "unit": "g",
            "inFridge": true
          }
        ]
      }
    ],
    "totalMatches": 2,
    "perfectMatches": 1,
    "partialMatches": 1
  }
}
```

**Match Types:**
- `perfect`: 100% of ingredients available
- `partial`: 50-99% of ingredients available

**Matching Algorithm:**
- Uses fuzzy matching for ingredient names
- Normalizes ingredient names (e.g., "tomato" matches "tomatoes")
- Ignores common ingredients (salt, pepper, water, oil)
- Sorts by match percentage (highest first)

**Error Responses:**
- `400` - Validation error
- `404` - No fridge inventory found (scan fridge first)

---

## Fridge Inventory

### 14. Get Fridge Inventory

**Endpoint:** `GET /api/fridge/inventory`

**Description:** Get all items in user's fridge

**Authentication:** Required

**Query Parameters:**
- `category` (optional): Filter by category (dairy, meat, vegetables, fruits, grains, condiments)
- `sortBy` (optional): Sort field (name, addedAt, expiryDate), default addedAt
- `order` (optional): Sort order (asc, desc), default desc

**Example:**
```
GET /api/fridge/inventory?category=dairy&sortBy=name&order=asc
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "f50e8400-e29b-41d4-a716-446655440010",
        "name": "milk",
        "category": "dairy",
        "quantity": "1",
        "unit": "carton",
        "normalized": "milk",
        "freshness": "fresh",
        "confidence": 0.95,
        "expiryDate": "2026-02-14T00:00:00.000Z",
        "addedAt": "2026-02-07T20:40:00.000Z",
        "updatedAt": "2026-02-07T20:40:00.000Z"
      },
      {
        "id": "050e8400-e29b-41d4-a716-446655440011",
        "name": "eggs",
        "category": "dairy",
        "quantity": "12",
        "unit": "pieces",
        "normalized": "egg",
        "freshness": "fresh",
        "confidence": 0.92,
        "expiryDate": null,
        "addedAt": "2026-02-07T20:40:00.000Z",
        "updatedAt": "2026-02-07T20:40:00.000Z"
      }
    ],
    "totalItems": 2,
    "categories": {
      "dairy": 2,
      "vegetables": 0,
      "meat": 0,
      "fruits": 0,
      "grains": 0,
      "condiments": 0,
      "other": 0
    }
  }
}
```

**Error Responses:**
- `401` - Unauthorized

---

### 15. Add Fridge Items Manually

**Endpoint:** `POST /api/fridge/inventory`

**Description:** Manually add items to fridge inventory

**Authentication:** Required

**Request Body:**
```json
{
  "items": [
    {
      "name": "chicken breast",
      "category": "meat",
      "quantity": "500",
      "unit": "g",
      "expiryDate": "2026-02-10"
    },
    {
      "name": "broccoli",
      "category": "vegetables",
      "quantity": "2",
      "unit": "heads"
    }
  ]
}
```

**Field Descriptions:**
- `name` (required): Item name
- `category` (required): One of: dairy, meat, vegetables, fruits, grains, condiments, other
- `quantity` (required): Quantity as string
- `unit` (required): Unit of measurement
- `expiryDate` (optional): ISO date string

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "450e8400-e29b-41d4-a716-446655440023",
        "name": "chicken breast",
        "category": "meat",
        "quantity": "500",
        "unit": "g",
        "normalized": "chicken breast",
        "freshness": "fresh",
        "confidence": 1.0,
        "expiryDate": "2026-02-10T00:00:00.000Z",
        "addedAt": "2026-02-07T21:10:00.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440024",
        "name": "broccoli",
        "category": "vegetables",
        "quantity": "2",
        "unit": "heads",
        "normalized": "broccoli",
        "freshness": "fresh",
        "confidence": 1.0,
        "expiryDate": null,
        "addedAt": "2026-02-07T21:10:00.000Z"
      }
    ],
    "itemsAdded": 2
  },
  "message": "2 items added to fridge"
}
```

**Error Responses:**
- `400` - Validation error (invalid category, missing fields)

---

### 16. Update Fridge Item

**Endpoint:** `PUT /api/fridge/item/:id`

**Description:** Update a fridge item's details

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the fridge item

**Request Body:**
```json
{
  "quantity": "250",
  "unit": "g",
  "expiryDate": "2026-02-12",
  "freshness": "moderate"
}
```

**All fields are optional. Only include fields you want to update.**

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "item": {
      "id": "450e8400-e29b-41d4-a716-446655440023",
      "name": "chicken breast",
      "category": "meat",
      "quantity": "250",
      "unit": "g",
      "normalized": "chicken breast",
      "freshness": "moderate",
      "confidence": 1.0,
      "expiryDate": "2026-02-12T00:00:00.000Z",
      "updatedAt": "2026-02-07T21:15:00.000Z"
    }
  },
  "message": "Item updated successfully"
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Item not found
- `403` - Not authorized

---

### 17. Delete Fridge Item

**Endpoint:** `DELETE /api/fridge/item/:id`

**Description:** Remove a single item from fridge

**Authentication:** Required

**URL Parameters:**
- `id`: UUID of the fridge item

**Success Response (200):**
```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

**Error Responses:**
- `404` - Item not found
- `403` - Not authorized

---

### 18. Clear Fridge Inventory

**Endpoint:** `DELETE /api/fridge/inventory`

**Description:** Remove all items from fridge

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Fridge inventory cleared. 12 items removed."
}
```

**Error Responses:**
- `401` - Unauthorized

---

## Error Codes

All error responses include a `code` field for programmatic handling:

### Authentication Errors
- `UNAUTHORIZED` - Invalid or missing token
- `TOKEN_EXPIRED` - JWT token has expired
- `INVALID_CREDENTIALS` - Wrong email/password

### Validation Errors
- `VALIDATION_ERROR` - Request body validation failed
- `INVALID_IMAGE` - Image format not supported
- `IMAGE_TOO_LARGE` - Image exceeds 10MB limit

### Resource Errors
- `NOT_FOUND` - Resource doesn't exist
- `FORBIDDEN` - Not authorized to access resource
- `CONFLICT` - Resource already exists (e.g., duplicate email)

### AI Processing Errors
- `AI_PROCESSING_FAILED` - Gemini AI error
- `NO_RECIPES_FOUND` - No recipes detected in image
- `NO_ITEMS_FOUND` - No food items detected in image
- `INVALID_COOKBOOK_IMAGE` - Image doesn't appear to be a cookbook page
- `EMPTY_FRIDGE` - No items in fridge inventory

### Rate Limiting
- `RATE_LIMIT_EXCEEDED` - Too many requests

### Server Errors
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed
- `S3_UPLOAD_ERROR` - Failed to upload to S3

---

## Rate Limits

**Per User:**
- General API: 1000 requests/hour
- Cookbook scanning: 10 scans/hour
- Fridge scanning: 20 scans/hour

**Rate limit headers in response:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1675872000
```

---

## Image Requirements

**Supported Formats:**
- JPEG (.jpg, .jpeg)
- PNG (.png)

**Size Limits:**
- Maximum: 10MB
- Recommended: 2-5MB for faster processing

**Image Quality Tips:**
- Good lighting
- Clear focus
- Minimal glare
- Full page/fridge visible
- Avoid extreme angles

---

## Best Practices

### Token Management
1. Store tokens securely (encrypted storage, not localStorage)
2. Refresh tokens before expiry
3. Handle 401 errors by redirecting to login
4. Clear tokens on logout

### Image Uploads
1. Compress images before upload
2. Show upload progress to user
3. Handle upload failures gracefully
4. Validate file type on client side

### Error Handling
1. Check `success` field in response
2. Display user-friendly error messages
3. Log errors for debugging
4. Implement retry logic for network errors

### Performance
1. Cache cookbook/recipe lists
2. Paginate large lists
3. Debounce search inputs
4. Use optimistic UI updates

---

## Example Integration (React Native)

```javascript
// API Client Setup
const API_BASE_URL = 'https://your-app.up.railway.app';

class CookbookAPI {
  constructor(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  }

  // Authentication
  async register(email, password, name) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    return response.json();
  }

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  // Scanning
  async scanCookbook(imageUri, cookbookName) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'cookbook.jpg',
    });
    formData.append('cookbookName', cookbookName);

    const response = await fetch(`${API_BASE_URL}/api/scan/cookbook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    return response.json();
  }

  async scanFridge(imageUri) {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'fridge.jpg',
    });

    const response = await fetch(`${API_BASE_URL}/api/scan/fridge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    return response.json();
  }

  // Cookbooks
  async getCookbooks(page = 1, limit = 20) {
    return this.request(`/api/cookbooks?page=${page}&limit=${limit}`);
  }

  async getCookbook(id) {
    return this.request(`/api/cookbook/${id}`);
  }

  async getCookbookRecipes(id) {
    return this.request(`/api/cookbook/${id}/recipes`);
  }

  // Recipes
  async getRecipe(id) {
    return this.request(`/api/recipe/${id}`);
  }

  async matchRecipes(options = {}) {
    return this.request('/api/recipes/match', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  // Fridge
  async getFridgeInventory() {
    return this.request('/api/fridge/inventory');
  }

  async addFridgeItems(items) {
    return this.request('/api/fridge/inventory', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async updateFridgeItem(id, updates) {
    return this.request(`/api/fridge/item/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteFridgeItem(id) {
    return this.request(`/api/fridge/item/${id}`, {
      method: 'DELETE',
    });
  }
}

// Usage Example
const api = new CookbookAPI(userToken);

// Scan cookbook
const result = await api.scanCookbook(imageUri, 'My Cookbook');
console.log(`Found ${result.recipes.length} recipes`);

// Match recipes
const matches = await api.matchRecipes({
  minMatchPercentage: 75,
  includePartialMatches: true,
});
console.log(`Found ${matches.totalMatches} matching recipes`);
```

---

## Support

For issues or questions:
- Check error messages and codes
- Review this documentation
- Check Railway logs
- Open GitHub issue

---

**API Version:** 1.0.0  
**Last Updated:** February 7, 2026  
**Base URL:** `https://your-app.up.railway.app`
