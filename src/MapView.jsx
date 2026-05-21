import { useEffect, useRef } from 'react'
import * as d3 from 'd3'


const SECTOR_NAMES = {
  0: "LB", 1: "OF", 2: "PD", 3: "IA", 4: "LS", 5: "KW", 6: "XH", 7: "DW",
  8: "WB", 9: "OT", 10: "XG", 11: "JK", 12: "YP", 13: "XD", 14: "QQ", 15: "XV",
  16: "IZ", 17: "QV", 18: "WC", 19: "TD", 20: "PG", 21: "PB", 22: "OT", 23: "ZK",
  24: "HP", 25: "UP", 26: "FW", 27: "UV", 28: "RC", 29: "YI", 30: "OY", 31: "CH",
  32: "CB", 33: "SO", 34: "RY", 35: "AM", 36: "JS", 37: "HM", 38: "OF", 39: "AM",
  40: "SL", 41: "UQ", 42: "YW", 43: "EL", 44: "DC", 45: "OY", 46: "YK", 47: "IY",
  48: "KI", 49: "OE", 50: "MG", 51: "WR", 52: "GC", 53: "YA", 54: "WU", 55: "QJ",
  56: "ZV", 57: "SE", 58: "CG", 59: "EW", 60: "UB", 61: "BS", 62: "FK", 63: "LG",
  64: "VH", 65: "GY", 66: "OP", 67: "AW", 68: "NL", 69: "IV", 70: "EM", 71: "VI",
  72: "EX", 73: "IZ", 74: "LS", 75: "FA", 76: "IC", 77: "EZ", 78: "XS", 79: "LG",
  80: "AU", 81: "GK", 82: "GM", 83: "OS", 84: "BI", 85: "BS", 86: "NJ", 87: "SG",
  88: "RV", 89: "KQ", 90: "KC", 91: "JS", 92: "AJ", 93: "EY", 94: "HV", 95: "CC",
  96: "NH", 97: "XU", 98: "AX", 99: "DX", 100: "UX", 101: "QR", 102: "IV", 103: "OS",
  104: "VB", 105: "QF", 106: "YV", 107: "NG", 108: "EE", 109: "JY", 110: "HY",
  111: "GH", 112: "BN", 113: "LZ", 114: "WO", 115: "UI", 116: "WX",
}

function sectorColour(sectorId) {
  const palette = [
    '#4f8ef7', '#f7814f', '#4ff7a0', '#f74f8e', '#f7e14f',
    '#a04ff7', '#4ff7e1', '#f7a04f', '#8ef74f', '#f74fa0',
    '#4fa0f7', '#f7cf4f', '#cf4ff7', '#4ff7cf', '#f74f4f',
    '#4fcff7', '#f7f74f', '#4f4ff7', '#f74fcf', '#4ff74f',
    '#e14f4f', '#4fe1f7', '#f7e14f', '#4ff7e1', '#e14ff7',
  ]
  const num = parseInt(sectorId.replace('sector-', ''), 10) || 0
  return palette[num % palette.length]
}

function axialRound(q, r) {
  const s = -q - r
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s)
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return [rq, rr]
}

function pixelToAxial(x, y, r) {
  const q = (2 / 3 * x) / r
  const rCoord = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / r
  return axialRound(q, rCoord)
}

function axialToPixel(q, r, size) {
  const x = size * (3 / 2 * q)
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
  return [x, y]
}

function hexPath(cx, cy, r) {
  const pts = [0, 60, 120, 180, 240, 300].map(a => {
    const rad = a * Math.PI / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  })
  return `M${pts.map(p => p.join(',')).join('L')}Z`
}

