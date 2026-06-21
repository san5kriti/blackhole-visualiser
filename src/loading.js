export function createLoadingScreen() {
  return new Promise((resolve) => {
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

    // ---- ANIMATED STARFIELD ----
    const starsBg = document.createElement('canvas')
    starsBg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    starsBg.width = window.innerWidth
    starsBg.height = window.innerHeight
    overlay.appendChild(starsBg)
    const sc = starsBg.getContext('2d')

    const stars = Array.from({ length: 1800 }, () => ({
      x: Math.random() * starsBg.width,
      y: Math.random() * starsBg.height,
      r: Math.random() * 1.2,
      alpha: 0.1 + Math.random() * 0.9,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.03
    }))

    let animating = true
    function drawStars(t) {
      if (!animating) return
      sc.clearRect(0, 0, starsBg.width, starsBg.height)
      sc.fillStyle = '#000006'
      sc.fillRect(0, 0, starsBg.width, starsBg.height)
      stars.forEach(s => {
        const a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinkle + t * s.speed))
        sc.beginPath()
        sc.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        sc.fillStyle = `rgba(255,255,255,${a})`
        sc.fill()
      })
      requestAnimationFrame(drawStars)
    }
    requestAnimationFrame(drawStars)

    // ---- SCANNING LINE ----
    const scanLine = document.createElement('div')
    scanLine.style.cssText = `
      position: absolute;
      left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,160,94,0.15), rgba(255,211,166,0.3), rgba(255,160,94,0.15), transparent);
      animation: scan 4s linear infinite;
      pointer-events: none;
      z-index: 3;
    `
    overlay.appendChild(scanLine)

    // ---- CORNER BRACKETS ----
    const corners = [
      'top:20px;left:20px;border-top:1px solid rgba(255,160,94,0.4);border-left:1px solid rgba(255,160,94,0.4)',
      'top:20px;right:20px;border-top:1px solid rgba(255,160,94,0.4);border-right:1px solid rgba(255,160,94,0.4)',
      'bottom:20px;left:20px;border-bottom:1px solid rgba(255,160,94,0.4);border-left:1px solid rgba(255,160,94,0.4)',
      'bottom:20px;right:20px;border-bottom:1px solid rgba(255,160,94,0.4);border-right:1px solid rgba(255,160,94,0.4)',
    ]
    corners.forEach(c => {
      const corner = document.createElement('div')
      corner.style.cssText = `position:absolute;${c};width:32px;height:32px;pointer-events:none;z-index:3;opacity:0;transition:opacity 0.8s ease`
      overlay.appendChild(corner)
      setTimeout(() => { corner.style.opacity = '1' }, 200)
    })

    // ---- HORIZONTAL RULE LINES ----
    const topRule = document.createElement('div')
    topRule.style.cssText = `
      position: absolute;
      top: 58px; left: 20px; right: 20px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,160,94,0.3), rgba(255,160,94,0.05));
      pointer-events: none;
      z-index: 3;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 1s ease 0.4s;
    `
    overlay.appendChild(topRule)
    setTimeout(() => { topRule.style.transform = 'scaleX(1)' }, 100)

    const bottomRule = document.createElement('div')
    bottomRule.style.cssText = `
      position: absolute;
      bottom: 58px; left: 20px; right: 20px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,160,94,0.3), rgba(255,160,94,0.05));
      pointer-events: none;
      z-index: 3;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 1s ease 0.6s;
    `
    overlay.appendChild(bottomRule)
    setTimeout(() => { bottomRule.style.transform = 'scaleX(1)' }, 100)

    // ---- COORDINATE DISPLAY TOP LEFT ----
    const coords = document.createElement('div')
    coords.style.cssText = `
      position: absolute;
      top: 28px; left: 28px;
      font-size: 9px;
      letter-spacing: 0.22em;
      color: rgba(255,160,94,0.5);
      pointer-events: none;
      z-index: 4;
      opacity: 0;
      transition: opacity 0.5s ease 0.8s;
    `
    coords.textContent = 'LAT +00°00\'00" · LON +00°00\'00" · ALT ∞'
    overlay.appendChild(coords)
    setTimeout(() => { coords.style.opacity = '1' }, 100)

    // ---- STATUS TOP RIGHT ----
    const status = document.createElement('div')
    status.style.cssText = `
      position: absolute;
      top: 28px; right: 28px;
      font-size: 9px;
      letter-spacing: 0.22em;
      color: rgba(255,160,94,0.5);
      pointer-events: none;
      z-index: 4;
      text-align: right;
      opacity: 0;
      transition: opacity 0.5s ease 0.8s;
    `
    status.innerHTML = 'SYSTEM STATUS: <span style="color:rgba(100,255,150,0.7)">NOMINAL</span>'
    overlay.appendChild(status)
    setTimeout(() => { status.style.opacity = '1' }, 100)

    // ---- ATTRIBUTION BOTTOM ----
    const attribution = document.createElement('div')
    attribution.style.cssText = `
      position: absolute;
      bottom: 28px; left: 28px;
      font-size: 9px;
      letter-spacing: 0.24em;
      color: rgba(255,211,166,0.3);
      pointer-events: none;
      z-index: 4;
      line-height: 1.9;
      opacity: 0;
      transition: opacity 0.8s ease 1s;
    `
    attribution.innerHTML = `
      CREATED BY SANSKRITI SHELKE &nbsp;·&nbsp; MSC ADVANCED COMPUTING · DURHAM UNIVERSITY · 2026
    `
    overlay.appendChild(attribution)
    setTimeout(() => { attribution.style.opacity = '1' }, 100)

    // ---- BOTTOM RIGHT COORDS ----
    const bottomCoords = document.createElement('div')
    bottomCoords.style.cssText = `
      position: absolute;
      bottom: 28px; right: 28px;
      font-size: 9px;
      letter-spacing: 0.2em;
      color: rgba(255,160,94,0.35);
      pointer-events: none;
      z-index: 4;
      text-align: right;
      opacity: 0;
      transition: opacity 0.8s ease 1s;
    `
    bottomCoords.textContent = 'BOYER-LINDQUIST COORDS · M=1 UNITS'
    overlay.appendChild(bottomCoords)
    setTimeout(() => { bottomCoords.style.opacity = '1' }, 100)

    // ---- MAIN CONTENT ----
    const content = document.createElement('div')
    content.style.cssText = 'position:relative;z-index:5;max-width:680px;width:100%'
    overlay.appendChild(content)

    // progress bar container
    const progressWrap = document.createElement('div')
    progressWrap.style.cssText = `
      width: 100%;
      height: 1px;
      background: rgba(255,160,94,0.12);
      margin-top: 24px;
      position: relative;
      overflow: hidden;
    `
    const progressBar = document.createElement('div')
    progressBar.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, rgba(255,160,94,0.6), rgba(255,211,166,0.9));
      transition: width 0.3s ease;
      box-shadow: 0 0 8px rgba(255,160,94,0.4);
    `
    progressWrap.appendChild(progressBar)

    const lines = [
      {
        text: 'GARGANTUA.exe',
        delay: 0,
        style: 'font-size:36px;letter-spacing:.28em;color:rgba(255,211,166,0.95);margin-bottom:4px;font-weight:300',
        progress: 0
      },
      {
        text: '// you are not supposed to be here',
        delay: 300,
        style: 'font-size:11px;color:rgba(255,211,166,0.35);margin-bottom:32px;letter-spacing:0.2em',
        progress: 0
      },
      {
        text: '> INITIALISING NULL GEODESIC ENGINE',
        delay: 700,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 12,
        suffix: '..................OK',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> SCHWARZSCHILD METRIC',
        delay: 1000,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 24,
        suffix: '..............................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> KERR FRAME-DRAG  [ a/M = 0.62 ]',
        delay: 1300,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 38,
        suffix: '..................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> THIN DISK TRANSFER MODEL',
        delay: 1600,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 52,
        suffix: '.........................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> BLANDFORD-ZNAJEK JET EMISSION',
        delay: 1900,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 64,
        suffix: '.....................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> PHOTON SPHERE TRACERS [ N = 64 ]',
        delay: 2200,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 76,
        suffix: '..................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> STAR FIELD  [ 90,000 + NEBULAE ]',
        delay: 2500,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 88,
        suffix: '..................LOADED',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '> BEKENSTEIN-HAWKING THERMODYNAMICS',
        delay: 2800,
        style: 'font-size:10px;color:rgba(255,211,166,0.55);letter-spacing:0.18em',
        progress: 96,
        suffix: '.................READY',
        suffixColor: 'rgba(100,255,150,0.6)'
      },
      {
        text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        delay: 3100,
        style: 'font-size:10px;color:rgba(255,160,94,0.18);margin:14px 0 10px;letter-spacing:0.02em',
        progress: 100
      },
      {
        text: 'T_H = 6.19×10⁻⁹ K  ·  S/k_B = 1.05×10⁷⁹  ·  T_EVAP = 2.09×10⁷⁰ yr',
        delay: 3300,
        style: 'font-size:9px;color:rgba(255,211,166,0.28);letter-spacing:0.14em;margin-bottom:6px',
        progress: 100
      },
      {
        text: '⚠  PHOTON SPHERE AT r = 1.5 Rₛ  ·  ISCO AT r = 3 Rₛ  ·  NO RETURN BEYOND EVENT HORIZON',
        delay: 3550,
        style: 'font-size:9px;color:rgba(255,140,60,0.45);letter-spacing:0.12em;margin-bottom:28px',
        progress: 100
      },
    ]

    lines.forEach(({ text, delay, style, progress, suffix, suffixColor }) => {
      setTimeout(() => {
        const line = document.createElement('div')
        if (suffix) {
          line.innerHTML = `<span>${text}</span><span style="color:${suffixColor};opacity:0.8">${suffix}</span>`
        } else {
          line.textContent = text
        }
        line.style.cssText = `${style};opacity:0;transition:opacity 0.3s ease;margin-bottom:2px`
        content.appendChild(line)
        if (progress > 0) progressBar.style.width = `${progress}%`
        requestAnimationFrame(() => setTimeout(() => { line.style.opacity = '1' }, 20))
      }, delay)
    })

    // append progress bar after title lines
    setTimeout(() => {
      content.appendChild(progressWrap)
    }, 650)

    // ---- ENTER BUTTON ----
    const enterBtn = document.createElement('button')
    enterBtn.textContent = '[ ENTER SIMULATION ]'
    enterBtn.style.cssText = `
      background: transparent;
      border: 1px solid rgba(255,160,94,0.4);
      color: rgba(255,211,166,0.8);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      letter-spacing: 0.32em;
      padding: 14px 40px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.25s ease;
      text-transform: uppercase;
      display: block;
      position: relative;
    `
    enterBtn.addEventListener('mouseenter', () => {
      enterBtn.style.background = 'rgba(122,47,20,0.3)'
      enterBtn.style.borderColor = 'rgba(255,160,94,0.9)'
      enterBtn.style.color = 'rgba(255,220,180,1)'
      enterBtn.style.boxShadow = '0 0 32px rgba(255,100,30,0.2), inset 0 0 20px rgba(255,100,30,0.05)'
      enterBtn.style.letterSpacing = '0.38em'
    })
    enterBtn.addEventListener('mouseleave', () => {
      enterBtn.style.background = 'transparent'
      enterBtn.style.borderColor = 'rgba(255,160,94,0.4)'
      enterBtn.style.color = 'rgba(255,211,166,0.8)'
      enterBtn.style.boxShadow = 'none'
      enterBtn.style.letterSpacing = '0.32em'
    })
    enterBtn.addEventListener('click', () => {
      animating = false
      overlay.style.transition = 'opacity 1.6s ease'
      overlay.style.opacity = '0'
      setTimeout(() => { overlay.remove(); resolve() }, 1600)
    })

    setTimeout(() => {
      content.appendChild(enterBtn)
      requestAnimationFrame(() => {
        setTimeout(() => {
          enterBtn.style.opacity = '1'
          let pulse = true
          const iv = setInterval(() => {
            if (!document.body.contains(enterBtn)) { clearInterval(iv); return }
            enterBtn.style.borderColor = pulse ? 'rgba(255,160,94,0.9)' : 'rgba(255,160,94,0.25)'
            pulse = !pulse
          }, 1000)
        }, 80)
      })
    }, 4000)

    // inject scan animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes scan {
        0% { top: -2px; opacity: 0; }
        5% { opacity: 1; }
        95% { opacity: 1; }
        100% { top: 100vh; opacity: 0; }
      }
    `
    document.head.appendChild(style)
  })
}