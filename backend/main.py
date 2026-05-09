from __future__ import annotations

import argparse
from pathlib import Path

import structlog
import uvicorn
from agents import AgentService
from config import AppSettings, as_public_dict, setup_logging
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from models import LevelInfo, QueryRequest, QueryResponse

LOGGER = structlog.get_logger(__name__)


def create_app(config_path: str | Path) -> FastAPI:
    settings = AppSettings.from_toml(config_path)
    setup_logging(settings.logging)
    LOGGER.info("settings_loaded", settings=as_public_dict(settings))

    project_root = Path(__file__).resolve().parent.parent
    web_out_dir = project_root / "web-out"
    service = AgentService(settings=settings)

    app = FastAPI(title="hack-llm-mini-quest backend")
    app.state.settings = settings
    app.state.agent_service = service
    app.state.web_out_dir = web_out_dir

    @app.get("/api/v1/levels", response_model=list[LevelInfo])
    async def get_levels() -> list[LevelInfo]:
        return service.list_levels()

    @app.post("/api/v1/levels/query/{level_id}/", response_model=QueryResponse)
    async def query_level(level_id: int, payload: QueryRequest) -> QueryResponse:
        try:
            result = service.run_level(
                level_id=level_id,
                session_id=payload.session_id,
                user_text=payload.text,
                hard_mode=payload.hard_mode,
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        return QueryResponse(
            session_id=result.session_id,
            response_text=result.response_text,
            success=result.success,
            session_rotated=result.session_rotated,
            level_id=result.level_id,
        )

    if web_out_dir.exists():
        assets_dir = web_out_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/", include_in_schema=False)
        async def serve_index() -> FileResponse:
            return FileResponse(web_out_dir / "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str) -> FileResponse:
            candidate = web_out_dir / full_path
            if candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(web_out_dir / "index.html")

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Path to TOML config file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    app = create_app(args.config)
    settings: AppSettings = app.state.settings
    uvicorn.run(
        app,
        host=settings.server.host,
        port=settings.server.port,
        reload=settings.server.reload,
    )


if __name__ == "__main__":
    main()
