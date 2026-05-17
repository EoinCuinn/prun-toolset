function Tag({ tag, label }) {
  return (
    <span title={label} style={{
      cursor: 'default',
      borderBottom: '1px dotted #555',
      paddingBottom: '1px',
    }}>{tag}</span>
  )
}

const RESOURCE_TYPE_COLOURS = {
  MINERAL: '#a0b8d8',
  LIQUID:  '#4ff7e1',
  GASEOUS: '#f7e14f',
}

function Sidebar({ system, planets, materials, filteredPlanetNaturalIds, onClose }) {
  if (!system) return null

  const allSystemPlanets = planets.filter(p => p.SystemId === system.SystemId)
  const systemPlanets = filteredPlanetNaturalIds
    ? allSystemPlanets.filter(p => filteredPlanetNaturalIds.has(p.PlanetNaturalId))
    : allSystemPlanets

  const materialMap = {}
  materials.forEach(m => { materialMap[m.MaterialId] = m })

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '320px',
      height: '100vh',
      background: '#1a1f2e',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '13px',
      overflowY: 'auto',
      zIndex: 1000,
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#4f8ef7', fontSize: '16px', fontWeight: 'bold' }}>{system.Name}</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      <div style={{ color: '#888', marginBottom: '16px' }}>
        {system.NaturalId} · {filteredPlanetNaturalIds
          ? `${systemPlanets.length} of ${allSystemPlanets.length} planet${allSystemPlanets.length !== 1 ? 's' : ''} match`
          : `${systemPlanets.length} planet${systemPlanets.length !== 1 ? 's' : ''}`}
      </div>

      {systemPlanets.map(planet => {
        const cogcTypes = planet.COGCPrograms
          ? [...new Set(planet.COGCPrograms.map(p => p.ProgramType).filter(Boolean))]
          : []

        const facilities = [
          planet.HasLocalMarket && { tag: 'LM', label: 'Local Market' },
          planet.HasWarehouse && { tag: 'WH', label: 'Warehouse' },
          planet.HasShipyard && { tag: 'SY', label: 'Shipyard' },
          planet.HasChamberOfCommerce && { tag: 'CoC', label: 'Chamber of Commerce' },
          planet.HasAdministrationCenter && { tag: 'ADM', label: 'Administration Center' },
        ].filter(Boolean)

        const resources = (planet.Resources || [])
          .map(r => ({ ...r, material: materialMap[r.MaterialId] }))
          .filter(r => r.material)
          .sort((a, b) => b.Factor - a.Factor)

        return (
          <div key={planet.PlanetNaturalId} style={{
            marginBottom: '16px',
            padding: '10px',
            background: '#0f1117',
            borderRadius: '6px',
            borderLeft: '3px solid #4f8ef7'
          }}>
            <div style={{ color: '#4f8ef7', marginBottom: '6px', fontWeight: 'bold' }}>
              {planet.PlanetName}
              <span style={{ color: '#888', fontWeight: 'normal', marginLeft: '8px' }}>{planet.PlanetNaturalId}</span>
            </div>

            <div style={{ color: '#888', fontSize: '11px', marginBottom: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {facilities.length > 0
                ? facilities.map(({ tag, label }, i) => (
                    <span key={tag}>
                      <Tag tag={tag} label={label} />
                      {i < facilities.length - 1 && <span style={{ marginLeft: '6px' }}>·</span>}
                    </span>
                  ))
                : 'No facilities'}
            </div>

            {cogcTypes.length > 0 && (
              <div style={{ color: '#f7a84f', fontSize: '11px', marginBottom: '6px' }}>
                COGC: {cogcTypes.join(', ')}
              </div>
            )}

            {resources.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ color: '#4a5a7a', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  RESOURCES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {resources.map(r => {
                    const pct = Math.round(r.Factor * 100)
                    const colour = RESOURCE_TYPE_COLOURS[r.ResourceType] || '#888'
                    return (
                      <div key={r.MaterialId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span style={{ color: colour, minWidth: '32px', fontWeight: 'bold' }}>
                          {r.material.Ticker}
                        </span>
                        <div style={{ flex: 1, background: '#1a1f2e', borderRadius: '2px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: '2px' }} />
                        </div>
                        <span style={{ color: '#4a5a7a', minWidth: '30px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <a
              href={`https://prunplanner.org/plan/${planet.PlanetNaturalId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#4f8ef7', fontSize: '11px' }}
            >
              Open in PRunplanner →
            </a>
          </div>
        )
      })}
    </div>
  )
}

export default Sidebar
