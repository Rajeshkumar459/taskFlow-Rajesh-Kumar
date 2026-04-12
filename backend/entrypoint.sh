#!/bin/sh

echo "Waiting for DB..."

until nc -z postgres "$POSTGRES_PORT"; do
  echo "DB is unavailable - sleeping"
  sleep 2
done

echo "DB is ready!"

echo "Running migrations..."
/app/scripts/migrate.sh

echo "Starting server..."
exec ./server