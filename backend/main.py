import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import get_session_factory
from app.routers.auth import router as auth_router
from app.routers.patient import router as patient_router
from app.routers.doctor import router as doctor_router
from app.routers.admin import router as admin_router

settings = get_settings()
logger = logging.getLogger("ghana_health.database")
app = FastAPI(title="Ghana Health Assistant API", description="Multilingual health information and clinician review service. Not clinically validated.", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-CSRF-Token"])
app.include_router(auth_router)
app.include_router(patient_router)
app.include_router(doctor_router)
app.include_router(admin_router)

@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.secure_cookies and request.url.scheme == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

@app.get("/", tags=["root"])
def read_root():
    return {"service": "Ghana Health Assistant API", "status": "ok", "version": "0.3.0", "note": "Health information is not clinically validated; no automated medical answers are available."}

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy", "service": "ghana-health-assistant"}

@app.get("/health/ready", tags=["health"])
def readiness_check():
    try:
        with get_session_factory()() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Database readiness check failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Please try again shortly.") from None
    return {"status": "ready", "database": "available"}