function MapView({ systems, planets, onSystemClick, onBackgroundClick, showLines, showSectors, showSystemNames, showGateways, highlightedSystem, hoveredSystem, filteredSystemIds, routePath }) {
  const svgRef = useRef(null)
  const sectorsGroupRef = useRef(null)
  const linesGroupRef = useRef(null)
  const gatewaysGroupRef = useRef(null)
  const showGatewaysRef = useRef(showGateways)
  const systemNamesGroupRef = useRef(null)
  const systemPosRef = useRef({})
  const zoomRef = useRef(null)
  const svgSelRef = useRef(null)
  const gRef = useRef(null)
  const selectedSectorRef = useRef(null)
  const defaultTransformRef = useRef(null)
  const preClickTransformRef = useRef(null)
  const showSystemNamesRef = useRef(showSystemNames)
  const filteredSystemIdsRef = useRef(filteredSystemIds)

  // Keep ref in sync with prop so deselect can read current value
  useEffect(() => {
    showSystemNamesRef.current = showSystemNames
  }, [showSystemNames])

  useEffect(() => {
    if (!systems || systems.length === 0) return

    const width = window.innerWidth
    const height = window.innerHeight

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', '#0f1117')

    svgSelRef.current = svg
    const g = svg.append('g')
    gRef.current = g

    const sectorSystems = {}
    systems.forEach(s => {
      if (!s.SectorId) return
      if (!sectorSystems[s.SectorId]) sectorSystems[s.SectorId] = []
      sectorSystems[s.SectorId].push(s)
    })

    // Compute true centroids in data-space
    const sectorCentroids = {}
    Object.entries(sectorSystems).forEach(([sid, sysList]) => {
      const cx = sysList.reduce((a, s) => a + s.PositionX, 0) / sysList.length
      const cy = sysList.reduce((a, s) => a + s.PositionY, 0) / sysList.length
      sectorCentroids[sid] = [cx, cy]
    })

    // Find the natural scale of the data to pick a good hex grid size
    // Use the median nearest-neighbour distance in data space
    const centroidList = Object.entries(sectorCentroids)
    const nnDists = centroidList.map(([, [cx, cy]]) => {
      let minD = Infinity
      centroidList.forEach(([, [ox, oy]]) => {
        const d = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2)
        if (d > 0 && d < minD) minD = d
      })
      return minD
    }).sort((a, b) => a - b)
    const medianNN = nnDists[Math.floor(nnDists.length / 2)]

    // Snap each centroid to axial hex grid using medianNN as grid unit
    const HEX_DATA_R = medianNN / Math.sqrt(3)

    const sectorAxial = {}
    Object.entries(sectorCentroids).forEach(([sid, [cx, cy]]) => {
      sectorAxial[sid] = pixelToAxial(cx, -cy, HEX_DATA_R)
    })

    // Find axial extent and fit to screen
    const allAxial = Object.values(sectorAxial)
    const qVals = allAxial.map(a => a[0])
    const rVals = allAxial.map(a => a[1])
    const qExtent = [Math.min(...qVals), Math.max(...qVals)]
    const rExtent = [Math.min(...rVals), Math.max(...rVals)]
    const qRange = qExtent[1] - qExtent[0] + 2
    const rRange = rExtent[1] - rExtent[0] + 2

    // hexSize is screen pixels per grid unit — fit to screen with padding
    const hexSize = Math.min(
      (width - 80) / (qRange * 1.5),
      (height - 80) / (rRange * Math.sqrt(3))
    )

    const [originX, originY] = axialToPixel(
      (qExtent[0] + qExtent[1]) / 2,
      (rExtent[0] + rExtent[1]) / 2,
      hexSize
    )
    const offsetX = width / 2 - originX
    const offsetY = height / 2 - originY

    const sectorScreenPos = {}
    Object.entries(sectorAxial).forEach(([sid, [q, r]]) => {
      const [px, py] = axialToPixel(q, r, hexSize)
      sectorScreenPos[sid] = [px + offsetX, py + offsetY]
    })

    const sectorCentroidData = {}
    Object.entries(sectorSystems).forEach(([sid, sysList]) => {
      sectorCentroidData[sid] = {
        cx: sysList.reduce((a, x) => a + x.PositionX, 0) / sysList.length,
        cy: sysList.reduce((a, x) => a + x.PositionY, 0) / sysList.length,
        xExtent: d3.extent(sysList, x => x.PositionX),
        yExtent: d3.extent(sysList, x => x.PositionY),
      }
    })

    const systemScreenPos = (s) => {
      const sid = s.SectorId
      if (!sid || !sectorScreenPos[sid]) return [width / 2, height / 2]
      const [hcx, hcy] = sectorScreenPos[sid]
      const { cx: cxData, cy: cyData, xExtent: lxe, yExtent: lye } = sectorCentroidData[sid]
      const localRange = Math.max(lxe[1] - lxe[0], lye[1] - lye[0], 1)
      const maxOffset = (Math.sqrt(3) / 2 * hexSize) * 0.82
      const scale = (maxOffset * 2) / localRange
      let lx = (s.PositionX - cxData) * scale
      let ly = -(s.PositionY - cyData) * scale
      const dist = Math.sqrt(lx * lx + ly * ly)
      if (dist > maxOffset) { lx = (lx / dist) * maxOffset; ly = (ly / dist) * maxOffset }
      return [hcx + lx, hcy + ly]
    }

    systems.forEach(s => {
      systemPosRef.current[s.SystemId] = systemScreenPos(s)
    })

    // ── Deselect helper ──────────────────────────────────────────────
    const deselect = () => {
      selectedSectorRef.current = null

      // Restore all hex appearances
      sectorsGroupRef.current.selectAll('path.sector-hex')
        .attr('fill-opacity', 0.07)
        .attr('stroke-opacity', 0.35)

      // Restore name labels to match the NAMES toggle state
      if (systemNamesGroupRef.current) {
        if (showSystemNamesRef.current) {
          systemNamesGroupRef.current.style('display', null)
          systemNamesGroupRef.current.selectAll('text.system-name').style('display', null)
        } else {
          systemNamesGroupRef.current.style('display', 'none')
        }
      }

      // Zoom back to where we were before clicking the sector
      const restoreTo = preClickTransformRef.current || defaultTransformRef.current
      if (svgSelRef.current && zoomRef.current && restoreTo) {
        svgSelRef.current.transition().duration(600)
          .call(zoomRef.current.transform, restoreTo)
      }
    }

    // ── Sector hex layer ─────────────────────────────────────────────
    const sectorsGroup = g.append('g').attr('class', 'sectors-layer')
    sectorsGroupRef.current = sectorsGroup

    Object.entries(sectorScreenPos).forEach(([sid, [scx, scy]]) => {
      const colour = sectorColour(sid)

      sectorsGroup.append('path')
        .attr('class', 'sector-hex')
        .attr('data-sid', sid)
        .attr('d', hexPath(scx, scy, hexSize - 2))
        .attr('fill', colour)
        .attr('fill-opacity', 0.07)
        .attr('stroke', colour)
        .attr('stroke-opacity', 0.35)
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation()

          // Clicking the already-selected sector deselects
          if (selectedSectorRef.current === sid) {
            deselect()
            return
          }

          selectedSectorRef.current = sid

          // Save current zoom so we can restore it on deselect
          preClickTransformRef.current = d3.zoomTransform(svgSelRef.current.node())

          // Dim all hexes, highlight selected
          sectorsGroup.selectAll('path.sector-hex')
            .attr('fill-opacity', 0.02)
            .attr('stroke-opacity', 0.08)

          sectorsGroup.select(`[data-sid="${sid}"]`)
            .attr('fill-opacity', 0.25)
            .attr('stroke-opacity', 0.9)

          // Show only this sector's system names
          if (systemNamesGroupRef.current) {
            systemNamesGroupRef.current.style('display', null)
            systemNamesGroupRef.current.selectAll('text.system-name')
              .style('display', d => d.SectorId === sid ? null : 'none')
          }

          // Zoom to fit this sector
          const [hcx, hcy] = sectorScreenPos[sid]
          const scale = Math.min(width, height) / (hexSize * 2.2)
          const tx = width / 2 - hcx * scale
          const ty = height / 2 - hcy * scale
          svgSelRef.current.transition().duration(600)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
        })

      sectorsGroup.append('text')
        .attr('x', scx).attr('y', scy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', colour).attr('fill-opacity', 0.2)
        .attr('font-family', 'monospace')
        .attr('font-size', hexSize * 0.7)
        .attr('pointer-events', 'none')
        .text(SECTOR_NAMES[parseInt(sid.replace('sector-', ''))] || sid.replace('sector-', 'S'))
    })

    // ── Connection lines ─────────────────────────────────────────────
    const systemById = {}
    systems.forEach(s => { systemById[s.SystemId] = s })

    const connections = []
    const seen = new Set()
    systems.forEach(s => {
      if (!s.Connections) return
      s.Connections.forEach(conn => {
        const key = [s.SystemId, conn.ConnectingId].sort().join('|')
        if (!seen.has(key) && systemById[conn.ConnectingId]) {
          seen.add(key)
          connections.push({ source: s, target: systemById[conn.ConnectingId] })
        }
      })
    })

    const linesGroup = g.append('g').attr('class', 'lines-layer')
    linesGroupRef.current = linesGroup

    linesGroup.selectAll('line')
      .data(connections).join('line')
      .attr('x1', d => systemScreenPos(d.source)[0])
      .attr('y1', d => systemScreenPos(d.source)[1])
      .attr('x2', d => systemScreenPos(d.target)[0])
      .attr('y2', d => systemScreenPos(d.target)[1])
      .attr('stroke', '#1e3a5f')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.6)

    // Build a lookup: SystemId -> sorted list of planets
    const planetsBySystem = {}
    if (planets) {
      planets.forEach(p => {
        if (!p.SystemId) return
        if (!planetsBySystem[p.SystemId]) planetsBySystem[p.SystemId] = []
        planetsBySystem[p.SystemId].push(p)
      })
      // Sort each system's planets by NaturalId
      Object.values(planetsBySystem).forEach(list => {
        list.sort((a, b) => a.PlanetNaturalId.localeCompare(b.PlanetNaturalId))
      })
    }

    // ── Tooltip ──────────────────────────────────────────────────────
    const tooltip = d3.select('body').append('div')
      .style('position', 'absolute')
      .style('background', '#1a1f2e')
      .style('border', '1px solid #2a3a5f')
      .style('border-radius', '6px')
      .style('font-family', 'monospace')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('min-width', '160px')
      .style('box-shadow', '0 4px 16px rgba(0,0,0,0.5)')

    // ── System dots ──────────────────────────────────────────────────
    g.selectAll('circle.system')
      .data(systems).join('circle')
      .attr('class', 'system')
      .attr('cx', d => systemScreenPos(d)[0])
      .attr('cy', d => systemScreenPos(d)[1])
      .attr('r', 1)
      .attr('fill', d => filteredSystemIds && !filteredSystemIds.has(d.SystemId) ? '#4f8ef7' : '#4f8ef7')
      .attr('opacity', d => filteredSystemIds ? (filteredSystemIds.has(d.SystemId) ? 1.0 : 0.15) : 0.8)
      .on('mouseover', (event, d) => {
        const sysPlanets = planetsBySystem[d.SystemId] || []
        const headerHtml = `
          <div style="padding:6px 10px 4px; border-bottom:1px solid #2a3a5f;">
            <div style="color:#4f8ef7; font-weight:bold; font-size:13px;">${d.Name}</div>
          </div>`
        const planetRows = sysPlanets.map(p => {
          const name = p.PlanetName && p.PlanetName !== p.PlanetNaturalId
            ? `<span style="color:#e0e8ff">${p.PlanetName}</span>`
            : ''
          const natId = `<span style="color:#6a8aaa">${p.PlanetNaturalId}</span>`
          return `<div style="padding:2px 10px; display:flex; justify-content:space-between; gap:12px;">
            <span>${name}</span><span>${natId}</span>
          </div>`
        }).join('')
        const emptyRow = sysPlanets.length === 0
          ? `<div style="padding:4px 10px; color:#4a5a7a; font-style:italic;">No planets</div>`
          : ''
        tooltip
          .style('opacity', 1)
          .html(headerHtml + `<div style="padding:4px 0;">${planetRows}${emptyRow}</div>`)
          .style('left', '-9999px').style('top', '-9999px') // render offscreen first to measure
        // Position after render so we can measure height
        requestAnimationFrame(() => {
          const th = tooltip.node().offsetHeight
          const tw = tooltip.node().offsetWidth
          const margin = 8
          let tx = event.pageX + 14
          let ty = event.pageY - 10
          // Flip left if overflowing right
          if (tx + tw + margin > window.innerWidth) tx = event.pageX - tw - 14
          // Flip up if overflowing bottom
          if (ty + th + margin > window.innerHeight) ty = event.pageY - th + 10
          // Clamp top
          if (ty < margin) ty = margin
          tooltip.style('left', tx + 'px').style('top', ty + 'px')
        })
      })
      .on('mousemove', (event) => {
        const th = tooltip.node().offsetHeight
        const tw = tooltip.node().offsetWidth
        const margin = 8
        let tx = event.pageX + 14
        let ty = event.pageY - 10
        if (tx + tw + margin > window.innerWidth) tx = event.pageX - tw - 14
        if (ty + th + margin > window.innerHeight) ty = event.pageY - th + 10
        if (ty < margin) ty = margin
        tooltip.style('left', tx + 'px').style('top', ty + 'px')
      })
      .on('mouseout', () => tooltip.style('opacity', 0))
      .on('click', (event, d) => { event.stopPropagation(); onSystemClick(d) })

    // ── Filter match rings ──────────────────────────────────────────
    const filterRingsGroup = g.append('g').attr('class', 'filter-rings-layer')

    const drawFilterRings = (ids) => {
      filterRingsGroup.selectAll('*').remove()
      if (!ids) return
      systems.forEach(s => {
        if (!ids.has(s.SystemId)) return
        const [fx, fy] = systemScreenPos(s)
        filterRingsGroup.append('circle')
          .attr('cx', fx).attr('cy', fy)
          .attr('r', 4)
          .attr('fill', 'none')
          .attr('stroke', '#f7e14f')
          .attr('stroke-width', 1)
          .attr('opacity', 0.9)
          .attr('pointer-events', 'none')
      })
    }

    drawFilterRings(filteredSystemIds)
    filteredSystemIdsRef.current = { ids: filteredSystemIds, draw: drawFilterRings }

    // ── Gateway arcs ─────────────────────────────────────────────────
    const gatewaysGroup = g.append('g')
      .attr('class', 'gateways-layer')
      .style('display', showGatewaysRef.current ? null : 'none')
    gatewaysGroupRef.current = gatewaysGroup

    // Build planet NaturalId -> SystemId map
    const planetToSystem = {}
    if (planets) {
      planets.forEach(p => {
        if (p.PlanetNaturalId && p.SystemId) planetToSystem[p.PlanetNaturalId] = p.SystemId
      })
    }

    fetch('/gateways.json')
      .then(r => r.json())
      .then(gwData => {
        const drawn = new Set()
        gwData.forEach(gw => {
          const sysA = planetToSystem[gw.source]
          const sysB = planetToSystem[gw.target]
          if (!sysA || !sysB) return

          // Deduplicate — skip if we've already drawn this pair in either direction
          const key = [sysA, sysB].sort().join('|')
          if (drawn.has(key)) return
          drawn.add(key)

          const posA = systemPosRef.current[sysA]
          const posB = systemPosRef.current[sysB]
          if (!posA || !posB) return

          const [x1, y1] = posA
          const [x2, y2] = posB
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.sqrt(dx * dx + dy * dy)
          const offset = len * 0.3
          const cpx = mx - (dy / len) * offset
          const cpy = my + (dx / len) * offset

          // Outer glow arc
          gatewaysGroup.append('path')
            .attr('d', `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`)
            .attr('fill', 'none')
            .attr('stroke', '#9b59b6')
            .attr('stroke-width', 2.5)
            .attr('stroke-opacity', 0.25)
            .attr('pointer-events', 'none')

          // Main arc
          gatewaysGroup.append('path')
            .attr('d', `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`)
            .attr('fill', 'none')
            .attr('stroke', '#c39bd3')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.85)
            .attr('stroke-dasharray', '3,2')
            .attr('pointer-events', 'none')
        })

        // Purple dots on systems that have a gateway planet
        const gatewaySystemIds = new Set()
        gwData.forEach(gw => {
          const sysId = planetToSystem[gw.source]
          if (sysId) gatewaySystemIds.add(sysId)
        })
        gatewaySystemIds.forEach(sysId => {
          const pos = systemPosRef.current[sysId]
          if (!pos) return
          gatewaysGroup.append('circle')
            .attr('cx', pos[0])
            .attr('cy', pos[1])
            .attr('r', 1)
            .attr('fill', '#c39bd3')
            .attr('opacity', 0.9)
            .attr('pointer-events', 'none')
        })
      })


    const systemNamesGroup = g.append('g')
      .attr('class', 'system-names-layer')
      .style('display', 'none')
    systemNamesGroupRef.current = systemNamesGroup

    systemNamesGroup.selectAll('text.system-name')
      .data(systems).join('text')
      .attr('class', 'system-name')
      .attr('x', d => systemScreenPos(d)[0])
      .attr('y', d => systemScreenPos(d)[1] - 3)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'auto')
      .attr('fill', '#a0b8d8')
      .attr('fill-opacity', 0.75)
      .attr('font-family', 'monospace')
      .attr('font-size', 3)
      .attr('pointer-events', 'none')
      .text(d => d.Name)

    // ── Click empty space to deselect / close sidebar ───────────────
    svg.on('click', () => {
      if (selectedSectorRef.current) {
        deselect()
      }
      if (onBackgroundClick) onBackgroundClick()
    })

    // ── Zoom & pan ───────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([0.3, 20])
      .on('zoom', (event) => { g.attr('transform', event.transform) })

    zoomRef.current = zoom
    svg.call(zoom)

    const defaultTransform = d3.zoomIdentity.scale(1)
    defaultTransformRef.current = defaultTransform
    svg.call(zoom.transform, defaultTransform)

    return () => {
      svg.selectAll('*').remove()
      svg.on('click', null)
      tooltip.remove()
      sectorsGroupRef.current = null
      linesGroupRef.current = null
      gatewaysGroupRef.current = null
      systemNamesGroupRef.current = null
      systemPosRef.current = {}
      selectedSectorRef.current = null
    }
  }, [systems])

  // ── Highlight effect ─────────────────────────────────────────────
  useEffect(() => {
    if (!gRef.current) return
    gRef.current.select('.highlight-ring').remove()
    if (!highlightedSystem) return
    const pos = systemPosRef.current[highlightedSystem.SystemId]
    if (!pos) return
    const [hx, hy] = pos
    gRef.current.append('circle')
      .attr('class', 'highlight-ring')
      .attr('cx', hx)
      .attr('cy', hy)
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 1)
    if (svgSelRef.current && zoomRef.current) {
      const width = window.innerWidth
      const height = window.innerHeight
      const scale = 4
      const tx = width / 2 - hx * scale
      const ty = height / 2 - hy * scale
      svgSelRef.current.transition().duration(600)
        .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }
  }, [highlightedSystem])

  useEffect(() => {
    showGatewaysRef.current = showGateways
    if (gatewaysGroupRef.current)
      gatewaysGroupRef.current.style('display', showGateways ? null : 'none')
  }, [showGateways])

  useEffect(() => {
      sectorsGroupRef.current.style('display', showSectors ? null : 'none')
  }, [showSectors])

  useEffect(() => {
    if (linesGroupRef.current)
      linesGroupRef.current.style('display', showLines ? null : 'none')
  }, [showLines])

  useEffect(() => {
    if (!systemNamesGroupRef.current) return
    // Only honour the toggle if no sector is currently selected
    if (!selectedSectorRef.current) {
      systemNamesGroupRef.current.style('display', showSystemNames ? null : 'none')
    }
  }, [showSystemNames])

  useEffect(() => {
    if (!gRef.current) return
    // Update dot opacity
    gRef.current.selectAll('circle.system')
      .attr('opacity', d => filteredSystemIds ? (filteredSystemIds.has(d.SystemId) ? 1.0 : 0.15) : 0.8)
    // Redraw filter rings
    if (filteredSystemIdsRef.current && filteredSystemIdsRef.current.draw) {
      filteredSystemIdsRef.current.draw(filteredSystemIds)
      filteredSystemIdsRef.current.ids = filteredSystemIds
    }
  }, [filteredSystemIds])

  // ── Hover preview effect ─────────────────────────────────────────
  useEffect(() => {
    if (!gRef.current) return
    gRef.current.select('.hover-ring').remove()
    if (!hoveredSystem) return
    const pos = systemPosRef.current[hoveredSystem.SystemId]
    if (!pos) return
    const [hx, hy] = pos
    const ring = gRef.current.append('circle')
      .attr('class', 'hover-ring')
      .attr('cx', hx)
      .attr('cy', hy)
      .attr('r', 4)
      .attr('fill', 'white')
      .attr('opacity', 1)
    function bounce() {
      ring.transition().duration(300).attr('r', 7).attr('opacity', 0.6)
        .transition().duration(300).attr('r', 4).attr('opacity', 1)
        .on('end', bounce)
    }
    bounce()
  }, [hoveredSystem])

  // ── Route path drawing ───────────────────────────────────────────
  useEffect(() => {
    if (!gRef.current) return
    gRef.current.selectAll('.route-layer').remove()
    if (!routePath || routePath.length < 2) return

    const routeGroup = gRef.current.append('g').attr('class', 'route-layer')

    for (let i = 0; i < routePath.length - 1; i++) {
      const posA = systemPosRef.current[routePath[i]]
      const posB = systemPosRef.current[routePath[i + 1]]
      if (!posA || !posB) continue

      routeGroup.append('line')
        .attr('x1', posA[0]).attr('y1', posA[1])
        .attr('x2', posB[0]).attr('y2', posB[1])
        .attr('stroke', '#4f8ef7')
        .attr('stroke-width', 0.75)
        .attr('stroke-opacity', 0.9)
        .attr('pointer-events', 'none')
    }

    routePath.forEach((sysId, i) => {
      const pos = systemPosRef.current[sysId]
      if (!pos) return
      const isOrigin = i === 0
      const isDestination = i === routePath.length - 1
      const isEndpoint = isOrigin || isDestination
      const colour = isOrigin ? '#4ff7a0' : isDestination ? '#f7814f' : '#4f8ef7'
      routeGroup.append('circle')
        .attr('cx', pos[0]).attr('cy', pos[1])
        .attr('r', isEndpoint ? 5 : 3)
        .attr('fill', 'none')
        .attr('stroke', colour)
        .attr('stroke-width', isEndpoint ? 1 : 0.75)
        .attr('pointer-events', 'none')
    })
  }, [routePath])

  return <svg ref={svgRef} />
}

export default MapView
