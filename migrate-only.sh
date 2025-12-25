#!/bin/bash
set -e

echo "========================================="
echo "🔄 RUNNING DATABASE MIGRATION ONLY"
echo "========================================="
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi

echo "✓ DATABASE_URL is configured"
echo ""

echo "📦 Running drizzle-kit push..."
npx drizzle-kit push --verbose

echo ""
echo "========================================="
echo "✅ MIGRATION COMPLETE!"
echo "========================================="
echo ""
echo "Now you can start the server normally."
echo "Press Ctrl+C to exit."

# Keep container alive so you can verify migration worked
sleep infinity
