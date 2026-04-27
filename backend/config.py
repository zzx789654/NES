from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env"}

    database_url: str = "sqlite:///./secvision.db"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"
    # 逗號分隔的允許來源，例如 "http://example.com,https://example.com"
    # 設為 * 表示允許所有來源（僅限開發環境）
    allowed_origins: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        """將逗號分隔字串轉為 list，供 CORSMiddleware 使用。"""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
