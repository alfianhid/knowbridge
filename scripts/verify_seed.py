#!/usr/bin/env python3
"""Synthetic dataset integrity/ground-truth smoke test. Python stdlib only."""
import argparse,csv,json,sys
from pathlib import Path

def check(root):
    meta=json.loads((root/'metadata.json').read_text());manifest=json.loads((root/'manifest.json').read_text())
    suite=json.loads((root/'evaluation.json').read_text());graph=json.loads((root/'entities.json').read_text())
    ids=[r['id'] for r in manifest];unique=set(ids)
    assert len(ids)==len(unique),'Duplicate source IDs'
    assert meta['documents']>=150 and meta['sheets']>=20
    assert meta['eval_cases']>=12
    assert sum(1 for r in manifest if r['kind']=='google_doc')==meta['documents']
    assert sum(1 for r in manifest if r['kind']=='google_sheet')==meta['sheets']
    total_rows=0
    for r in manifest:
        path=root/r['file'];assert path.is_file(),f'Missing {path}'
        if r['kind']=='google_doc':
            data=path.read_text(encoding='utf-8')
            assert 'SYNTHETIC DEMO DATA' in data
            assert len(data)>=450,f'Unrealistically short: {r["id"]}'
        else:
            with path.open(encoding='utf-8',newline='') as f:
                rows=list(csv.reader(f))
            assert len(rows)>1 and rows[0]==r['headers'],f'Bad sheet {r["id"]}'
            assert all(len(row)==len(rows[0]) for row in rows[1:]),f'Sheet columns missing: {r["id"]}'
            total_rows+=len(rows)-1
    assert total_rows==meta['sheet_data_rows'],f'Mismatch {total_rows} != {meta["sheet_data_rows"]}'
    for case in suite:
        for source in case['required_source_ids']:
            assert source in unique,f'Eval source missing: {case["id"]} -> {source}'
        assert 'expected' in case and 'question' in case
    assert len(graph['employees'])>=30
    expected_hbr={'2026-11-01','2026-11-11'}
    hbr=(root/'docs'/'HBR-DOC-04-qa-forecast.txt').read_text()
    assert expected_hbr <= set(x for x in expected_hbr if x in hbr),'HBR date mismatch'
    print('PASS: unique sources; realistic text; well-formed sheets; ground-truth cases; Harbour facts')
    print(f"Documents={meta['documents']}, Sheets={meta['sheets']}, Rows={total_rows}, Cases={meta['eval_cases']}")

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--dir',default='seed/generated');args=p.parse_args()
    try:check(Path(args.dir))
    except (AssertionError, OSError,ValueError,KeyError) as exc:print('FAIL:',exc);sys.exit(1)
