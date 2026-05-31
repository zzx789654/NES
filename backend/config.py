from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "extra": "ignore"}

    database_url: str = "sqlite:///./secvision.db"
    secret_key: str  # No default — must be set via SECRET_KEY env var or .env
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"


settings = Settings()
