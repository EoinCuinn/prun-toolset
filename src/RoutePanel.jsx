import { useState, useEffect, useRef } from 'react'
import dijkstra from 'dijkstrajs'

function RouteSearchBox({ label, systems, planets, onSelect, onClear }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    if (selected) { setSelected(null); onClear() }

    if (q.length < 2) { setResults([]); return }

    const lower = q.toLowerCase()
    const matchedSystems = systems.filter(s =>
      s.Name.toLowerCase().includes(lower) ||
      s.NaturalId.toLowerCase().includes(lower)
    ).slice(0, 4).map(s => ({ type: 'system', label: `${s.Name} (${s.NaturalId})`, data: s }))

    const matchedPlanets = planets.filter(p =>
      p.PlanetName.toLowerCase().includes(lower) ||
      p.PlanetNaturalId.toLowerCase().includes(lower)
    ).slice(0, 4).map(p => ({ type: 'planet', label: `${p.PlanetName} (${p.PlanetNaturalId})`, data: p }))

    setResults([...matchedSystems, ...matchedPlanets])
  }

  const handleSelect = (result) => {
    let system
    if (result.type === 'system') {
      system = result.data
    } else {
      system = systems.find(s => s.SystemId === result.data.SystemId)
    }
    if (system) {
      setQuery(result.label)
      setResults([])
      setSelected(system)
      onSelect(system)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setSelected(null)
    onClear()
  }

  return (
    <div style={{ position: 'relative', marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', color: '#4f8ef7', fontFamily: 'monospace', marginBottom: '4px', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search system or planet..."
          style={{
            width: '100%',
            padding: '7px 28px 7px 10px',
            background: '#0f1117',
            border: `1px solid ${selected ? '#4f8ef7' : '#2a3a5f'}`,
            borderRadius: '6px',
            color: selected ? '#4f8ef7' : '#fff',
            fontFamily: 'monospace',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {query.length > 0 && (
          <span onClick={handleClear} style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: 'translateY(-50%)', color: '#555',
            cursor: 'pointer', fontSize: '14px', lineHeight: 1,
          }}>×</span>
        )}
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#1a1f2e', border: '1px solid #2a3a5f',
          borderRadius: '6px', marginTop: '2px', overflow: 'hidden', zIndex: 2000,
        }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => handleSelect(r)}
              style={{
                padding: '7px 10px', cursor: 'pointer',
                color: r.type === 'system' ? '#4f8ef7' : '#aaa',
                fontSize: '12px', fontFamily: 'monospace',
                borderBottom: i < results.length - 1 ? '1px solid #222' : 'none',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#0f1117'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {r.type === 'planet' && <span style={{ color: '#555', marginRight: '6px' }}>◆</span>}
              {r.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RoutePanel({ systems, planets, onClose, onRouteChange }) {
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [result, setResult] = useState(null)
  const [clearKey, setClearKey] = useState(0)
  const gatewayEdgesRef = useRef(new Set())

  // Load gateways once on mount
  useEffect(() => {
    fetch('/gateways.json').then(r => r.json()).then(gateways => {
      const natIdToSysId = {}
      systems.forEach(s => { natIdToSysId[s.NaturalId] = s.SystemId })
      gateways.forEach(g => {
        const srcId = natIdToSysId[g.source.slice(0, -1).toUpperCase()]
        const tgtId = natIdToSysId[g.target.slice(0, -1).toUpperCase()]
        if (srcId && tgtId) gatewayEdgesRef.current.add(srcId + '→' + tgtId)
      })
    })
  }, [])

  useEffect(() => {
    if (!origin || !destination) {
      setResult(null)
      onRouteChange(null)
      return
    }
    if (origin.SystemId === destination.SystemId) {
      setResult({ error: 'Origin and destination are the same system.' })
      onRouteChange(null)
      return
    }

    // Build adjacency graph including gateways
    const graph = {}
    systems.forEach(s => {
      graph[s.SystemId] = {}
      ;(s.Connections || []).forEach(c => {
        graph[s.SystemId][c.ConnectingId] = 1
      })
    })
    gatewayEdgesRef.current.forEach(edge => {
      const [src, tgt] = edge.split('→')
      if (graph[src]) graph[src][tgt] = 1
    })

    try {
      const path = dijkstra.find_path(graph, origin.SystemId, destination.SystemId)
      const usesGateway = path.some((id, i) => i > 0 && gatewayEdgesRef.current.has(path[i-1] + '→' + id))
      setResult({ path, jumps: path.length - 1, usesGateway })
      onRouteChange(path)
    } catch {
      setResult({ error: 'No route found between these systems.' })
      onRouteChange(null)
    }
  }, [origin, destination])

  const handleClear = () => {
    setOrigin(null)
    setDestination(null)
    setResult(null)
    onRouteChange(null)
    setClearKey(k => k + 1)
  }

  return (
    <div style={{
      position: 'fixed', top: '16px', left: '16px', width: '280px',
      background: '#1a1f2e', border: '1px solid #4f8ef7',
      borderRadius: '8px', padding: '12px', zIndex: 900, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#4f8ef7', fontFamily: 'monospace', fontSize: '12px', letterSpacing: '0.08em' }}>
          ⇢ ROUTE PLANNER
        </span>
        <span onClick={onClose} style={{ color: '#555', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</span>
      </div>

      <RouteSearchBox key={`from-${clearKey}`} label="FROM" systems={systems} planets={planets}
        onSelect={setOrigin} onClear={() => { setOrigin(null) }} />
      <RouteSearchBox key={`to-${clearKey}`} label="TO" systems={systems} planets={planets}
        onSelect={setDestination} onClear={() => { setDestination(null) }} />

      {result && !result.error && (
        <div style={{
          marginTop: '8px', padding: '8px 10px', background: '#0f1117',
          borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px',
          color: '#4f8ef7', textAlign: 'center', letterSpacing: '0.05em',
        }}>
          {result.jumps} jump{result.jumps !== 1 ? 's' : ''}
          {result.usesGateway && (
            <span style={{ color: '#a050ff', marginLeft: '8px', fontSize: '10px' }}>via gateway</span>
          )}
        </div>
      )}

      {result && result.error && (
        <div style={{
          marginTop: '8px', padding: '8px 10px', background: '#0f1117',
          borderRadius: '6px', fontFamily: 'monospace', fontSize: '11px',
          color: '#f74f4f', textAlign: 'center',
        }}>
          {result.error}
        </div>
      )}

      {(origin || destination) && (
        <div onClick={handleClear} style={{
          marginTop: '8px', textAlign: 'center', color: '#3a4a5f',
          fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.05em',
        }}>
          CLEAR
        </div>
      )}
    </div>
  )
}

export default RoutePanel
