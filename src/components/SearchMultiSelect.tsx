import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  label?: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

const SearchMultiSelect: React.FC<Props> = ({
  label,
  options,
  selected,
  onChange,
  placeholder
}) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    return (options || []).filter(o =>
      o &&
      o.toLowerCase().includes(query.toLowerCase()) &&
      !selected.includes(o)
    )
  }, [options, query, selected])

  /* 👉 FECHA AO CLICAR FORA */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  /* 👉 ADICIONA ITEM */
  const addItem = (v: string) => {
    onChange([...selected, v])
    setQuery('')
    setOpen(false)
  }

  const removeItem = (v: string) => {
    onChange(selected.filter(i => i !== v))
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            {label}
          </label>
          {selected.length > 0 && (
            <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
              {selected.length} selecionado{selected.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-100">
          {selected.map(v => (
            <span
              key={v}
              className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <span className="truncate max-w-[120px]">{v}</span>
              <button
                type="button"
                onClick={() => removeItem(v)}
                className="text-blue-500 hover:text-blue-800 font-bold hover:bg-blue-100 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px]"
                title="Remover filtro"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || `Buscar ${label ? label.toLowerCase() : ''}...`}
        className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition"
      />

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 bg-white border border-slate-200 rounded-xl mt-1 w-full max-h-48 overflow-auto shadow-xl py-1 text-xs">
          {filtered.slice(0, 50).map(opt => (
            <div
              key={opt}
              onClick={() => addItem(opt)}
              className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer font-medium text-slate-700 transition"
            >
              {opt}
            </div>
          ))}
          {filtered.length > 50 && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 text-center italic bg-slate-50">
              +{filtered.length - 50} opções. Refine sua busca.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SearchMultiSelect
