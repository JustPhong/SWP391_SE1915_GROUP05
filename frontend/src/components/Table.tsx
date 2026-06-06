import type { ReactNode } from 'react';

interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({ columns, data, emptyMessage = 'No data' }: TableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'left',
                  borderBottom: '2px solid #ddd',
                  fontWeight: '600',
                  color: '#555',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: 'center', padding: '2rem', color: '#888' }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #eee' }}
                  >
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
