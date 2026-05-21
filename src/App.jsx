import { useState, useEffect, useMemo } from 'react'
import MapView from './MapView'
import Sidebar from './Sidebar'
import SearchBar from './SearchBar'
import FilterPanel from './FilterPanel'
import RoutePanel from './RoutePanel'

function App() {
  const [systems, setSystems] = useState([])
  const [planets, setPlanets] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSystem, setSelectedSystem] = useState(null)
  const [highlightedSystem, setHighlightedSystem] = useState(null)
  const [hoveredSystem, setHoveredSystem] = useState(null)
  const [showLines, setShowLines] = useState(true)
  const [showSectors, setShowSectors] = useState(true)
  const [showSystemNames, setShowSystemNames] = useState(false)
  const [showGateways, setShowGateways] = useState(true)
  const [activeCogc, setActiveCogc] = useState([])
  const [activeResources, setActiveResources] = useState([])
  const [showRoute, setShowRoute] = useState(false)
  const [route, setRoute] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/prun_universe_data.json').then(r => r.json()),
      fetch('/planet_data.json').then(r => r.json()),
      fetch('/material_data.json').then(r => r.json()),
    ]).then(([systemData, planetData, materialData]) => {
      setSystems(systemData)
      setPlanets(planetData)
      setMaterials(materialData)
      setLoading(false)
    })
  }, [])

  const materialIdToTicker = useMemo(() => {
    const map = {}
    materials.forEach(m => { map[m.MaterialId] = m.Ticker })
    return map
  }, [materials])

  const { filteredSystemIds, filteredPlanetNaturalIds } = useMemo(() => {
    const hasCogc = activeCogc.length > 0
    const hasRes = activeResources.length > 0
    if (!hasCogc && !hasRes) return { filteredSystemIds: null, filteredPlanetNaturalIds: null }

    const systemMatched = new Set()
    const planetMatched = new Set()
    planets.forEach(p => {
      if (!p.SystemId) return

      let cogcOk = true
      if (hasCogc) {
        const types = (p.COGCPrograms || []).map(c => c.ProgramType).filter(Boolean)
        cogcOk = activeCogc.some(f => types.includes(f))
      }

      let resOk = true
      if (hasRes) {
        const tickers = (p.Resources || []).map(r => materialIdToTicker[r.MaterialId]).filter(Boolean)
        resOk = activeResources.every(ticker => tickers.includes(ticker))
      }

      if (cogcOk && resOk) {
        systemMatched.add(p.SystemId)
        planetMatched.add(p.PlanetNaturalId)
      }
    })
    return { filteredSystemIds: systemMatched, filteredPlanetNaturalIds: planetMatched }
  }, [activeCogc, activeResources, planets, materialIdToTicker])

  if (loading) return (
    <div style={{ background: '#0f1117', color: '#4f8ef7', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '24px' }}>
      Loading universe...
    </div>
  )

  const btnStyle = (active) => ({
    background: active ? '#1e3a5f' : '#0f1117',
    color: active ? '#4f8ef7' : '#3a4a5f',
    border: `1px solid ${active ? '#4f8ef7' : '#1e3a5f'}`,
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
    fontFamily: 'monospace',
  })

  return (
    <>
      <MapView
        systems={systems}
        planets={planets}
        onSystemClick={setSelectedSystem}
        onBackgroundClick={() => { setSelectedSystem(null); setHighlightedSystem(null) }}
        showLines={showLines}
        showSectors={showSectors}
        showSystemNames={showSystemNames}
        showGateways={showGateways}
        highlightedSystem={highlightedSystem}
        hoveredSystem={hoveredSystem}
        filteredSystemIds={filteredSystemIds}
        routePath={route}
      />
      {showRoute ? (
        <RoutePanel
          systems={systems}
          planets={planets}
          onClose={() => { setShowRoute(false); setRoute(null) }}
          onRouteChange={setRoute}
        />
      ) : (
        <>
          <SearchBar
            systems={systems}
            planets={planets}
            onSelectSystem={(system) => {
              setSelectedSystem(system)
              setHighlightedSystem(system)
              setHoveredSystem(null)
            }}
            onHoverSystem={setHoveredSystem}
          />
          <FilterPanel
            activeCogc={activeCogc}
            onCogcChange={setActiveCogc}
            activeResources={activeResources}
            onResourceChange={setActiveResources}
            materials={materials}
          />
        </>
      )}
      <Sidebar system={selectedSystem} planets={planets} materials={materials} filteredPlanetNaturalIds={filteredPlanetNaturalIds} onClose={() => setSelectedSystem(null)} />

      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        gap: '8px',
        zIndex: 100,
      }}>
        <button onClick={() => setShowSectors(v => !v)} style={btnStyle(showSectors)}>
          ⬡ SECTORS
        </button>
        <button onClick={() => setShowLines(v => !v)} style={btnStyle(showLines)}>
          ╌ LINES
        </button>
        <button onClick={() => setShowGateways(v => !v)} style={btnStyle(showGateways)}>
          ◈ GATEWAYS
        </button>
        <button onClick={() => setShowSystemNames(v => !v)} style={btnStyle(showSystemNames)}>
          ✦ NAMES
        </button>
        <button onClick={() => setShowRoute(v => !v)} style={btnStyle(showRoute)}>
          ⇢ ROUTE
        </button>
      </div>
    </>
  )
}

export default App
