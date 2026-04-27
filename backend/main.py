from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import auth, scans, nist, ipgroups, dashboard

# Create all tables (dev convenience; use alembic in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SecVision ISMS API",
    version="1.0.0",
    description="Backend API for SecVision ISMS Security Portal",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(nist.router)
app.include_router(ipgroups.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {
        "service": "SecVision ISMS API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
