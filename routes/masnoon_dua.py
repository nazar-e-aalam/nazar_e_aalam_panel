from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import db
from database.models import DuaCategory, MasnoonDua
from dependencies.auth import require_permission
from schemas.masnoon_dua import CategoryBody, CategoryCreate, CategoryRead, MasnoonBody, MasnoonCreate, MasnoonRead
from schemas.common import Page
from tools.seed_masnoon_duas import run

router = APIRouter(tags=['masnoon-duas'])
read = Depends(require_permission('duas:read'))
write = Depends(require_permission('duas:write'))

def get(session, model, id):
    obj = session.get(model, id)
    if obj is None:
        raise HTTPException(404, 'Not found')
    return obj

def save(session, obj):
    try:
        session.commit()
        session.refresh(obj)
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Conflicting identifier or relationship')
    return obj

@router.get('/dua-categories', response_model=list[CategoryRead])
def categories(session: Session = Depends(db.get_db)):
    return list(session.scalars(select(DuaCategory).where(DuaCategory.is_active.is_(True)).order_by(DuaCategory.position, DuaCategory.id)))

@router.get('/admin/masnoon/categories', response_model=list[CategoryRead], dependencies=[read])
def admin_categories(session: Session = Depends(db.get_db)):
    return list(session.scalars(select(DuaCategory).order_by(DuaCategory.position, DuaCategory.id)))

@router.post('/admin/masnoon/categories', response_model=CategoryRead, dependencies=[write])
def create_category(body: CategoryCreate, session: Session = Depends(db.get_db)):
    obj = DuaCategory(**body.model_dump()); session.add(obj); return save(session,obj)

@router.patch('/admin/masnoon/categories/{id}', response_model=CategoryRead, dependencies=[write])
def update_category(id: int, body: CategoryBody, session: Session = Depends(db.get_db)):
    obj = get(session,DuaCategory,id)
    for k,v in body.model_dump().items(): setattr(obj,k,v)
    obj.seed_hash = None
    return save(session,obj)

def page(session, public, category_id, search, skip, limit):
    q = select(MasnoonDua).join(DuaCategory)
    if public: q = q.where(MasnoonDua.is_published.is_(True), DuaCategory.is_active.is_(True))
    if category_id is not None: q = q.where(MasnoonDua.category_id == category_id)
    if search: q = q.where(cast(MasnoonDua.title,String).contains(search, autoescape=True))
    total = session.scalar(select(func.count()).select_from(q.subquery()))
    items = session.scalars(q.order_by(DuaCategory.position, MasnoonDua.position, MasnoonDua.id).offset(skip).limit(limit))
    return Page[MasnoonRead].build([MasnoonRead.model_validate(i) for i in items],total=total,skip=skip,limit=limit)

@router.get('/masnoon-duas', response_model=Page[MasnoonRead])
def public_list(category_id: int | None=None, search: str | None=Query(None,max_length=200), skip: int=Query(0,ge=0), limit: int=Query(50,ge=1,le=500), session: Session=Depends(db.get_db)):
    return page(session,True,category_id,search,skip,limit)

@router.get('/masnoon-duas/{id}', response_model=MasnoonRead)
def public_detail(id: int, session: Session=Depends(db.get_db)):
    obj = get(session,MasnoonDua,id)
    if not obj.is_published or not get(session,DuaCategory,obj.category_id).is_active: raise HTTPException(404,'Not found')
    return obj

@router.get('/admin/masnoon/duas', response_model=Page[MasnoonRead], dependencies=[read])
def admin_list(category_id: int | None=None, search: str | None=Query(None,max_length=200), skip: int=Query(0,ge=0), limit: int=Query(50,ge=1,le=500), session: Session=Depends(db.get_db)):
    return page(session,False,category_id,search,skip,limit)

@router.get('/admin/masnoon/duas/{id}', response_model=MasnoonRead, dependencies=[read])
def admin_detail(id: int, session: Session=Depends(db.get_db)):
    return get(session,MasnoonDua,id)

@router.post('/admin/masnoon/duas', response_model=MasnoonRead, dependencies=[write])
def create_dua(body: MasnoonCreate, session: Session=Depends(db.get_db)):
    get(session,DuaCategory,body.category_id)
    obj=MasnoonDua(**body.model_dump()); session.add(obj); return save(session,obj)

@router.patch('/admin/masnoon/duas/{id}', response_model=MasnoonRead, dependencies=[write])
def update_dua(id: int, body: MasnoonBody, session: Session=Depends(db.get_db)):
    get(session,DuaCategory,body.category_id)
    obj=get(session,MasnoonDua,id)
    for k,v in body.model_dump().items(): setattr(obj,k,v)
    obj.seed_hash=None
    return save(session,obj)

@router.post('/admin/masnoon/seed/preview', dependencies=[write])
def preview(session: Session=Depends(db.get_db)):
    return run(session,preview=True)

@router.post('/admin/masnoon/seed/apply', dependencies=[write])
def apply(session: Session=Depends(db.get_db)):
    return run(session)
