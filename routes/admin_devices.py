
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import db
from database.models import DeviceProfile, User
from dependencies.auth import require_permission
from schemas.auth import DeviceOut

router = APIRouter(
    prefix="/administrators",
    tags=["admin-devices"],
)


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@router.get("/devices/stats")
def get_device_platform_stats(
    _: User = Depends(require_permission("devices:read")),
    session: Session = Depends(db.get_db),
) -> dict[str, int]:
    """
    Return registered device counts grouped by platform.

    Only Android and iOS are included.
    Requires devices:read permission.
    """

    rows = (
        session.query(
            func.lower(DeviceProfile.platform).label("platform"),
            func.count(DeviceProfile.id).label("count"),
        )
        .filter(
            func.lower(DeviceProfile.platform).in_(
                ["android", "ios"]
            )
        )
        .group_by(func.lower(DeviceProfile.platform))
        .all()
    )

    counts = {
        "android": 0,
        "ios": 0,
    }

    for platform, count in rows:
        counts[platform] = int(count)

    return {
        "total": counts["android"] + counts["ios"],
        "android": counts["android"],
        "ios": counts["ios"],
    }


@router.get(
    "/{user_id}/devices",
    response_model=list[DeviceOut],
)
def list_user_devices(
    user_id: int,
    _: User = Depends(require_permission("devices:read")),
    session: Session = Depends(db.get_db),
) -> list[DeviceOut]:
    """
    List devices registered to a user.
    Requires devices:read permission.
    """

    user = session.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    profiles = (
        session.query(DeviceProfile)
        .filter(DeviceProfile.user_id == user_id)
        .order_by(DeviceProfile.created_at.desc())
        .all()
    )

    return [
        DeviceOut.model_validate(profile)
        for profile in profiles
    ]


@router.post(
    "/{user_id}/devices/{device_uuid}/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_device(
    user_id: int,
    device_uuid: str,
    _: User = Depends(require_permission("devices:write")),
    session: Session = Depends(db.get_db),
) -> None:
    """
    Revoke a registered device.
    Requires devices:write permission.
    """

    profile = (
        session.query(DeviceProfile)
        .filter_by(
            user_id=user_id,
            device_uuid=device_uuid,
        )
        .one_or_none()
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if profile.revoked:
        return

    profile.revoked = True
    profile.revoked_at = _utcnow_naive()

    session.commit()
