from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class DuaBase(BaseModel):
    position: int | None = None
    en_short_name: str | None = None
    en_full_name: str | None = None
    en_fazilat: str | None = None
    guj_short_name: str | None = None
    guj_full_name: str | None = None
    guj_fazilat: str | None = None
    hin_short_name: str | None = None
    hin_full_name: str | None = None
    hin_fazilat: str | None = None
    ur_short_name: str | None = None
    ur_full_name: str | None = None
    ur_fazilat: str | None = None
    ar_short_name: str | None = None
    ar_full_name: str | None = None
    ar_fazilat: str | None = None
    sw_short_name: str | None = None
    sw_full_name: str | None = None
    sw_fazilat: str | None = None


class DuaCreate(DuaBase):
    """POST body — every column is nullable in the schema."""


class DuaUpdate(BaseModel):
    """PATCH body — every field optional, only the sent ones are applied."""

    position: int | None = None
    en_short_name: str | None = None
    en_full_name: str | None = None
    en_fazilat: str | None = None
    guj_short_name: str | None = None
    guj_full_name: str | None = None
    guj_fazilat: str | None = None
    hin_short_name: str | None = None
    hin_full_name: str | None = None
    hin_fazilat: str | None = None
    ur_short_name: str | None = None
    ur_full_name: str | None = None
    ur_fazilat: str | None = None
    ar_short_name: str | None = None
    ar_full_name: str | None = None
    ar_fazilat: str | None = None
    sw_short_name: str | None = None
    sw_full_name: str | None = None
    sw_fazilat: str | None = None


class AutoTranslateRequest(BaseModel):
    en_short_name: str | None = None
    en_full_name: str | None = None
    en_fazilat: str | None = None


class AutoTranslateResponse(BaseModel):
    guj_short_name: str | None = None
    guj_full_name: str | None = None
    guj_fazilat: str | None = None
    hin_short_name: str | None = None
    hin_full_name: str | None = None
    hin_fazilat: str | None = None
    ur_short_name: str | None = None
    ur_full_name: str | None = None
    ur_fazilat: str | None = None
    ar_short_name: str | None = None
    ar_full_name: str | None = None
    ar_fazilat: str | None = None
    sw_short_name: str | None = None
    sw_full_name: str | None = None
    sw_fazilat: str | None = None


class DuaRead(DuaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
