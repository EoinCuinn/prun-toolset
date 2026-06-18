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
  const [activePlanetFilters, setActivePlanetFilters] = useState({ fertile: false, gravity: [], temp: [], pressure: [] })
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
      const param = new URLSearchParams(window.location.search).get('system')
      if (param) {
        const sys = systemData.find(s =>
          s.NaturalId.toUpperCase() === param.toUpperCase() ||
          s.Name?.toUpperCase() === param.toUpperCase()
        )
        if (sys) { setSelectedSystem(sys); setHighlightedSystem(sys) }
      }
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
    const hasFertile = activePlanetFilters.fertile
    const hasGravity = activePlanetFilters.gravity.length > 0
    const hasTemp = activePlanetFilters.temp.length > 0
    const hasPressure = activePlanetFilters.pressure.length > 0
    const hasAny = hasCogc || hasRes || hasFertile || hasGravity || hasTemp || hasPressure
    if (!hasAny) return { filteredSystemIds: null, filteredPlanetNaturalIds: null }

    const gravityBand = (v) => v < 0.25 ? 'low' : v <= 2.5  ? 'med' : 'high'
    const tempBand    = (v) => v < -25  ? 'low' : v <= 75   ? 'med' : 'high'
    const pressureBand= (v) => v < 0.25 ? 'low' : v <= 2    ? 'med' : 'high'

    const systemMatched = new Set()
    const planetMatched = new Set()
    planets.forEach(p => {
      if (!p.SystemId) return

      let cogcOk = true
      if (hasCogc) {
        const now = Date.now()
        const types = (p.COGCPrograms || [])
          .filter(c => c.ProgramType && c.StartEpochMs <= now && c.EndEpochMs > now)
          .map(c => c.ProgramType)
        cogcOk = activeCogc.some(f => types.includes(f))
      }

      let resOk = true
      if (hasRes) {
        const tickers = (p.Resources || []).map(r => materialIdToTicker[r.MaterialId]).filter(Boolean)
        resOk = activeResources.every(ticker => tickers.includes(ticker))
      }

      let fertileOk = true
      if (hasFertile) fertileOk = p.Fertility > 0

      let gravityOk = true
      if (hasGravity && p.Gravity != null)
        gravityOk = activePlanetFilters.gravity.includes(gravityBand(p.Gravity))

      let tempOk = true
      if (hasTemp && p.Temperature != null)
        tempOk = activePlanetFilters.temp.includes(tempBand(p.Temperature))

      let pressureOk = true
      if (hasPressure && p.Pressure != null)
        pressureOk = activePlanetFilters.pressure.includes(pressureBand(p.Pressure))

      if (cogcOk && resOk && fertileOk && gravityOk && tempOk && pressureOk) {
        systemMatched.add(p.SystemId)
        planetMatched.add(p.PlanetNaturalId)
      }
    })
    return { filteredSystemIds: systemMatched, filteredPlanetNaturalIds: planetMatched }
  }, [activeCogc, activeResources, activePlanetFilters, planets, materialIdToTicker])

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
            activePlanetFilters={activePlanetFilters}
            onPlanetFiltersChange={setActivePlanetFilters}
            materials={materials}
          />
        </>
      )}
      <Sidebar system={selectedSystem} planets={planets} materials={materials} filteredPlanetNaturalIds={filteredPlanetNaturalIds} onClose={() => setSelectedSystem(null)} />

      <a
        href="/home.html"
        style={{
          ...btnStyle(true),
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 100,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        ⌂ HOME
      </a>

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
