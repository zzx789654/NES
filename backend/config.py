from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./secvision.db"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"

    class Config:
        env_file = ".env"


settings = Settings()
