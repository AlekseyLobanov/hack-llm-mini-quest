from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LevelInfo(BaseModel):
    id: int
    title: str
    description: str


class QueryRequest(BaseModel):
    session_id: UUID
    text: str = Field(min_length=1)
    hard_mode: bool = False


class QueryResponse(BaseModel):
    session_id: UUID
    response_text: str
    success: bool
    session_rotated: bool
    level_id: int


class FilterDecision(BaseModel):
    triggered: bool
    reason: str = ""


class SessionState(BaseModel):
    session_id: UUID
    password: str
    request_count: int = 0


class AgentResponse(BaseModel):
    session_id: UUID
    response_text: str
    success: bool
    session_rotated: bool
    level_id: int
    filter_request: Optional[FilterDecision] = None
    filter_response: Optional[FilterDecision] = None
    filter_exchange: Optional[FilterDecision] = None
