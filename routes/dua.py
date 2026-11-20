from fastapi import Depends

from database.models import Dua
from dependencies.auth import require_permission
from routes.base_router import make_crud_router
from schemas.dua import (
    AutoTranslateRequest,
    AutoTranslateResponse,
    DuaCreate,
    DuaRead,
    DuaUpdate,
)
from tools.translator import translate_dua_fields

router = make_crud_router(
    model=Dua,
    prefix="/duas",
    tag="duas",
    create_schema=DuaCreate,
    update_schema=DuaUpdate,
    read_schema=DuaRead,
    order_by="position",
    search_fields=(
        "en_short_name",
        "en_full_name",
        "en_fazilat",
        "guj_short_name",
        "guj_full_name",
        "guj_fazilat",
        "hin_short_name",
        "hin_full_name",
        "hin_fazilat",
        "ur_short_name",
        "ur_full_name",
        "ur_fazilat",
        "ar_short_name",
        "ar_full_name",
        "ar_fazilat",
        "sw_short_name",
        "sw_full_name",
        "sw_fazilat",
    ),
    read_perm="duas:read",
    write_perm="duas:write",
)


@router.post(
    "/auto-translate",
    response_model=AutoTranslateResponse,
    dependencies=[Depends(require_permission("duas:write"))],
)
async def auto_translate_dua(body: AutoTranslateRequest) -> AutoTranslateResponse:
    """Auto-translate English dua text into the other 5 supported languages."""
    fields = await translate_dua_fields(
        body.en_short_name,
        body.en_full_name,
        body.en_fazilat,
    )
    return AutoTranslateResponse(**fields)
