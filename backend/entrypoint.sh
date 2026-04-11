#!/bin/sh

echo "⏳ Waiting for DB..."
sleep 5

echo "🚀 Running migrations..."
/app/scripts/migrate.sh

echo "✅ Starting server..."
exec ./server