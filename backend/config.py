from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/focusflow"
    redis_url: str = "redis://localhost:6379/0"
    anthropic_api_key: str = ""
    youtube_api_key: str = ""
    github_token: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 168

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
