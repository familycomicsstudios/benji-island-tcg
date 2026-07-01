import csv
from collections import Counter
from pathlib import Path

path = Path('tsv/bs26.tsv')
with path.open('r', encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f, delimiter='\t'))

counts = Counter()
for row in rows:
    for key, value in row.items():
        if value is None or str(value).strip() == '':
            counts[key] += 1

for key in sorted(counts):
    print(f'{key}: {counts[key]}')
