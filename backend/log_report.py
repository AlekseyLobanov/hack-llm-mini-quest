from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Exchange:
    timestamp: str
    session_id: str
    level_id: int | None
    model_endpoint: str
    found_answer: bool = False
    user_text: str = ""
    checks: list[str] = field(default_factory=list)
    model_reply: str | None = None
    outcome: str | None = None


@dataclass
class SessionLog:
    session_id: str
    started_at: str
    model_endpoint: str
    guessed: bool = False
    exchanges: list[Exchange] = field(default_factory=list)


TERMINAL_EVENTS = {
    "password_guessed",
    "outgoing_response",
    "request_blocked",
    "response_blocked",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print detailed session logs from backend JSONL logs."
    )
    parser.add_argument(
        "log_path",
        nargs="?",
        default="backend/logs/backend.log",
        help="Path to backend JSONL log file.",
    )
    return parser.parse_args()


def format_model_endpoint(settings: dict[str, Any]) -> str:
    llm_settings = settings.get("llm", {})
    model = llm_settings.get("model", "unknown-model")
    base_url = llm_settings.get("base_url", "unknown-endpoint")
    return f"{model} @ {base_url}"


def format_check(entry: dict[str, Any]) -> str:
    status = "triggered" if entry.get("triggered") else "passed"
    kind = entry.get("check_kind", "unknown_check")
    reason = entry.get("reason", "")
    if reason:
        return f"{kind}: {status} ({reason})"
    return f"{kind}: {status}"


def format_outcome(event: str, entry: dict[str, Any]) -> str:
    if event == "password_guessed":
        return "password_guessed"
    if event == "outgoing_response":
        return "response_returned"
    if event == "request_blocked":
        reason = entry.get("reason", "")
        return f"request_blocked ({reason})" if reason else "request_blocked"
    if event == "response_blocked":
        reason = entry.get("reason", "")
        return f"response_blocked ({reason})" if reason else "response_blocked"
    return event


def assign_check(
    entry: dict[str, Any],
    checks_by_session: dict[str, list[str]],
    check_queue: list[str],
) -> None:
    formatted_check = format_check(entry)
    session_id = entry.get("session_id")
    if session_id:
        checks_by_session.setdefault(session_id, []).append(formatted_check)
        return
    check_queue.append(formatted_check)


def start_exchange(
    entry: dict[str, Any],
    current_model_endpoint: str,
    open_exchanges: dict[str, Exchange],
    exchanges: list[Exchange],
) -> None:
    session_id = entry.get("session_id")
    if not session_id:
        return

    exchange = Exchange(
        timestamp=entry.get("timestamp", ""),
        session_id=session_id,
        level_id=entry.get("level_id"),
        model_endpoint=current_model_endpoint,
        user_text=entry.get("user_text", ""),
    )
    open_exchanges[session_id] = exchange
    exchanges.append(exchange)


def finalize_exchange(
    entry: dict[str, Any],
    event: str,
    open_exchanges: dict[str, Exchange],
    checks_by_session: dict[str, list[str]],
    check_queue: list[str],
) -> None:
    session_id = entry.get("session_id")
    if not session_id:
        return

    exchange = open_exchanges.get(session_id)
    if exchange is None:
        return

    if session_id in checks_by_session:
        exchange.checks.extend(checks_by_session.pop(session_id))
    elif check_queue:
        exchange.checks.extend(check_queue)
        check_queue.clear()

    exchange.found_answer = event == "password_guessed"
    exchange.outcome = format_outcome(event, entry)

    if event in {"outgoing_response", "response_blocked"}:
        exchange.model_reply = entry.get("agent_reply")
    elif event == "password_guessed":
        exchange.model_reply = "Пароль угадан. Сессия считается успешно пройденной."

    del open_exchanges[session_id]


def finalize_open_exchanges(
    exchanges: list[Exchange],
    open_exchanges: dict[str, Exchange],
    checks_by_session: dict[str, list[str]],
    check_queue: list[str],
) -> None:
    for session_id, checks in checks_by_session.items():
        exchange = open_exchanges.get(session_id)
        if exchange is not None:
            exchange.checks.extend(checks)

    if check_queue:
        for exchange in reversed(exchanges):
            if exchange.session_id in open_exchanges:
                exchange.checks.extend(check_queue)
                break

    for exchange in exchanges:
        if exchange.session_id in open_exchanges and exchange.outcome is None:
            exchange.outcome = "incomplete"


def parse_log(log_path: Path) -> list[Exchange]:
    exchanges: list[Exchange] = []
    current_model_endpoint = "unknown-model @ unknown-endpoint"
    open_exchanges: dict[str, Exchange] = {}
    check_queue: list[str] = []
    checks_by_session: dict[str, list[str]] = {}

    with log_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = entry.get("event")

            if event == "settings_loaded":
                current_model_endpoint = format_model_endpoint(
                    entry.get("settings", {})
                )
                continue

            if event == "filter_checked":
                assign_check(entry, checks_by_session, check_queue)
                continue

            if event == "incoming_request":
                start_exchange(
                    entry,
                    current_model_endpoint,
                    open_exchanges,
                    exchanges,
                )
                continue

            if event not in TERMINAL_EVENTS:
                continue

            finalize_exchange(
                entry,
                event,
                open_exchanges,
                checks_by_session,
                check_queue,
            )

    finalize_open_exchanges(
        exchanges,
        open_exchanges,
        checks_by_session,
        check_queue,
    )

    return exchanges


def group_sessions(exchanges: list[Exchange]) -> list[SessionLog]:
    sessions: dict[str, SessionLog] = {}
    ordered_sessions: list[SessionLog] = []

    for exchange in exchanges:
        session = sessions.get(exchange.session_id)
        if session is None:
            session = SessionLog(
                session_id=exchange.session_id,
                started_at=exchange.timestamp,
                model_endpoint=exchange.model_endpoint,
            )
            sessions[exchange.session_id] = session
            ordered_sessions.append(session)

        session.exchanges.append(exchange)
        session.guessed = session.guessed or exchange.found_answer

    return ordered_sessions


def render_exchange(exchange: Exchange) -> str:
    lines = [f"{exchange.timestamp or '-'}", f"- User: {exchange.user_text}"]
    if exchange.checks:
        lines.extend(f"- Check: {check}" for check in exchange.checks)
    else:
        lines.append("- Check: none")

    if exchange.outcome:
        lines.append(f"- Outcome: {exchange.outcome}")

    if exchange.model_reply is not None:
        lines.append(f"- Model: {exchange.model_reply}")
    else:
        lines.append("- Model: <no response>")

    return "\n".join(lines)


def render_session(session: SessionLog) -> str:
    header = ", ".join(
        [
            session.started_at or "-",
            session.session_id,
            session.model_endpoint,
            f"guessed: {'yes' if session.guessed else 'no'}",
        ]
    )
    rendered_exchanges = "\n--\n".join(
        render_exchange(exchange) for exchange in session.exchanges
    )
    return f"{header}\n{rendered_exchanges}"


def main() -> int:
    args = parse_args()
    log_path = Path(args.log_path)

    if not log_path.exists():
        print(f"Log file not found: {log_path}", file=sys.stderr)
        return 1

    exchanges = parse_log(log_path)
    sessions = group_sessions(exchanges)
    output = "\n\n".join(render_session(session) for session in sessions)
    if output:
        print(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
