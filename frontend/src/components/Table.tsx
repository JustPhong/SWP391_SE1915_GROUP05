import type { ReactNode } from 'react';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function Table<T extends Record<string, any>>({ columns, data }: TableProps<T>) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5e7eb', color: '#374151' }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                {col.render ? col.render(row) : String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
