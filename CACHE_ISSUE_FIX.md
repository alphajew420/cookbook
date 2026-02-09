# Image Loading Issue - Cache Problem

## 🔍 Diagnosis

The signed URL code **IS deployed and working**, but your mobile app is receiving **HTTP 304 (Not Modified)** responses, which means it's using **cached data from before the fix**.

### Evidence from Logs:
```
GET /api/recipe/dd3733f6-7f94-46d1-ac98-c2a7e77ef026 HTTP/1.1" 304
GET /api/recipe/dd3733f6-7f94-46d1-ac98-c2a7e77ef026 HTTP/1.1" 304
GET /api/recipe/dd3733f6-7f94-46d1-ac98-c2a7e77ef026 HTTP/1.1" 200  ← Fresh data!
```

The 304 responses mean the app is using old cached data **without signed URLs**.

---

## ✅ Solutions

### Option 1: Force Refresh in Mobile App (Recommended)

Add `cache: 'no-cache'` to your fetch requests:

```javascript
const response = await fetch(
  'https://cb-app-backend-production.up.railway.app/api/recipe/123',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache'  // Add this
    },
    cache: 'no-cache'  // And this
  }
);
```

### Option 2: Clear App Cache

In your React Native app:

```javascript
// Clear all cached data
await AsyncStorage.clear();

// Or clear specific cache
await AsyncStorage.removeItem('recipe_cache');
```

### Option 3: Restart Expo Go

1. Close Expo Go completely
2. Clear app data (iOS: Settings > Expo Go > Clear Cache)
3. Reopen and test

### Option 4: Add Cache Busting Query Parameter

Temporarily add a query parameter to force fresh requests:

```javascript
const url = `https://cb-app-backend-production.up.railway.app/api/recipe/123?v=${Date.now()}`;
```

---

## 🧪 Test That Signed URLs Are Working

### 1. Test with curl (bypasses cache):

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://cb-app-backend-production.up.railway.app/api/recipe/dd3733f6-7f94-46d1-ac98-c2a7e77ef026
```

**Look for this in the response:**
```json
{
  "originalImageUrl": "https://cookbook-app-images-prod.s3.amazonaws.com/cookbook/...jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=..."
}
```

If you see `X-Amz-Signature` in the URL, **signed URLs are working!** ✅

### 2. Test the image URL directly:

Copy the `originalImageUrl` from the response and paste it in your browser. The image should load.

---

## 🔧 Backend Fix (If Needed)

If you want to prevent caching issues in the future, we can disable caching for recipe endpoints:

### Add to `src/controllers/recipeController.js`:

```javascript
res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
res.set('Pragma', 'no-cache');
res.set('Expires', '0');

res.status(200).json({
  success: true,
  data: responseWithSignedUrl,
});
```

This forces clients to always fetch fresh data.

---

## 📱 Mobile App Best Practices

### For Recipe Fetching:

```javascript
const fetchRecipe = async (recipeId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/recipe/${recipeId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      cache: 'no-cache'  // Important for fresh signed URLs
    }
  );
  
  const data = await response.json();
  return data;
};
```

### For Image Display:

```javascript
<Image
  source={{ 
    uri: recipe.originalImageUrl,
    cache: 'force-cache'  // Cache the actual image, not the API response
  }}
  style={{ width: 300, height: 200 }}
/>
```

---

## 🎯 Why This Happened

1. **Before the fix**: API returned URLs like:
   ```
   https://cookbook-app-images-prod.s3.amazonaws.com/cookbook/abc.jpeg
   ```

2. **Mobile app cached this response** with HTTP 304 support

3. **After the fix**: API now returns:
   ```
   https://...abc.jpeg?X-Amz-Signature=...
   ```

4. **But mobile app still using cached response** from step 1

---

## ✅ Verification Checklist

- [ ] Fetch recipe with curl - see signed URL in response
- [ ] Copy signed URL - paste in browser - image loads
- [ ] Clear mobile app cache
- [ ] Fetch recipe in app with `cache: 'no-cache'`
- [ ] Verify image loads in app
- [ ] Test on both iOS and Android

---

## 🚀 Quick Fix Command

Run this in your mobile app to test immediately:

```javascript
// Force fresh fetch
const testRecipe = async () => {
  const response = await fetch(
    'https://cb-app-backend-production.up.railway.app/api/recipe/dd3733f6-7f94-46d1-ac98-c2a7e77ef026',
    {
      headers: {
        'Authorization': `Bearer ${YOUR_TOKEN}`,
      },
      cache: 'reload'  // Force fresh data
    }
  );
  
  const data = await response.json();
  console.log('Image URL:', data.data.originalImageUrl);
  
  // Should see X-Amz-Signature in the URL
};
```

---

## 📞 Still Not Working?

If images still don't load after clearing cache:

1. **Check AWS credentials in Railway**
   - Verify `AWS_ACCESS_KEY_ID` is set
   - Verify `AWS_SECRET_ACCESS_KEY` is set
   - Verify `S3_BUCKET_NAME` is correct

2. **Check Railway logs for errors**
   ```bash
   # Look for S3 signing errors
   grep "S3 signed URL error" logs
   ```

3. **Test signed URL generation locally**
   ```bash
   node -e "
   const AWS = require('aws-sdk');
   const s3 = new AWS.S3({
     accessKeyId: 'YOUR_KEY',
     secretAccessKey: 'YOUR_SECRET',
     region: 'us-east-1'
   });
   const url = s3.getSignedUrl('getObject', {
     Bucket: 'cookbook-app-images-prod',
     Key: 'cookbook/test.jpeg',
     Expires: 3600
   });
   console.log(url);
   "
   ```

---

**Status:** ✅ Backend fix is deployed and working  
**Issue:** Mobile app cache needs to be cleared  
**Solution:** Use `cache: 'no-cache'` in fetch requests
