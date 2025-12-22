#!/bin/bash
set -e

echo "========================================="
echo "🔄 Starting Database Migration"
echo "========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    echo "Cannot proceed with migration."
    exit 1
fi

echo "✓ DATABASE_URL is configured"
echo "Database host: $(echo $DATABASE_URL | sed -E 's|.*@([^:/]+).*|\1|')"
echo ""

echo "📦 Running drizzle-kit push..."
echo ""

# Run the migration with verbose output
if npx drizzle-kit push --verbose; then
    echo ""
    echo "========================================="
    echo "✅ Migration completed successfully!"
    echo "========================================="
    echo ""
    exit 0
else
    echo ""
    echo "========================================="
    echo "⚠️  Migration encountered issues"
    echo "========================================="
    echo ""
    echo "The server will still start, but some features may not work."
    echo "Check the logs above for details."
    echo ""
    exit 0  # Don't fail the deployment
fi
