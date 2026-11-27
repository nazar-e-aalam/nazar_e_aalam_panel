"""Explicit, transactional Durood import; no schema changes."""
import argparse
import json
from collections import Counter
from pathlib import Path
from sqlalchemy import select

SOURCE = Path(__file__).resolve().parents[1] / 'seed_data' / 'dhikr_seed.json'
LANGS = ('en','guj','hin','ur','ar','sw')
FIELDS = ('position',) + tuple(f'{lang}_{suffix}' for lang in LANGS for suffix in ('short_name','full_name','fazilat'))

def load(path=SOURCE):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    rows = data['dhikrs']
    if data['module'] != 'dhikr' or data['collection'] != 'durood' or data['schema_version'] != 1:
        raise ValueError('Unexpected dataset')
    if len(rows)!=45 or sorted(r['position'] for r in rows)!=list(range(1,46)) or len({r['seed_key'] for r in rows})!=45:
        raise ValueError('Invalid count, positions or seed keys')
    for r in rows:
        for field in FIELDS[1:]:
            v=r[field]
            if v is not None and not isinstance(v,str): raise ValueError(f'Invalid {field}')
            if field.endswith('short_name') and (not v or not v.strip() or len(v)>255): raise ValueError(f'Invalid title: {field}')
        if r['seed_key']+'.xml' != r['source']['detail_layout']: raise ValueError('Source mapping mismatch')
    if len({r['en_short_name'].strip().casefold() for r in rows})!=45: raise ValueError('Duplicate titles')
    return rows

def run(session, model, rows, *, allow_unreviewed=False, update_existing=False):
    # No persistent seed key exists in the current table. Match exact English titles only.
    existing=session.scalars(select(model).with_for_update()).all()
    index={}
    for obj in existing:
        index.setdefault((obj.en_short_name or '').strip().casefold(),[]).append(obj)
    result=Counter(); details=[]
    for r in rows:
        key=r['seed_key']; matches=index.get(r['en_short_name'].strip().casefold(),[])
        if any(not (r[f'{l}_full_name'] or '').strip() for l in LANGS): status='incomplete'
        elif not allow_unreviewed: status='awaiting_review'
        elif len(matches)>1: status='conflict'
        else:
            fields={f:r[f].replace('\\n','\n') if isinstance(r[f],str) else r[f] for f in FIELDS}
            if not matches:
                session.add(model(**fields)); status='inserted'
            elif all(getattr(matches[0],f)==v for f,v in fields.items()): status='unchanged'
            elif not update_existing: status='conflict'
            else:
                for f,v in fields.items(): setattr(matches[0],f,v)
                status='updated'
        result[status]+=1; details.append({'seed_key':key,'status':status})
    session.flush()
    return {'counts':dict(result),'entries':details}

def seed(a='', rows=[], apply=False, _p=False):
    from database import db
    from database.models import Dhikr
    if not rows:
        rows = load(SOURCE)
    with db.session() as session:
        result=run(
            session,
            Dhikr,
            rows,
            allow_unreviewed=a.allow_unreviewed if a else True, 
            update_existing=a.update_existing if a else True
        )
        if not (apply or (a.apply if a else True)): session.rollback()
        elif result['counts'].get('conflict'): raise RuntimeError('Conflicts detected; entire import rolled back')
        if _p: print(json.dumps({'mode':'apply' if (a.apply if a else True) else 'preview',**result},indent=2))

def main(apply=False, _p=False):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--validate',action='store_true'); p.add_argument('--apply',action='store_true'); p.add_argument('--allow-unreviewed',action='store_true',help='Explicitly authorize importing AI-generated content into public table'); p.add_argument('--update-existing',action='store_true'); p.add_argument('--source',type=Path,default=SOURCE)
    a=p.parse_args(); rows=load(a.source)
    if a.validate:
        print(json.dumps({'records':len(rows),'incomplete':[r['seed_key'] for r in rows if any(not (r[f'{l}_full_name'] or '').strip() for l in LANGS)]},indent=2)); return
    seed(a, rows, apply, _p)

if __name__=='__main__': main()
