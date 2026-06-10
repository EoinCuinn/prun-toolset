import { useState, useRef } from 'react'

const COGC_TYPES = [
  { key: 'ADVERTISING_AGRICULTURE',         label: 'Agriculture' },
  { key: 'ADVERTISING_CHEMISTRY',           label: 'Chemistry' },
  { key: 'ADVERTISING_CONSTRUCTION',        label: 'Construction' },
  { key: 'ADVERTISING_ELECTRONICS',         label: 'Electronics' },
  { key: 'ADVERTISING_FOOD_INDUSTRIES',     label: 'Food Industries' },
  { key: 'ADVERTISING_FUEL_REFINING',       label: 'Fuel Refining' },
  { key: 'ADVERTISING_MANUFACTURING',       label: 'Manufacturing' },
  { key: 'ADVERTISING_METALLURGY',          label: 'Metallurgy' },
  { key: 'ADVERTISING_RESOURCE_EXTRACTION', label: 'Resource Extraction' },
  { key: 'WORKFORCE_PIONEERS',              label: 'Workforce: Pioneers' },
  { key: 'WORKFORCE_SETTLERS',              label: 'Workforce: Settlers' },
]

const CONDITION_BANDS = [
  { key: 'low',  label: 'Low' },
  { key: 'med',  label: 'Med' },
  { key: 'high', label: 'High' },
]

function BandToggle({ label, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: '2px 8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        borderRadius: '3px',
        cursor: 'pointer',
        border: `1px solid ${active ? '#4f8ef7' : '#2a3a5a'}`,
        background: active ? 'rgba(79,142,247,0.15)' : 'transparent',
        color: active ? '#4f8ef7' : '#4a6080',
        userSelect: 'none',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </span>
  )
}

