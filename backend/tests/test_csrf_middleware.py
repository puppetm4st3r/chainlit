"""CSRF exemptions for session file bytes, including office artifact POSTs."""

from __future__ import annotations

from starlette.requests import Request

from chainlit.middleware.csrf import CSRFMiddleware


def _request(method: str, path: str) -> Request:
    """Build a minimal ASGI request for CSRF path classification."""
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("test", 123),
            "server": ("test", 80),
        }
    )


def test_office_artifact_posts_match_session_file_csrf_exemption():
    middleware = CSRFMiddleware(lambda *_args: None)
    middleware.csrf_enabled = True
    assert (
        middleware._requires_csrf_protection(
            _request("POST", "/project/artifact-preview/file-1")
        )
        is False
    )
    assert (
        middleware._requires_csrf_protection(
            _request("POST", "/project/artifact-source/file-1")
        )
        is False
    )
    assert middleware._requires_csrf_protection(_request("POST", "/project/file")) is False
    assert (
        middleware._requires_csrf_protection(_request("POST", "/project/threads")) is True
    )
