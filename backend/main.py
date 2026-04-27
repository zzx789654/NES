from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import Base, engine
from routers import auth, scans, nist, ipgroups, dashboard

# Create all tables (dev convenience; use alembic in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SecVision ISMS API",
    version="1.0.0",
    description="Backend API for SecVision ISMS Security Portal",
)

origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # 萬用字元 * 不能搭配 allow_credentials=True（瀏覽器 CORS 規範限制）
    allow_credentials="*" not in origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scans.router)
app.include_router(nist.router)
app.include_router(ipgroups.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok"}
