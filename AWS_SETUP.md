# AWS S3 Setup Guide

This guide will walk you through setting up AWS S3 for storing cookbook and fridge images.

## Step 1: Create an AWS Account

1. Go to [AWS Console](https://aws.amazon.com/)
2. Click **"Create an AWS Account"**
3. Follow the signup process (requires credit card)

## Step 2: Create an S3 Bucket

### 2.1 Navigate to S3

1. Sign in to [AWS Console](https://console.aws.amazon.com/)
2. Search for **"S3"** in the top search bar
3. Click on **"S3"** to open the S3 dashboard

### 2.2 Create Bucket

1. Click **"Create bucket"**
2. Configure bucket settings:

**Bucket name:** (must be globally unique)
```
cookbook-app-images-prod
```
Or use your own unique name like: `your-company-cookbook-images`

**AWS Region:** Choose closest to your users
```
US East (N. Virginia) us-east-1
```
Or choose: `us-west-1`, `eu-west-1`, etc.

**Object Ownership:**
- Select **"ACLs disabled (recommended)"**

**Block Public Access settings:**
- ✅ Keep **"Block all public access"** CHECKED
- We'll use signed URLs for secure access

**Bucket Versioning:**
- Optional: Enable if you want version history

**Default encryption:**
- Select **"Server-side encryption with Amazon S3 managed keys (SSE-S3)"**

3. Click **"Create bucket"**

## Step 3: Configure CORS (Required)

Your app needs CORS configured to upload images from the browser/app.

1. Click on your newly created bucket
2. Go to **"Permissions"** tab
3. Scroll down to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit"**
5. Paste this configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**For production**, replace `"*"` in AllowedOrigins with your actual domains:
```json
"AllowedOrigins": [
    "https://your-app.up.railway.app",
    "https://yourdomain.com"
]
```

6. Click **"Save changes"**

## Step 4: Create IAM User

### 4.1 Navigate to IAM

1. Search for **"IAM"** in the AWS Console
2. Click on **"IAM"** (Identity and Access Management)

### 4.2 Create User

1. Click **"Users"** in the left sidebar
2. Click **"Create user"**
3. **User name:** `cookbook-app-s3-user`
4. Click **"Next"**

### 4.3 Set Permissions

1. Select **"Attach policies directly"**
2. Search for **"AmazonS3FullAccess"** and check it
   
   **OR for better security**, create a custom policy (recommended):
   
   - Click **"Create policy"**
   - Select **"JSON"** tab
   - Paste this policy (replace `YOUR-BUCKET-NAME`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME",
                "arn:aws:s3:::YOUR-BUCKET-NAME/*"
            ]
        }
    ]
}
```

   - Click **"Next"**
   - **Policy name:** `CookbookAppS3Policy`
   - Click **"Create policy"**
   - Go back to user creation and attach this policy

3. Click **"Next"**
4. Click **"Create user"**

## Step 5: Create Access Keys

1. Click on the user you just created (`cookbook-app-s3-user`)
2. Go to **"Security credentials"** tab
3. Scroll down to **"Access keys"**
4. Click **"Create access key"**
5. Select **"Application running outside AWS"**
6. Click **"Next"**
7. (Optional) Add description: `Cookbook App Backend`
8. Click **"Create access key"**

### ⚠️ IMPORTANT: Save These Credentials

You'll see:
- **Access key ID**: `AKIAIOSFODNN7EXAMPLE` (example)
- **Secret access key**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (example)

**Copy both values immediately!** You won't be able to see the secret key again.

9. Click **"Download .csv file"** (recommended)
10. Click **"Done"**

## Step 6: Add to Railway Environment Variables

Go to your Railway project and add these environment variables:

```
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
AWS_REGION=us-east-1
S3_BUCKET_NAME=cookbook-app-images-prod
```

Replace with your actual values:
- `AWS_ACCESS_KEY_ID`: The access key from Step 5
- `AWS_SECRET_ACCESS_KEY`: The secret key from Step 5
- `AWS_REGION`: The region you chose in Step 2
- `S3_BUCKET_NAME`: Your bucket name from Step 2

## Step 7: Test Your Setup

After deploying to Railway, test the S3 integration:

### Test Image Upload

```bash
curl -X POST https://your-app.up.railway.app/api/scan/cookbook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/test-image.jpg" \
  -F "cookbookName=Test Cookbook"
