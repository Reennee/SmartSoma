"""
Compatibility shim for starlette.testclient with httpx >= 0.23.

The starlette installation in this venv has mismatched metadata vs. code —
dist-info says 0.36.3 but the testclient.py is from 0.27.x, which passes
`app=` to httpx.Client.__init__. That parameter was removed in httpx 0.23.

This conftest is loaded before any test, so patching httpx.Client here
makes TestClient work without changing any production code.
"""
import httpx

_original_client_init = httpx.Client.__init__


def _compat_init(self, *args, app=None, **kwargs):  # noqa: ANN001
    """Accept and silently discard the old `app=` keyword argument."""
    _original_client_init(self, *args, **kwargs)


httpx.Client.__init__ = _compat_init  # type: ignore[method-assign]
