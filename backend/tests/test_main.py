from __future__ import annotations

from fastapi.testclient import TestClient
from main import create_app
from models import AgentResponse, LevelInfo


def write_config(path) -> None:
    path.write_text(
        """
[llm]
model = "test-model"
api_key = "test-key"

[server]
host = "127.0.0.1"
port = 8000
reload = false

[game]
hard_mode_rotation_interval = 5
level2_output_blocked_response_text = "blocked-2-out"
level3_input_blocked_response_text = "blocked-3-in"
level3_output_blocked_response_text = "blocked-3-out"
level4_input_blocked_response_text = "blocked-4-in"
level4_output_blocked_response_text = "blocked-4-out"
password_words = [
  "w01", "w02", "w03", "w04", "w05",
  "w06", "w07", "w08", "w09", "w10",
  "w11", "w12", "w13", "w14", "w15",
  "w16", "w17", "w18", "w19", "w20",
]
""".strip(),
        encoding="utf-8",
    )


def test_create_app_exposes_level_and_query_routes(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.toml"
    write_config(config_path)

    class FakeService:
        def __init__(self, settings) -> None:
            self.settings = settings

        def list_levels(self) -> list[LevelInfo]:
            return [
                LevelInfo(
                    id=1,
                    title="Level 1",
                    description="Simple agent",
                )
            ]

        def run_level(
            self, level_id, session_id, user_text, hard_mode
        ) -> AgentResponse:
            return AgentResponse(
                session_id=session_id,
                response_text=f"echo:{user_text}:{hard_mode}",
                success=False,
                session_rotated=False,
                level_id=level_id,
            )

    monkeypatch.setattr("main.AgentService", FakeService)
    app = create_app(config_path)
    client = TestClient(app)

    levels_response = client.get("/api/v1/levels")
    query_response = client.post(
        "/api/v1/levels/query/1/",
        json={
            "session_id": "00000000-0000-0000-0000-000000000111",
            "text": "hello",
            "hard_mode": True,
        },
    )

    assert levels_response.status_code == 200
    assert levels_response.json() == [
        {
            "id": 1,
            "title": "Level 1",
            "description": "Simple agent",
        }
    ]
    assert query_response.status_code == 200
    assert query_response.json() == {
        "session_id": "00000000-0000-0000-0000-000000000111",
        "response_text": "echo:hello:True",
        "success": False,
        "session_rotated": False,
        "level_id": 1,
    }


def test_query_route_returns_404_for_unknown_level(monkeypatch, tmp_path) -> None:
    config_path = tmp_path / "config.toml"
    write_config(config_path)

    class FakeService:
        def __init__(self, settings) -> None:
            self.settings = settings

        def list_levels(self) -> list[LevelInfo]:
            return []

        def run_level(
            self, level_id, session_id, user_text, hard_mode
        ) -> AgentResponse:
            raise ValueError(f"Unknown level_id={level_id}")

    monkeypatch.setattr("main.AgentService", FakeService)
    app = create_app(config_path)
    client = TestClient(app)

    response = client.post(
        "/api/v1/levels/query/99/",
        json={
            "session_id": "00000000-0000-0000-0000-000000000222",
            "text": "hello",
            "hard_mode": False,
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Unknown level_id=99"}
