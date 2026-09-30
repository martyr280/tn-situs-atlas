#!/usr/bin/env python3
"""Validate and merge dated aggregate planning inputs without changing the situs pipeline.

python3 fetch/estimate_refresh.py --input approved-month.json
Use --check for validation without writing. A repeated jurisdiction/month requires --replace.
This imports reviewed aggregate counts; it does not fetch SoS/UCC or infer tax obligations.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def validate(data):
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('records'), list):
        raise ValueError('Expected schemaVersion 1 and records array')
    seen = set()
    for row in data['records']:
        if not isinstance(row, dict) or row.get('kind') not in ('counties', 'cities'):
            raise ValueError('Invalid jurisdiction kind')
        if not isinstance(row.get('slug'), str) or not re.fullmatch(r'[a-z0-9_-]+', row['slug']):
            raise ValueError('Invalid jurisdiction slug')
        if not isinstance(row.get('month'), str) or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', row['month']):
            raise ValueError('Month must be YYYY-MM')
        key = (row['kind'], row['slug'], row['month'])
        if key in seen:
            raise ValueError(f'Duplicate snapshot: {key}')
        seen.add(key)
        if row.get('status') not in ('reported-baseline', 'reconciled') or not isinstance(row.get('note'), str) or not row['note'].strip():
            raise ValueError('Status and scope note required')
        if 'population' not in row:
            raise ValueError('Population required')
        for name in ('population', 'tppFiled', 'licensed', 'ucc'):
            if name not in row:
                continue
            metric = row[name]
            if not isinstance(metric, dict) or type(metric.get('value')) is not int or not 0 <= metric['value'] <= 9007199254740991:
                raise ValueError(f'{name}: count must be a nonnegative safe integer')
            if any(not isinstance(metric.get(k), str) or not metric[k].strip() for k in ('source', 'period')):
                raise ValueError(f'{name}: source and period required')
        if 'tppBenchmarks' in row:
            if not isinstance(row['tppBenchmarks'], list):
                raise ValueError('TPP benchmarks must be an array')
            years = set()
            for b in row['tppBenchmarks']:
                if not isinstance(b, dict) or type(b.get('tax_year')) is not int or not 1900 <= b['tax_year'] <= 9999:
                    raise ValueError('Invalid TPP benchmark year')
                if b['tax_year'] in years:
                    raise ValueError('Duplicate TPP benchmark year')
                years.add(b['tax_year'])
                if type(b.get('returns_received')) is not int or not 0 <= b['returns_received'] <= 9007199254740991:
                    raise ValueError('Invalid TPP benchmark return count')
                if type(b.get('total_tpp_collected')) not in (int, float) or not 0 <= b['total_tpp_collected'] <= 9007199254740991:
                    raise ValueError('Invalid TPP collected amount')
                if not isinstance(b.get('source_note'), str) or not b['source_note'].strip():
                    raise ValueError('TPP benchmark source required')
        if row['kind'] == 'cities' and ('tppFiled' in row or 'tppBenchmarks' in row):
            raise ValueError('City inputs cannot contain county TPP counts')
    return data

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/estimates/monthly.json')
    parser.add_argument('--replace', action='store_true', help='Explicitly replace an existing jurisdiction/month')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        incoming = validate(json.loads(args.input.read_text()))
        existing = validate(json.loads(args.output.read_text())) if args.output.exists() else {'schemaVersion': 1, 'records': []}
        key = lambda row: (row['kind'], row['slug'], row['month'])
        merged = {key(r): r for r in existing['records']}
        for row in incoming['records']:
            if key(row) in merged and merged[key(row)] != row and not args.replace:
                raise ValueError(f'{key(row)} already exists; use --replace after reviewing changes')
            merged[key(row)] = row
        result = validate({'schemaVersion': 1, 'records': sorted(merged.values(), key=key)})
        if not args.check:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            temp = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', dir=args.output.parent, delete=False, encoding='utf-8') as handle:
                    temp = handle.name
                    json.dump(result, handle, indent=2, ensure_ascii=False)
                    handle.write('\n')
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temp, args.output)
            finally:
                if temp and os.path.exists(temp):
                    os.unlink(temp)
        print(f"Validated {len(incoming['records'])} incoming records; {len(result['records'])} total snapshots" + (' (no write)' if args.check else ''))
    except (ValueError, OSError) as error:
        parser.exit(1, f'Estimate refresh failed: {error}\n')

if __name__ == '__main__':
    main()
