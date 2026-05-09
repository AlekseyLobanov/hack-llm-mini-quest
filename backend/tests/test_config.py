from __future__ import annotations

import json
import logging

from config import AppSettings, LoggingSettings, as_public_dict, setup_logging


def test_app_settings_load_from_toml_and_masks_api_key(tmp_path) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[llm]
model = "test-model"
api_key = "super-secret"

[game]
hard_mode_rotation_interval = 3
blocked_response_text = "blocked"
password_words = [
  "w01", "w02", "w03", "w04", "w05",
  "w06", "w07", "w08", "w09", "w10",
  "w11", "w12", "w13", "w14", "w15",
  "w16", "w17", "w18", "w19", "w20",
]
""".strip(),
        encoding="utf-8",
    )

    settings = AppSettings.from_toml(config_path)
    public_data = as_public_dict(settings)

    assert settings.llm.model == "test-model"
    assert settings.game.hard_mode_rotation_interval == 3
    assert public_data["llm"]["api_key"] == "***"


def test_file_logs_write_unicode_without_ascii_escaping(tmp_path) -> None:
    setup_logging(LoggingSettings(logs_dir=tmp_path, app_log_name="app.log"))

    logging.getLogger().info("Привет")

    log_text = (tmp_path / "app.log").read_text(encoding="utf-8")

    assert "\\u041f" not in log_text
    assert json.loads(log_text)["event"] == "Привет"
