export function createLoadingScreen() {
  return new Promise((resolve) => {


    const styleEl = document.createElement('style')
    styleEl.textContent = `
      @keyframes scan {
        0% { top: -2px; opacity: 0; }
        4% { opacity: 1; }
        96% { opacity: 1; }
        100% { top: 100vh; opacity: 0; }
      }
      @keyframes orbitRing {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes counterRing {
        from { transform: rotate(0deg); }
        to { transform: rotate(-360deg); }
      }
      @keyframes breathe {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.04); }
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes glitch {
        0%, 90%, 100% { clip-path: none; transform: none; }
        91% { clip-path: inset(20% 0 60% 0); transform: translateX(-4px); }
        92% { clip-path: inset(60% 0 20% 0); transform: translateX(4px); }
        93% { clip-path: none; transform: none; }
      }
      @keyframes progressPulse {
        0%, 100% { box-shadow: 0 0 6px rgba(255,160,94,0.3); }
        50% { box-shadow: 0 0 16px rgba(255,160,94,0.8); }
      }
    `
    document.head.appendChild(styleEl)

    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: #000006;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding: 0 10vw;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      overflow: hidden;
    `
    document.body.appendChild(overlay)

    const starsBg = document.createElement('canvas')
    starsBg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    starsBg.width = window.innerWidth
    starsBg.height = window.innerHeight
    overlay.appendChild(starsBg)
    const sc = starsBg.getContext('2d')
    const stars = Array.from({ length: 2000 }, () => ({
      x: Math.random() * starsBg.width,
      y: Math.random() * starsBg.height,
      r: Math.random() * 1.3,
      alpha: 0.1 + Math.random() * 0.9,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.008 + Math.random() * 0.025,
      color: Math.random() < 0.2 ? [255,210,155] : Math.random() < 0.4 ? [168,196,255] : [255,255,255]
    }))
    let animating = true
    let frame = 0
    function drawStars(t) {
      if (!animating) return
      frame++
      sc.fillStyle = '#000006'
      sc.fillRect(0, 0, starsBg.width, starsBg.height)
      stars.forEach(s => {
        const a = s.alpha * (0.4 + 0.6 * Math.sin(s.twinkle + t * s.speed))
        sc.beginPath()
        sc.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        sc.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${a})`
        sc.fill()
      })
      requestAnimationFrame(drawStars)
    }
    requestAnimationFrame(drawStars)


    const horizonGlow = document.createElement('div')
    horizonGlow.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 40vh;
      background: radial-gradient(ellipse at 50% 110%, rgba(255,80,20,0.07) 0%, rgba(255,50,10,0.03) 40%, transparent 70%);
      pointer-events: none;
      z-index: 1;
    `
    overlay.appendChild(horizonGlow)


    const scanLine = document.createElement('div')
    scanLine.style.cssText = `
      position: absolute;
      left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(255,160,94,0.08) 20%, rgba(255,211,166,0.25) 50%, rgba(255,160,94,0.08) 80%, transparent 100%);
      animation: scan 5s linear infinite;
      pointer-events: none;
      z-index: 3;
    `
    overlay.appendChild(scanLine)


    ;[
      'top:20px;left:20px;border-top:1px solid rgba(255,160,94,0.5);border-left:1px solid rgba(255,160,94,0.5)',
      'top:20px;right:20px;border-top:1px solid rgba(255,160,94,0.5);border-right:1px solid rgba(255,160,94,0.5)',
      'bottom:20px;left:20px;border-bottom:1px solid rgba(255,160,94,0.5);border-left:1px solid rgba(255,160,94,0.5)',
      'bottom:20px;right:20px;border-bottom:1px solid rgba(255,160,94,0.5);border-right:1px solid rgba(255,160,94,0.5)',
    ].forEach((c, i) => {
      const el = document.createElement('div')
      el.style.cssText = `position:absolute;${c};width:28px;height:28px;pointer-events:none;z-index:3;opacity:0;transition:opacity 0.6s ease ${i * 0.1}s`
      overlay.appendChild(el)
      setTimeout(() => { el.style.opacity = '1' }, 150)
    })


    const topRule = document.createElement('div')
    topRule.style.cssText = `position:absolute;top:56px;left:20px;right:20px;height:1px;background:linear-gradient(90deg,rgba(255,160,94,0.35),rgba(255,160,94,0.05));pointer-events:none;z-index:3;transform:scaleX(0);transform-origin:left;transition:transform 1.2s ease 0.3s`
    overlay.appendChild(topRule)
    setTimeout(() => { topRule.style.transform = 'scaleX(1)' }, 50)

    const bottomRule = document.createElement('div')
    bottomRule.style.cssText = `position:absolute;bottom:56px;left:20px;right:20px;height:1px;background:linear-gradient(90deg,rgba(255,160,94,0.35),rgba(255,160,94,0.05));pointer-events:none;z-index:3;transform:scaleX(0);transform-origin:left;transition:transform 1.2s ease 0.5s`
    overlay.appendChild(bottomRule)
    setTimeout(() => { bottomRule.style.transform = 'scaleX(1)' }, 50)


    const coords = document.createElement('div')
    coords.style.cssText = `position:absolute;top:26px;left:28px;font-size:9px;letter-spacing:0.22em;color:rgba(255,160,94,0.45);pointer-events:none;z-index:4;opacity:0;transition:opacity 0.6s ease 0.8s`
    coords.textContent = 'LAT +00°00\'00"  ·  LON +00°00\'00"  ·  ALT ∞'
    overlay.appendChild(coords)
    setTimeout(() => { coords.style.opacity = '1' }, 50)


    const status = document.createElement('div')
    status.style.cssText = `position:absolute;top:26px;right:28px;font-size:9px;letter-spacing:0.2em;color:rgba(255,160,94,0.45);pointer-events:none;z-index:4;text-align:right;opacity:0;transition:opacity 0.6s ease 0.8s`
    status.innerHTML = 'SYSTEM STATUS: <span style="color:rgba(100,255,150,0.75)">NOMINAL</span>'
    overlay.appendChild(status)
    setTimeout(() => { status.style.opacity = '1' }, 50)


    const iconWrap = document.createElement('div')
    iconWrap.style.cssText = `position:absolute;right:10vw;top:50%;transform:translateY(-50%);width:160px;height:160px;pointer-events:none;z-index:4;opacity:0;transition:opacity 1s ease 1.5s`
    overlay.appendChild(iconWrap)
    setTimeout(() => { iconWrap.style.opacity = '1' }, 50)

    iconWrap.innerHTML = `
      <svg viewBox="0 0 160 160" width="160" height="160">
        <defs>
          <radialGradient id="bhGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#000006"/>
            <stop offset="60%" stop-color="#000006"/>
            <stop offset="80%" stop-color="rgba(255,120,30,0.15)"/>
            <stop offset="100%" stop-color="rgba(255,80,10,0.0)"/>
          </radialGradient>
          <linearGradient id="diskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(255,80,10,0.0)"/>
            <stop offset="30%" stop-color="rgba(255,160,50,0.6)"/>
            <stop offset="50%" stop-color="rgba(255,220,140,0.9)"/>
            <stop offset="70%" stop-color="rgba(255,100,20,0.4)"/>
            <stop offset="100%" stop-color="rgba(255,80,10,0.0)"/>
          </linearGradient>
        </defs>
        <!-- outer ring spinning -->
        <g style="animation:orbitRing 8s linear infinite;transform-origin:80px 80px">
          <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,160,94,0.12)" stroke-width="1" stroke-dasharray="4 8"/>
        </g>
        <!-- middle ring counter -->
        <g style="animation:counterRing 5s linear infinite;transform-origin:80px 80px">
          <circle cx="80" cy="80" r="56" fill="none" stroke="rgba(255,160,94,0.18)" stroke-width="1" stroke-dasharray="2 6"/>
        </g>
        <!-- disk ellipse -->
        <ellipse cx="80" cy="80" rx="68" ry="12" fill="none" stroke="url(#diskGrad)" stroke-width="2" opacity="0.7"/>
        <!-- photon ring -->
        <circle cx="80" cy="80" r="34" fill="none" stroke="rgba(255,200,120,0.5)" stroke-width="1.5" style="animation:breathe 3s ease infinite"/>
        <!-- event horizon -->
        <circle cx="80" cy="80" r="26" fill="url(#bhGrad)"/>
        <circle cx="80" cy="80" r="26" fill="#000006"/>
        <!-- inner glow ring -->
        <circle cx="80" cy="80" r="28" fill="none" stroke="rgba(255,160,80,0.3)" stroke-width="1"/>
      </svg>
    `


    const attribution = document.createElement('div')
    attribution.style.cssText = `position:absolute;bottom:26px;left:28px;font-size:9px;letter-spacing:0.22em;color:rgba(255,211,166,0.28);pointer-events:none;z-index:4;line-height:1.8;opacity:0;transition:opacity 0.8s ease 1.2s`
    attribution.innerHTML = `CREATED BY SANSKRITI SHELKE &nbsp;·&nbsp; MSC ADVANCED COMPUTING · DURHAM UNIVERSITY · 2026`
    overlay.appendChild(attribution)
    setTimeout(() => { attribution.style.opacity = '1' }, 50)


    const bottomCoords = document.createElement('div')
    bottomCoords.style.cssText = `position:absolute;bottom:26px;right:28px;font-size:9px;letter-spacing:0.2em;color:rgba(255,160,94,0.3);pointer-events:none;z-index:4;text-align:right;opacity:0;transition:opacity 0.8s ease 1.2s`
    bottomCoords.textContent = 'BOYER-LINDQUIST COORDS · M=1 UNITS'
    overlay.appendChild(bottomCoords)
    setTimeout(() => { bottomCoords.style.opacity = '1' }, 50)


    const content = document.createElement('div')
    content.style.cssText = 'position:relative;z-index:5;max-width:580px;width:100%'
    overlay.appendChild(content)


    const progressWrap = document.createElement('div')
    progressWrap.style.cssText = `width:100%;height:1px;background:rgba(255,160,94,0.1);margin-top:22px;overflow:hidden`
    const progressBar = document.createElement('div')
    progressBar.style.cssText = `height:100%;width:0%;background:linear-gradient(90deg,rgba(255,140,60,0.7),rgba(255,220,150,1));transition:width 0.35s ease;animation:progressPulse 2s ease infinite`
    progressWrap.appendChild(progressBar)

    const lines = [
      { text: 'GARGANTUA.exe', delay: 0, style: 'font-size:38px;letter-spacing:.26em;color:rgba(255,211,166,0.95);margin-bottom:4px;font-weight:300;animation:glitch 14s ease infinite', progress: 0 },
      { text: '// you are not supposed to be here', delay: 280, style: 'font-size:11px;color:rgba(255,211,166,0.3);margin-bottom:30px;letter-spacing:0.22em', progress: 0 },
      { text: '> INITIALISING NULL GEODESIC ENGINE', delay: 650, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 12, suffix: '...............OK', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> SCHWARZSCHILD METRIC', delay: 950, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 24, suffix: '.........................LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> KERR FRAME-DRAG  [ a/M = 0.62 ]', delay: 1220, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 36, suffix: '...............LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> THIN DISK TRANSFER MODEL', delay: 1490, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 50, suffix: '......................LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> BLANDFORD-ZNAJEK JET EMISSION', delay: 1760, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 62, suffix: '..................LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> PHOTON SPHERE TRACERS [ N = 64 ]', delay: 2030, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 74, suffix: '...............LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> STAR FIELD  [ 90,000 + NEBULAE ]', delay: 2300, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 86, suffix: '...............LOADED', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '> BEKENSTEIN-HAWKING THERMODYNAMICS', delay: 2570, style: 'font-size:10px;color:rgba(255,211,166,0.5);letter-spacing:0.16em', progress: 96, suffix: '..............READY', suffixColor: 'rgba(100,255,150,0.65)' },
      { text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', delay: 2850, style: 'font-size:9px;color:rgba(255,160,94,0.15);margin:12px 0 8px;letter-spacing:0.02em', progress: 100 },
      { text: 'T_H = 6.19×10⁻⁹ K  ·  S/k_B = 1.05×10⁷⁹  ·  T_EVAP = 2.09×10⁷⁰ yr', delay: 3050, style: 'font-size:9px;color:rgba(255,211,166,0.22);letter-spacing:0.12em;margin-bottom:5px', progress: 100 },
      { text: '⚠  r_photon = 1.5 Rₛ  ·  r_ISCO = 3 Rₛ  ·  CAUTION: EVENT HORIZON IS A TERMINAL BOUNDARY', delay: 3280, style: 'font-size:9px;color:rgba(255,130,50,0.4);letter-spacing:0.1em;margin-bottom:26px', progress: 100 },
    ]

    lines.forEach(({ text, delay, style, progress, suffix, suffixColor }) => {
      setTimeout(() => {
        const line = document.createElement('div')
        if (suffix) {
          line.innerHTML = `<span>${text}</span><span style="color:${suffixColor}">${suffix}</span>`
        } else {
          line.textContent = text
        }
        line.style.cssText = `${style};opacity:0;transition:opacity 0.3s ease;margin-bottom:2px`
        content.appendChild(line)
        if (progress > 0) progressBar.style.width = `${progress}%`
        requestAnimationFrame(() => setTimeout(() => { line.style.opacity = '1' }, 20))
      }, delay)
    })

    setTimeout(() => { content.appendChild(progressWrap) }, 620)


    const enterBtn = document.createElement('button')
    enterBtn.textContent = '[ ENTER SIMULATION ]'
    enterBtn.style.cssText = `
      background: transparent;
      border: 1px solid rgba(255,160,94,0.35);
      color: rgba(255,211,166,0.75);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      letter-spacing: 0.34em;
      padding: 14px 42px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.25s ease;
      text-transform: uppercase;
      display: block;
    `
    enterBtn.addEventListener('mouseenter', () => {
      enterBtn.style.background = 'rgba(122,47,20,0.28)'
      enterBtn.style.borderColor = 'rgba(255,160,94,1)'
      enterBtn.style.color = 'rgba(255,225,185,1)'
      enterBtn.style.boxShadow = '0 0 36px rgba(255,100,30,0.22), inset 0 0 18px rgba(255,80,10,0.06)'
      enterBtn.style.letterSpacing = '0.4em'
    })
    enterBtn.addEventListener('mouseleave', () => {
      enterBtn.style.background = 'transparent'
      enterBtn.style.borderColor = 'rgba(255,160,94,0.35)'
      enterBtn.style.color = 'rgba(255,211,166,0.75)'
      enterBtn.style.boxShadow = 'none'
      enterBtn.style.letterSpacing = '0.34em'
    })
    enterBtn.addEventListener('click', () => {
      animating = false
      overlay.style.transition = 'opacity 1.8s ease'
      overlay.style.opacity = '0'
      setTimeout(() => { overlay.remove(); resolve() }, 1800)
    })

    setTimeout(() => {
      content.appendChild(enterBtn)
      requestAnimationFrame(() => {
        setTimeout(() => {
          enterBtn.style.opacity = '1'
          let pulse = true
          const iv = setInterval(() => {
            if (!document.body.contains(enterBtn)) { clearInterval(iv); return }
            enterBtn.style.borderColor = pulse ? 'rgba(255,160,94,0.95)' : 'rgba(255,160,94,0.2)'
            pulse = !pulse
          }, 1100)
        }, 80)
      })
    }, 3800)
  })
}
