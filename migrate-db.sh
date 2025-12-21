#!/bin/bash
set -e

echo "Running database migration..."
npm run db:push
echo "Migration complete!"
