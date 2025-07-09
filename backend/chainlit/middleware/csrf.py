import os
from typing import cast, Literal
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from chainlit.config import config
from chainlit.logger import logger

class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware for cross-domain requests.
    Only active when CHAINLIT_COOKIE_SAMESITE=none.
    Validates Origin, Referer and custom headers to prevent CSRF attacks.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.allowed_origins = set(config.project.allow_origins)
        
        # Get cookie SameSite setting - same logic as cookie.py
        self._cookie_samesite = cast(
            Literal["lax", "strict", "none"],
            os.environ.get("CHAINLIT_COOKIE_SAMESITE", "lax"),
        )
        
        # CSRF protection only needed when SameSite=none (cross-domain cookies)
        self.csrf_enabled = self._cookie_samesite == "none"
        
        if self.csrf_enabled:
            logger.info("CSRF protection enabled for cross-domain cookies (SameSite=none)")
        else:
            logger.debug(f"CSRF protection disabled (SameSite={self._cookie_samesite})")
        
    async def dispatch(self, request: Request, call_next):
        # Only validate if CSRF is enabled and endpoint requires protection
        if self.csrf_enabled and self._requires_csrf_protection(request):
            self._validate_csrf(request)

        
        response = await call_next(request)
        return response
    
    def _requires_csrf_protection(self, request: Request) -> bool:
        """Determine if the endpoint requires CSRF protection"""
        path = request.url.path
        
        # Exclude OPTIONS (CORS preflight) - never need protection
        if request.method == "OPTIONS":
            return False
        
        # Protect WebSocket connections - always need protection
        if path.startswith('/ws/'):
            return True
            
        # Protect sensitive API endpoints for POST/PUT/DELETE only
        # Management frontend now sends CSRF headers automatically
        # TODO: MANAGEMENTE FRONT mande los headers en request de API PARCIAL (FALTA LA API DE VALIDACI'ON DE AUTH AL PARECER)
        # TODO instead of sensitive paths, use a list of endpoints for exclusions
        if request.method in ["POST", "PUT", "DELETE"]:
            sensitive_paths = ['/project', '/user', '/auth', '/automata']
            if any(path.startswith(sensitive_path) for sensitive_path in sensitive_paths):
                return True
            else:
                return False

        # Everything else - no protection (default)
        return False
    
    def _validate_csrf(self, request: Request):
        """Validate CSRF protections for cross-domain requests"""
        origin = request.headers.get("Origin")
        referer = request.headers.get("Referer", "")
        custom_header = request.headers.get("X-Requested-With")
        client_origin = request.headers.get("X-Client-Origin")
        
        # Prepare request info for logging (without sensitive data)
        request_info = {
            "method": request.method,
            "path": request.url.path,
            "origin": origin,
            "client_origin": client_origin,
            "has_custom_header": bool(custom_header),
            "has_referer": bool(referer),
            "user_agent": request.headers.get("User-Agent", "")[:100]  # Truncate UA
        }
        
        # Allow all origins if wildcard is configured
        if "*" in self.allowed_origins:
            if not custom_header:
                logger.warning(
                    f"CSRF protection failed - Missing X-Requested-With header: {request_info}"
                )
                raise HTTPException(
                    status_code=403,
                    detail="Missing required header X-Requested-With"
                )
            return
        
        # Validate Origin header
        if origin and origin not in self.allowed_origins:
            logger.warning(
                f"CSRF protection failed - Origin not allowed: {request_info}"
            )
            raise HTTPException(
                status_code=403, 
                detail=f"Origin '{origin}' not allowed"
            )
        
        # Validate client origin header (for cross-domain requests)
        if client_origin and client_origin not in self.allowed_origins:
            logger.warning(
                f"CSRF protection failed - Client origin not allowed: {request_info}"
            )
            raise HTTPException(
                status_code=403,
                detail=f"Client origin '{client_origin}' not allowed"
            )
        
        # Validate Referer as backup
        if referer and not any(
            referer.startswith(allowed) for allowed in self.allowed_origins
        ):
            logger.warning(
                f"CSRF protection failed - Invalid referer: {request_info}"
            )
            raise HTTPException(
                status_code=403, 
                detail="Invalid referer"
            )
        
        # Require custom header (blocks simple HTML form submissions)
        if not custom_header:
            logger.warning(
                f"CSRF protection failed - Missing X-Requested-With header: {request_info}"
            )
            raise HTTPException(
                status_code=403, 
                detail="Missing required header X-Requested-With"
            )
