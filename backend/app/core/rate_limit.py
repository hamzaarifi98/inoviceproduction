from time import monotonic

from fastapi import HTTPException, Request, status


_attempts: dict[str, list[float]] = {}


def enforce_rate_limit(
    request: Request,
    scope: str,
    identifier: str,
    *,
    max_attempts: int = 5,
    window_seconds: int = 300,
) -> None:
    client_host = request.client.host if request.client else "unknown"
    key = f"{scope}:{client_host}:{identifier.lower()}"
    now = monotonic()
    window_start = now - window_seconds

    recent_attempts = [
        attempted_at
        for attempted_at in _attempts.get(key, [])
        if attempted_at >= window_start
    ]

    if len(recent_attempts) >= max_attempts:
        _attempts[key] = recent_attempts
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later.",
        )

    recent_attempts.append(now)
    _attempts[key] = recent_attempts
