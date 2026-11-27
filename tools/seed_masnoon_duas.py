"""Explicit schema initialization and transactional seed import."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from sqlalchemy import select
from database import db
from database.models import DuaCategory, MasnoonDua
from schemas.masnoon_dua import localized

SOURCE = Path(__file__).resolve().parents[1] / "seed_data" / "masnoon_duas_seed.json"

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()

def initialize():
    DuaCategory.__table__.create(db.engine, checkfirst=True)
    MasnoonDua.__table__.create(db.engine, checkfirst=True)

def load():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    cats, entries = data["categories"], data["duas"]
    counts = Counter(e["category_slug"] for e in entries)
    if len(cats) != len({c["slug"] for c in cats}) or len(entries) != len({e["id"] for e in entries}):
        raise ValueError("Duplicate seed identifiers")
    if counts != {c["slug"]: c["entry_count"] for c in cats}:
        raise ValueError("Category counts mismatch")
    for c in cats:
        localized(c["title"])
    for e in entries:
        localized(e["title"])
        if e["entry_number"] < 1:
            raise ValueError("Invalid position")
    return cats, entries

def run(session, *, preview=False, overwrite=False):
    cats, entries = load()
    result = {k: Counter() for k in ("categories", "duas")}
    mapping = {}
    def upsert(model, key, value, fields, bucket):
        obj = session.scalar(select(model).where(getattr(model, key) == value).with_for_update())
        h = digest(fields)
        if obj is None:
            result[bucket]["inserted"] += 1
            obj = model(**{key: value}, **fields, seed_hash=h)
            session.add(obj)
            session.flush()
        elif obj.seed_hash == h:
            result[bucket]["unchanged"] += 1
        elif obj.seed_hash is None and not overwrite:
            result[bucket]["conflict"] += 1
        else:
            result[bucket]["updated"] += 1
            for k, v in fields.items():
                setattr(obj, k, v)
            obj.seed_hash = h
            if isinstance(obj, MasnoonDua):
                obj.is_published = False
        return obj
    for c in cats:
        obj = upsert(DuaCategory, "slug", c["slug"], dict(position=c["order"], title=c["title"], description=c.get("description")), "categories")
        mapping[c["slug"]] = obj.id
    for e in entries:
        upsert(MasnoonDua, "seed_key", e["id"], dict(category_id=mapping[e["category_slug"]], position=e["entry_number"], title=e["title"], content=e), "duas")
    if preview:
        session.rollback()
    else:
        session.commit()
    return {k: dict(v) for k,v in result.items()}

def seed(_p=False, args=''):
    with db.session() as session:
        d = run(session, preview=not args.apply if args else False, overwrite=args.overwrite if args else True)
        if _p: print(json.dumps(d), indent=2)

def main(_p=False, init=True):
    parser = argparse.ArgumentParser()
    parser.add_argument("--init", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if args.init or init:
        initialize()
    seed(_p, args)

if __name__ == "__main__":
    main()