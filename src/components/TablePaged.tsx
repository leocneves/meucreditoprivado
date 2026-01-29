
import React, { useState } from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
}

interface TablePagedProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
}

export const TablePaged = <T,>({ data, columns, pageSize = 10 }: TablePagedProps<T>) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / pageSize);

  const paginatedData = data.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-6 py-3 text-left">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
          {paginatedData.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-6 py-4 whitespace-nowrap">
                  {typeof col.accessor === 'function' 
                    ? col.accessor(row) 
                    : String(row[col.accessor] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded text-xs font-medium disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-500">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded text-xs font-medium disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};
