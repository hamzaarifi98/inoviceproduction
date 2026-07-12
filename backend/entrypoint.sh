#!/bin/sh
set -e

if [ -n "${GOOGLE_CREDENTIALS_JSON:-}" ]; then
    printf '%s' "$GOOGLE_CREDENTIALS_JSON" > /tmp/gcp-credentials.json
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-credentials.json
fi



if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running alembic migrations..."
    alembic upgrade head
fi

exec gunicorn app.main:app \
    --worker-class uvicorn_worker.UvicornWorker \
    --workers "${WEB_CONCURRENCY:-2}" \
    --bind 0.0.0.0:8000 \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --error-logfile -
