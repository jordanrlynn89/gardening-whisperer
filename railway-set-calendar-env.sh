#!/bin/bash

# Set Google Calendar environment variable in Railway
# Make sure you're logged in: railway login

echo "Setting NEXT_PUBLIC_GOOGLE_CLIENT_ID in Railway..."

# Read from .env.local
CLIENT_ID=$(grep NEXT_PUBLIC_GOOGLE_CLIENT_ID .env.local | cut -d '=' -f2)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ Could not find NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local"
  exit 1
fi

echo "Using Client ID: $CLIENT_ID"

# Set in Railway (requires railway CLI: npm install -g @railway/cli)
railway variables set NEXT_PUBLIC_GOOGLE_CLIENT_ID="$CLIENT_ID"

echo "✅ Environment variable set. Redeploy for changes to take effect:"
echo "   railway up"