function ConditionRow({ label, bands, activeBands, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 12px' }}>
      <span style={{ color: '#6a8aaa', fontSize: '11px', fontFamily: 'monospace', width: '64px', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {bands.map(b => (
          <BandToggle
            key={b.key}
            label={b.label}
            active={activeBands.includes(b.key)}
            onClick={() => onToggle(b.key)}
          />
        ))}
      </div>
    </div>
  )
}

function FilterPanel({
  activeCogc, onCogcChange,
  activeResources, onResourceChange,
  activePlanetFilters, onPlanetFiltersChange,
  materials,
}) {
  const [open, setOpen] = useState(false)
  const [resourceQuery, setResourceQuery] = useState('')
  const inputRef = useRef(null)

  const planetActiveCount = (
    (activePlanetFilters.fertile ? 1 : 0) +
    activePlanetFilters.gravity.length +
    activePlanetFilters.temp.length +
    activePlanetFilters.pressure.length
  )
  const hasActive = activeCogc.length > 0 || activeResources.length > 0 || planetActiveCount > 0
  const totalActive = activeCogc.length + activeResources.length + planetActiveCount

  const toggleCogc = (key) => {
    onCogcChange(activeCogc.includes(key)
      ? activeCogc.filter(k => k !== key)
      : [...activeCogc, key])
  }

  const addResource = (ticker) => {
    if (!activeResources.includes(ticker)) onResourceChange([...activeResources, ticker])
    setResourceQuery('')
    inputRef.current?.focus()
  }

  const removeResource = (ticker) => {
    onResourceChange(activeResources.filter(t => t !== ticker))
  }

  const toggleBand = (field, key) => {
    const current = activePlanetFilters[field]
    onPlanetFiltersChange({
      ...activePlanetFilters,
      [field]: current.includes(key) ? current.filter(k => k !== key) : [...current, key],
    })
  }

  const toggleFertile = () => {
    onPlanetFiltersChange({ ...activePlanetFilters, fertile: !activePlanetFilters.fertile })
  }

  const clearAll = () => {
    onCogcChange([])
    onResourceChange([])
    onPlanetFiltersChange({ fertile: false, gravity: [], temp: [], pressure: [] })
    setResourceQuery('')
  }

  const EXTRACTABLE = new Set([
    'ALO','AMM','AR','AUO','BER','BOR','BRM','BTS','CLI','CUO',
    'F','FEO','GAL','H','H2O','HAL','HE','HE3','HEX','KR',
    'LES','LIO','LST','MAG','MGS','N','NE','O','REO','SCR',
    'SIO','TAI','TCO','TIO','TS','ZIR'
  ])

  const suggestions = resourceQuery.length >= 1
    ? materials
        .filter(m =>
          EXTRACTABLE.has(m.Ticker) &&
          m.Ticker.toLowerCase().startsWith(resourceQuery.toLowerCase()) &&
          !activeResources.includes(m.Ticker)
        )
        .slice(0, 8)
    : []

  return (
    <div style={{
      position: 'fixed',
      top: '56px',
      left: '16px',
      zIndex: 200,
      fontFamily: 'monospace',
      width: '280px',
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          background: hasActive ? '#1e3a5f' : '#0f1117',
          color: hasActive ? '#4f8ef7' : '#6a8aaa',
          border: `1px solid ${hasActive ? '#4f8ef7' : '#1e3a5f'}`,
          borderRadius: open ? '4px 4px 0 0' : '4px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'monospace',
        }}
      >
        <span>▼ FILTERS {hasActive ? `(${totalActive})` : ''}</span>
        {hasActive && (
          <span
            onClick={e => { e.stopPropagation(); clearAll() }}
            style={{ color: '#888', fontSize: '11px' }}
          >
            clear
          </span>
        )}
      </button>

      {open && (
        <div style={{
          background: '#1a1f2e',
          border: '1px solid #1e3a5f',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          paddingBottom: '8px',
        }}>

          {/* ── Resource filter ── */}
          <div style={{ padding: '8px 12px 4px', borderBottom: '1px solid #1e3a5f' }}>
            <div style={{ color: '#4a5a7a', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '6px' }}>
              RESOURCE (TICKER)
            </div>
            {activeResources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {activeResources.map(ticker => (
                  <span key={ticker} style={{
                    background: '#1e3a5f', color: '#4f8ef7',
                    border: '1px solid #4f8ef7', borderRadius: '3px',
                    padding: '1px 6px', fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {ticker}
                    <span onClick={() => removeResource(ticker)} style={{ color: '#888' }}>×</span>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                value={resourceQuery}
                onChange={e => setResourceQuery(e.target.value.toUpperCase())}
                placeholder="Type ticker e.g. FEO"
                style={{
                  width: '100%', background: '#0f1117', border: '1px solid #1e3a5f',
                  borderRadius: '3px', color: '#a0b8d8', fontFamily: 'monospace',
                  fontSize: '12px', padding: '4px 8px', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#1a1f2e', border: '1px solid #1e3a5f',
                  borderTop: 'none', borderRadius: '0 0 3px 3px', zIndex: 300,
                }}>
                  {suggestions.map(m => (
                    <div
                      key={m.Ticker}
                      onClick={() => addResource(m.Ticker)}
                      style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#a0b8d8', display: 'flex', gap: '8px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1e3a5f'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: '#4f8ef7', minWidth: '36px' }}>{m.Ticker}</span>
                      <span style={{ color: '#4a5a7a', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.Name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── COGC filter ── */}
          <div style={{ paddingTop: '8px', borderBottom: '1px solid #1e3a5f', paddingBottom: '8px' }}>
            <div style={{ color: '#4a5a7a', fontSize: '10px', padding: '0 12px 6px', letterSpacing: '0.1em' }}>
              COGC PROGRAM
            </div>
            {COGC_TYPES.map(({ key, label }) => {
              const active = activeCogc.includes(key)
              return (
                <div
                  key={key}
                  onClick={() => toggleCogc(key)}
                  style={{
                    padding: '4px 12px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '8px',
                    color: active ? '#4f8ef7' : '#6a8aaa',
                    background: active ? 'rgba(79,142,247,0.08)' : 'transparent',
                    fontSize: '12px',
                  }}
                >
                  <span style={{
                    width: '10px', height: '10px',
                    border: `1px solid ${active ? '#4f8ef7' : '#3a4a5f'}`,
                    borderRadius: '2px', background: active ? '#4f8ef7' : 'transparent',
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {label}
                </div>
              )
            })}
          </div>

          {/* ── Planet Conditions filter ── */}
          <div style={{ paddingTop: '8px' }}>
            <div style={{ color: '#4a5a7a', fontSize: '10px', padding: '0 12px 6px', letterSpacing: '0.1em' }}>
              PLANET CONDITIONS
            </div>

            {/* Fertile toggle */}
            <div
              onClick={toggleFertile}
              style={{
                padding: '4px 12px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '8px',
                color: activePlanetFilters.fertile ? '#4ade80' : '#6a8aaa',
                background: activePlanetFilters.fertile ? 'rgba(74,222,128,0.08)' : 'transparent',
                fontSize: '12px', marginBottom: '4px',
              }}
            >
              <span style={{
                width: '10px', height: '10px',
                border: `1px solid ${activePlanetFilters.fertile ? '#4ade80' : '#3a4a5f'}`,
                borderRadius: '2px', background: activePlanetFilters.fertile ? '#4ade80' : 'transparent',
                display: 'inline-block', flexShrink: 0,
              }} />
              Fertile only
            </div>

            {/* Gravity */}
            <ConditionRow
              label="Gravity"
              bands={CONDITION_BANDS}
              activeBands={activePlanetFilters.gravity}
              onToggle={key => toggleBand('gravity', key)}
            />

            {/* Temperature */}
            <ConditionRow
              label="Temp"
              bands={CONDITION_BANDS}
              activeBands={activePlanetFilters.temp}
              onToggle={key => toggleBand('temp', key)}
            />

            {/* Pressure */}
            <ConditionRow
              label="Pressure"
              bands={CONDITION_BANDS}
              activeBands={activePlanetFilters.pressure}
              onToggle={key => toggleBand('pressure', key)}
            />
          </div>

        </div>
      )}
    </div>
  )
}

export default FilterPanel
