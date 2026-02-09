# Fridge Scan History Feature - Backend Implementation

## ✅ Implementation Complete

All backend changes for the fridge scan history feature have been implemented.

## Changes Made

### 1. Database Migration
**File:** `src/database/add_scan_job_id_to_fridge_items.sql`

Added `scan_job_id` column to the `fridge_items` table:
- Column type: `UUID` (nullable)
- Foreign key constraint to `scan_jobs(id)` with `ON DELETE SET NULL`
- Indexes created for performance:
  - `idx_fridge_items_scan_job_id` - single column index
  - `idx_fridge_items_user_scan_job` - composite index for user + scan_job queries

**To apply migration:**
```bash
psql -U your_user -d your_database -f src/database/add_scan_job_id_to_fridge_items.sql
```

### 2. Scan Worker Updates
**File:** `src/workers/scanWorker.js`

Updated the fridge scan processor to link items with their scan job:
- Modified `INSERT` statement to include `scan_job_id` parameter
- All new fridge items created from scans will have the `jobId` associated

### 3. New Endpoint: Get Scan Job Items
**Endpoint:** `GET /api/scan/jobs/:jobId/items`

**Controller:** `src/controllers/scanJobsController.js` - `getScanJobItems()`
**Route:** `src/routes/scanJobs.js`

**Request:**
```
GET /api/scan/jobs/:jobId/items
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scanJob": {
      "id": "scan_123",
      "scanType": "fridge",
      "status": "completed",
      "itemsFound": 5,
      "createdAt": "2026-02-08T10:00:00Z",
      "completedAt": "2026-02-08T10:01:30Z"
    },
    "items": [
      {
        "id": "item_1",
        "name": "Milk",
        "quantity": "1",
        "category": "dairy",
        "freshness": "fresh",
        "packaging": "carton",
        "confidence": "high",
        "expiryDate": null,
        "scanJobId": "scan_123",
        "createdAt": "2026-02-08T10:00:00Z",
        "updatedAt": "2026-02-08T10:00:00Z"
      }
    ]
  }
}
```

**Error Cases:**
- `404` - Scan job not found
- `400` - Invalid scan type (only fridge scans have items)

### 4. Updated Fridge Inventory Endpoint
**File:** `src/controllers/fridgeController.js` - `getInventory()`

The `GET /api/fridge/inventory` endpoint now includes `scanJobId` in the response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "item_1",
        "name": "Milk",
        "quantity": "1",
        "category": "dairy",
        "freshness": "fresh",
        "packaging": "carton",
        "confidence": "high",
        "expiryDate": null,
        "scanJobId": "scan_123",  // NEW FIELD
        "createdAt": "2026-02-08T10:00:00Z",
        "updatedAt": "2026-02-08T10:00:00Z"
      }
    ],
    "totalItems": 1,
    "categories": {
      "dairy": 1
    }
  }
}
```

## Answers to Frontend Team Questions

### 1. Item Deletion: When a scan job is deleted, what happens to items?

**Answer:** Items have their `scanJobId` set to `NULL` (not deleted).

**Rationale:**
- Users may want to keep the items even after deleting the scan history
- Items can be manually added or edited after scanning
- Setting to `NULL` preserves user data while removing the scan association
- The foreign key constraint uses `ON DELETE SET NULL`

**Behavior:**
- Deleting a scan job will NOT delete the items
- Items will remain in the fridge inventory
- The `scanJobId` field will be `null` for those items
- Users can manually delete items if they want to remove them

### 2. Duplicate Items: If the same item appears in multiple scans?

**Answer:** Create separate entries for each scan.

**Rationale:**
- Each scan represents a snapshot in time
- Users can see what was detected in each individual scan
- Allows tracking of inventory changes over time
- Simpler implementation with no complex merging logic

**Behavior:**
- If "Milk" is detected in Scan A and Scan B, two separate database entries are created
- Each entry has its own `scanJobId` linking it to the respective scan
- Users can manually delete duplicates if needed
- Future enhancement: Could add duplicate detection/merging UI feature

**Note:** If `replaceExisting=true` is passed to the scan endpoint, all previous items are deleted before adding new ones, preventing duplicates in that case.

### 3. Item Updates: If a user manually updates an item, should it maintain its scanJobId?

**Answer:** YES, maintain the `scanJobId`.

**Rationale:**
- The `scanJobId` represents the origin/source of the item
- Manual updates don't change where the item came from
- Users can still see which scan originally detected the item
- Preserves historical tracking

**Behavior:**
- When a user updates an item (quantity, name, expiry date, etc.), the `scanJobId` remains unchanged
- The `updated_at` timestamp will reflect the manual edit
- Items manually added (not from a scan) will have `scanJobId = null`

## Migration Strategy for Existing Data

### Recommended Approach: Retroactive Association (Option 1)

**For existing fridge items without a `scanJobId`:**
- Leave them as-is (`scanJobId = NULL`)
- Only new scans will have associated items
- Users can manually delete old items if needed

**Benefits:**
- Simple and safe
- No data manipulation required
- Clear distinction between old and new items
- No risk of incorrect associations

**Frontend Handling:**
- Items with `scanJobId = null` can be shown in a special "Unassociated Items" section
- Or simply mixed with scanned items (frontend's choice)

## Testing Checklist

- [x] Database migration script created
- [x] Scan worker links items to scan jobs
- [x] New endpoint `GET /api/scan/jobs/:jobId/items` implemented
- [x] Fridge inventory endpoint includes `scanJobId`
- [ ] **TODO:** Run database migration on dev/staging
- [ ] **TODO:** Test scan job creation populates `itemsFound` correctly
- [ ] **TODO:** Test items created from scan have correct `scanJobId`
- [ ] **TODO:** Test new endpoint returns correct items
- [ ] **TODO:** Test deleting scan job sets `scanJobId` to null
- [ ] **TODO:** Test empty scans (0 items found) display correctly
- [ ] **TODO:** Test manually added items have `scanJobId = null`
- [ ] **TODO:** Test updating items preserves `scanJobId`

## API Summary

### Existing Endpoints (Already Working)
- ✅ `GET /api/scan/jobs` - List all scan jobs
- ✅ `GET /api/scan/jobs/:jobId` - Get single scan job
- ✅ `POST /api/scan/fridge?async=true` - Create fridge scan
- ✅ `DELETE /api/scan/jobs/:jobId` - Delete scan job
- ✅ `POST /api/scan/jobs/:jobId/retry` - Retry failed scan

### New Endpoints
- ✅ `GET /api/scan/jobs/:jobId/items` - Get items from specific scan

### Updated Endpoints
- ✅ `GET /api/fridge/inventory` - Now includes `scanJobId` field

## Deployment Steps

1. **Apply database migration:**
   ```bash
   psql -U your_user -d your_database -f src/database/add_scan_job_id_to_fridge_items.sql
   ```

2. **Deploy backend code:**
   - All changes are backward compatible
   - Existing items will have `scanJobId = null`
   - New scans will automatically link items

3. **Verify:**
   - Create a new fridge scan
   - Check that items have `scanJobId` populated
   - Test the new `/api/scan/jobs/:jobId/items` endpoint

## Notes

- The implementation is **backward compatible**
- Frontend fallback logic will continue to work
- No breaking changes to existing endpoints
- All new fields are nullable and optional
- Cache invalidation is handled automatically

## Questions or Issues?

Contact the backend team if you encounter any issues or need clarification.
