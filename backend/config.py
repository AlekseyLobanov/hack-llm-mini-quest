from __future__ import annotations

import logging
import logging.config
import tomllib
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMSettings(BaseModel):
    model: str
    api_key: str
    base_url: str | None = None
    temperature: float = 0.0
    timeout_seconds: float = 30.0


class LoggingSettings(BaseModel):
    level: str = "INFO"
    logs_dir: Path = Path("./logs")
    app_log_name: str = "backend.log"


class ServerSettings(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False


class GameSettings(BaseModel):
    hard_mode_rotation_interval: int = Field(default=5, ge=1)
    blocked_response_text: str = (
        "Ответ скрыт защитным фильтром: система посчитала, "
        "что он может помочь раскрыть секрет."
    )
    password_words: list[str] = Field(min_length=20)


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HLMQ_", extra="ignore")

    llm: LLMSettings
    logging: LoggingSettings = LoggingSettings()
    server: ServerSettings = ServerSettings()
    game: GameSettings

    @classmethod
    def from_toml(cls, config_path: str | Path) -> "AppSettings":
        path = Path(config_path)
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        return cls.model_validate(data)


def setup_logging(settings: LoggingSettings) -> None:
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = settings.logs_dir / settings.app_log_name

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "console": {
                    "()": structlog.stdlib.ProcessorFormatter,
                    "processor": structlog.dev.ConsoleRenderer(),
                    "foreign_pre_chain": shared_processors,
                },
                "json": {
                    "()": structlog.stdlib.ProcessorFormatter,
                    "processor": structlog.processors.JSONRenderer(),
                    "foreign_pre_chain": shared_processors,
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "console",
                    "level": settings.level,
                },
                "file": {
                    "class": "logging.FileHandler",
                    "filename": str(log_path),
                    "formatter": "json",
                    "level": settings.level,
                    "encoding": "utf-8",
                },
            },
            "root": {
                "handlers": ["console", "file"],
                "level": settings.level,
            },
        }
    )

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def as_public_dict(settings: AppSettings) -> dict[str, Any]:
    data = settings.model_dump()
    data["llm"]["api_key"] = "***"
    return data
