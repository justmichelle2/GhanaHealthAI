from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")
    app_env: str = "development"
    database_url: str | None = None
    secret_key: str | None = None
    access_token_expire_minutes: int = 30
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    frontend_url: str = "http://localhost:5173"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_sender: str | None = None
    password_reset_minutes: int = 30
    dahl_api_key: str | None = None
    dahl_model: str = "MiniMaxAI/MiniMax-M2.7"
    refresh_token_expire_days: int = 30

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def secure_cookies(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_sender)

@lru_cache
def get_settings() -> Settings:
    return Settings()
