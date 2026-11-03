from collections.abc import Generator
from functools import lru_cache
import logging
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.core.config import get_settings

logger = logging.getLogger("ghana_health.database")

class Base(DeclarativeBase):
    pass

@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    database_url = get_settings().database_url
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    if not database_url.startswith("postgresql+psycopg://"):
        raise RuntimeError("DATABASE_URL must use postgresql+psycopg://")
    engine = create_engine(database_url, pool_pre_ping=True, pool_recycle=1800,
                           connect_args={"connect_timeout": 5})
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def get_db() -> Generator[Session, None, None]:
    try:
        factory = get_session_factory()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Database is not configured") from None
    with factory() as session:
        try:
            yield session
        except SQLAlchemyError as exc:
            session.rollback()
            logger.error("Database request failed (%s)", type(exc).__name__)
            raise HTTPException(status_code=503, detail="Service temporarily unavailable") from None
