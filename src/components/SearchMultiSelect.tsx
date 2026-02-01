import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

const SearchMultiSelect: React.FC<Props> = ({
  options,
  selected,
  onChange,
  placeholder = 'Buscar...'
}) => {

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    return options.filter(o =>
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
    setOpen(false)   // <<< FECHA A LISTA
  }

  const removeItem = (v: string) => {
    onChange(selected.filter(i => i !== v))
  }

  return (
    <div ref={containerRef} className="relative">

      {/* Selected pills */}
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map(v => (
          <span
            key={v}
            className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1"
          >
            {v}
            <button onClick={() => removeItem(v)}>✕</button>
          </span>
        ))}
      </div>

      {/* Input */}
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full border rounded-lg p-2"
      />

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 bg-white border rounded-lg mt-1 w-full max-h-48 overflow-auto shadow">

          {filtered.map(opt => (
            <div
              key={opt}
              onClick={() => addItem(opt)}
              className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
            >
              {opt}
            </div>
          ))}

        </div>
      )}

    </div>
  )
}

export default SearchMultiSelect
