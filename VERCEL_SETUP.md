# Vercel Setup Instructions

## Step 1: Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import the repository: `jdefouw/EvoNash`
4. Vercel will auto-detect Next.js

## Step 2: Configure Project Settings

1. **Root Directory**: Set to `web` (the Next.js app is in the `/web` subdirectory)
2. **Framework Preset**: Next.js (auto-detected)
3. **Build Command**: `cd web && npm install && npm run build` (or leave default)
4. **Output Directory**: `web/.next` (or leave default)

## Step 3: Set Environment Variables

In the Vercel project settings, add these environment variables:

### Required Variables

- **NEXT_PUBLIC_SUPABASE_URL**
  - Value: `https://kcoisjvkakxmcxnijmvu.supabase.co`
  - Environment: Production, Preview, Development

- **NEXT_PUBLIC_SUPABASE_ANON_KEY**
  - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjb2lzanZrYWt4bWN4bmlqbXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2Nzg4MjEsImV4cCI6MjA4NDI1NDgyMX0.xb8oToRpuuWeNGq4bcSui-nMMqh798rJ5ftXAu7A3U8`
  - Environment: Production, Preview, Development

- **SUPABASE_URL**
  - Value: `https://kcoisjvkakxmcxnijmvu.supabase.co`
  - Environment: Production, Preview, Development

- **SUPABASE_SERVICE_ROLE_KEY**
  - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjb2lzanZrYWt4bWN4bmlqbXZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3ODgyMSwiZXhwIjoyMDg0MjU0ODIxfQ.Yv4v6F6JbrrpkE9DyBEA1Kq1xoa1wRIfbKwRK5l9qh0`
  - Environment: Production, Preview, Development

## Step 4: Deploy

1. Click "Deploy"
2. Vercel will automatically:
   - Install dependencies
   - Build the Next.js app
   - Deploy to production
3. Future pushes to the main branch will trigger automatic deployments

## Step 5: Verify Deployment

1. Visit your Vercel deployment URL
2. Check that the dashboard loads correctly
3. Verify Supabase connection by creating a test experiment

## Troubleshooting

- **Build fails**: Check that the root directory is set to `web`
- **Environment variables not working**: Ensure all variables are set for the correct environments
- **Database connection errors**: Verify Supabase credentials are correct
