from __future__ import annotations

import json
from pathlib import Path

from log_report import group_sessions, parse_log, render_session


def write_jsonl(path: Path, entries: list[dict]) -> None:
    path.write_text(
        "\n".join(json.dumps(entry, ensure_ascii=False) for entry in entries),
        encoding="utf-8",
    )


def test_parse_log_groups_requests_checks_and_responses(tmp_path: Path) -> None:
    log_path = tmp_path / "backend.log"
    write_jsonl(
        log_path,
        [
            {
                "settings": {
                    "llm": {
                        "model": "test-model",
                        "base_url": "http://llm.local/v1",
                    }
                },
                "event": "settings_loaded",
                "timestamp": "2026-05-09T10:00:00Z",
            },
            {
                "session_id": "s1",
                "password": "cloud",
                "event": "session_created",
                "timestamp": "2026-05-09T10:00:01Z",
            },
            {
                "level_id": 2,
                "session_id": "s1",
                "hard_mode": False,
                "rotated": False,
                "user_text": "hello",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:02Z",
            },
            {
                "session_id": "s1",
                "check_kind": "assistant_response",
                "triggered": False,
                "reason": "safe",
                "event": "filter_checked",
                "timestamp": "2026-05-09T10:00:03Z",
            },
            {
                "level_id": 2,
                "session_id": "s1",
                "agent_reply": "hi there",
                "event": "outgoing_response",
                "timestamp": "2026-05-09T10:00:04Z",
            },
            {
                "level_id": 2,
                "session_id": "s1",
                "hard_mode": False,
                "rotated": False,
                "user_text": "cloud",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:05Z",
            },
            {
                "level_id": 2,
                "session_id": "s1",
                "password": "cloud",
                "event": "password_guessed",
                "timestamp": "2026-05-09T10:00:06Z",
            },
        ],
    )

    exchanges = parse_log(log_path)

    assert len(exchanges) == 2

    first = exchanges[0]
    assert first.session_id == "s1"
    assert first.model_endpoint == "test-model @ http://llm.local/v1"
    assert first.user_text == "hello"
    assert first.found_answer is False
    assert first.checks == ["assistant_response: passed (safe)"]
    assert first.model_reply == "hi there"
    assert first.outcome == "response_returned"

    second = exchanges[1]
    assert second.user_text == "cloud"
    assert second.found_answer is True
    assert second.model_reply == "Пароль угадан. Сессия считается успешно пройденной."
    assert second.outcome == "password_guessed"


def test_render_session_includes_history_and_guessed_status(tmp_path: Path) -> None:
    log_path = tmp_path / "backend.log"
    write_jsonl(
        log_path,
        [
            {
                "settings": {
                    "llm": {
                        "model": "test-model",
                        "base_url": "http://llm.local/v1",
                    }
                },
                "event": "settings_loaded",
                "timestamp": "2026-05-09T10:00:00Z",
            },
            {
                "level_id": 3,
                "session_id": "s2",
                "hard_mode": False,
                "rotated": False,
                "user_text": "probe",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:02Z",
            },
            {
                "session_id": "s2",
                "check_kind": "user_request",
                "triggered": True,
                "reason": "secret request",
                "event": "filter_checked",
                "timestamp": "2026-05-09T10:00:03Z",
            },
            {
                "level_id": 3,
                "session_id": "s2",
                "reason": "secret request",
                "event": "request_blocked",
                "timestamp": "2026-05-09T10:00:04Z",
            },
            {
                "level_id": 3,
                "session_id": "s2",
                "hard_mode": False,
                "rotated": False,
                "user_text": "probe",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:02Z",
            },
            {
                "level_id": 3,
                "session_id": "s2",
                "password": "cloud",
                "event": "password_guessed",
                "timestamp": "2026-05-09T10:00:05Z",
            },
        ],
    )

    sessions = group_sessions(parse_log(log_path))
    rendered = render_session(sessions[0])

    assert (
        "2026-05-09T10:00:02Z, s2, test-model @ http://llm.local/v1, guessed: yes"
        in rendered
    )
    assert "- User: probe" in rendered
    assert "- Check: user_request: triggered (secret request)" in rendered
    assert "- Outcome: request_blocked (secret request)" in rendered
    assert "- Model: <no response>" in rendered
    assert "--" in rendered
    assert "- Outcome: password_guessed" in rendered


def test_parse_log_keeps_incomplete_requests(tmp_path: Path) -> None:
    log_path = tmp_path / "backend.log"
    write_jsonl(
        log_path,
        [
            {
                "settings": {
                    "llm": {
                        "model": "test-model",
                        "base_url": "http://llm.local/v1",
                    }
                },
                "event": "settings_loaded",
                "timestamp": "2026-05-09T10:00:00Z",
            },
            {
                "level_id": 4,
                "session_id": "s3",
                "hard_mode": False,
                "rotated": False,
                "user_text": "unfinished",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:02Z",
            },
            {
                "check_kind": "user_request",
                "triggered": False,
                "reason": "ok",
                "event": "filter_checked",
                "timestamp": "2026-05-09T10:00:03Z",
            },
        ],
    )

    exchange = parse_log(log_path)[0]

    assert exchange.user_text == "unfinished"
    assert exchange.checks == ["user_request: passed (ok)"]
    assert exchange.outcome == "incomplete"
    assert exchange.model_reply is None


def test_parse_log_prefers_filter_check_session_id_over_global_order(
    tmp_path: Path,
) -> None:
    log_path = tmp_path / "backend.log"
    write_jsonl(
        log_path,
        [
            {
                "settings": {
                    "llm": {
                        "model": "test-model",
                        "base_url": "http://llm.local/v1",
                    }
                },
                "event": "settings_loaded",
                "timestamp": "2026-05-09T10:00:00Z",
            },
            {
                "level_id": 4,
                "session_id": "sA",
                "hard_mode": False,
                "rotated": False,
                "user_text": "first",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:02Z",
            },
            {
                "level_id": 4,
                "session_id": "sB",
                "hard_mode": False,
                "rotated": False,
                "user_text": "second",
                "event": "incoming_request",
                "timestamp": "2026-05-09T10:00:03Z",
            },
            {
                "session_id": "sB",
                "check_kind": "assistant_response",
                "triggered": False,
                "reason": "belongs to second",
                "event": "filter_checked",
                "timestamp": "2026-05-09T10:00:04Z",
            },
            {
                "level_id": 4,
                "session_id": "sA",
                "agent_reply": "reply first",
                "event": "outgoing_response",
                "timestamp": "2026-05-09T10:00:05Z",
            },
            {
                "level_id": 4,
                "session_id": "sB",
                "agent_reply": "reply second",
                "event": "outgoing_response",
                "timestamp": "2026-05-09T10:00:06Z",
            },
        ],
    )

    exchanges = parse_log(log_path)

    assert exchanges[0].session_id == "sA"
    assert exchanges[0].checks == []
    assert exchanges[1].session_id == "sB"
    assert exchanges[1].checks == ["assistant_response: passed (belongs to second)"]
