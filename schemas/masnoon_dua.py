from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any

LANGS = {"en", "hi", "gu", "ur", "ar", "sw"}

def localized(value):
    if set(value) != LANGS or any(not isinstance(v, str) or not v.strip() for v in value.values()):
        raise ValueError("All six nonempty language values required")
    return value

class CategoryBody(BaseModel):
    title: dict[str, str]
    description: dict[str, str] | None = None
    position: int = Field(ge=1)
    is_active: bool = True
    _title = field_validator("title")(localized)

class CategoryCreate(CategoryBody):
    slug: str = Field(pattern=r"^[a-z0-9_]+$", max_length=150)

class CategoryRead(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class MasnoonBody(BaseModel):
    category_id: int
    position: int = Field(ge=1)
    title: dict[str, str]
    content: dict[str, Any]
    is_published: bool = False
    _title = field_validator("title")(localized)

class MasnoonCreate(MasnoonBody):
    seed_key: str = Field(pattern=r"^[a-z0-9_]+$", max_length=190)

class MasnoonRead(MasnoonCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
