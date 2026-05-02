import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting in test environments to avoid cross-test interference
_testing = os.getenv("TESTING", "false").lower() == "true"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    enabled=not _testing,
)