```

If successful, you should see:
- Image uploaded to S3
- Recipe data extracted
- S3 URL in the response

### Check S3 Bucket

1. Go to your S3 bucket in AWS Console
2. You should see folders: `cookbooks/` and `fridge/`
3. Images will be stored with UUID filenames

## Folder Structure in S3

Your images will be organized like this:

```
cookbook-app-images-prod/
├── cookbooks/
│   ├── uuid-1.jpg
│   ├── uuid-2.jpg
│   └── uuid-3.jpg
└── fridge/
    ├── uuid-4.jpg
    ├── uuid-5.jpg
    └── uuid-6.jpg
```

## Security Best Practices

### ✅ DO:
- Keep your AWS credentials secret
- Use IAM user with minimal permissions (not root account)
- Enable S3 bucket encryption
- Block public access to bucket
- Use signed URLs for temporary access
- Rotate access keys periodically
- Monitor S3 usage and costs

### ❌ DON'T:
- Never commit AWS credentials to Git
- Don't use root account credentials
- Don't make bucket publicly accessible
- Don't share access keys
- Don't use same keys for multiple apps

## Cost Estimation

AWS S3 pricing (as of 2026):

**Storage:**
- First 50 TB: $0.023 per GB/month
- Example: 10 GB = ~$0.23/month

**Requests:**
- PUT/POST: $0.005 per 1,000 requests
- GET: $0.0004 per 1,000 requests

**Data Transfer:**
- First 100 GB/month: Free
- After: $0.09 per GB

**Example monthly cost for small app:**
- 1,000 images (~5 GB): $0.12
- 10,000 uploads: $0.05
- 50,000 views: $0.02
- **Total: ~$0.20/month**

## Troubleshooting

### "Access Denied" Error

**Solution:**
- Check IAM user has correct permissions
- Verify bucket name is correct
- Ensure AWS credentials are set in Railway

### "Bucket not found" Error

**Solution:**
- Verify `S3_BUCKET_NAME` matches exactly
- Check `AWS_REGION` is correct
- Bucket names are case-sensitive

### CORS Error

**Solution:**
- Add CORS configuration (Step 3)
- Include your Railway domain in AllowedOrigins
- Redeploy after CORS changes

### Images not uploading

**Solution:**
- Check Railway logs for specific errors
- Verify all AWS environment variables are set
- Test AWS credentials with AWS CLI locally

## Optional: AWS CLI Setup (for testing)

Install AWS CLI to test credentials locally:

```bash
# Install AWS CLI
brew install awscli  # macOS
# or
pip install awscli  # Python

# Configure credentials
aws configure

# Test access
aws s3 ls s3://your-bucket-name
```

## Monitoring & Maintenance

### View S3 Metrics

1. Go to S3 Console
2. Click on your bucket
3. Go to **"Metrics"** tab
4. View storage, requests, and data transfer

### Set Up Billing Alerts

1. Go to AWS Billing Dashboard
2. Click **"Budgets"**
3. Create budget alert (e.g., alert if cost > $5/month)

### Clean Up Old Images (Optional)

Set up lifecycle rules to delete old images:

1. Go to your S3 bucket
2. Click **"Management"** tab
3. Click **"Create lifecycle rule"**
4. Example: Delete images older than 90 days

## Alternative: Use Cloudflare R2 (S3-Compatible)

If you want to avoid AWS costs, consider Cloudflare R2:
- S3-compatible API (same code works)
- 10 GB storage free
- Zero egress fees
- Cheaper than S3

Just change the endpoint in your code and use R2 credentials.

## Summary

You now have:
- ✅ S3 bucket created
- ✅ CORS configured
- ✅ IAM user with proper permissions
- ✅ Access keys generated
- ✅ Environment variables set in Railway
- ✅ Ready to upload images!

## Next Steps

1. Deploy your app to Railway
2. Test image uploads
3. Monitor S3 usage
4. Set up billing alerts

---

**Need help?** Check AWS documentation or Railway logs for specific errors.
