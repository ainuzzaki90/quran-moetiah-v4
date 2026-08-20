'use client';

import { useMemo, useState } from 'react';

export function useSortable<T extends Record<string, any>>(rows: T[], initialKey: string | null = null) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') { va = na; vb = nb; }
      else { va = String(va ?? '').toLowerCase(); vb = String(vb ?? '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  function clickSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function Th({ sortk, label }: { sortk: string; label: string }) {
    const icon = sortKey !== sortk ? '⇅' : sortDir === 'asc' ? '↑' : '↓';
    return (
      <th className="tf-th-sort" onClick={() => clickSort(sortk)}>
        {label} <span className={`tf-sort-icon ${sortKey === sortk ? 'tf-sort-active' : ''}`}>{icon}</span>
      </th>
    );
  }

  return { sorted, Th };
}
