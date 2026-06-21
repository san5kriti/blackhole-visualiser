import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect
} from 'postprocessing'
import GUI from 'lil-gui'

const app = document.getElementById('app')
const viewport = new THREE.Vector2()
const drawingSize = new THREE.Vector2()
const clock = new THREE.Clock()

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 800)
camera.position.set(0, 1.15, 5.2)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: false
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.setClearColor(0x000006, 1)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
renderer.setSize(window.innerWidth, window.innerHeight)

const canvas = renderer.domElement
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#000006'
app.appendChild(canvas)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.045
controls.enablePan = false
controls.autoRotate = true
controls.autoRotateSpeed = 0.08
controls.minDistance = 1.65
controls.maxDistance = 18
controls.target.set(0, 0, 0)
controls.update()

function makeStarTexture() {
  const size = 2048
  const starCanvas = document.createElement('canvas')
  starCanvas.width = size
  starCanvas.height = size / 2

  const ctx = starCanvas.getContext('2d', { alpha: false })
  const sky = ctx.createLinearGradient(0, 0, size, size / 2)
  sky.addColorStop(0, '#01020a')
  sky.addColorStop(0.45, '#03030d')
  sky.addColorStop(1, '#000006')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, size, size / 2)

  const nebulaCount = 900
  for (let i = 0; i < nebulaCount; i++) {
    const x = Math.random() * size
    const y = Math.random() * size * 0.5
    const radius = 16 + Math.random() * 90
    const hue = Math.random() < 0.55 ? [82, 123, 180] : [180, 92, 42]
    const alpha = 0.012 + Math.random() * 0.028
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${alpha})`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }

  const starCount = 30000
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * size
    const y = Math.random() * size * 0.5
    const luminosity = Math.pow(Math.random(), 4.5)
    const radius = 0.25 + luminosity * 1.8
    const alpha = 0.25 + luminosity * 0.75
    const type = Math.random()
    const color = type < 0.18 ? [255, 210, 155] : type < 0.48 ? [168, 196, 255] : [255, 255, 255]

    ctx.beginPath()
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    if (luminosity > 0.78) {
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.25})`
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(x - radius * 5, y)
      ctx.lineTo(x + radius * 5, y)
      ctx.moveTo(x, y - radius * 5)
      ctx.lineTo(x, y + radius * 5)
      ctx.stroke()
    }
  }

  const texture = new THREE.CanvasTexture(starCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

const starTexture = makeStarTexture()
renderer.getDrawingBufferSize(drawingSize)

const rayMarchMaterial = new THREE.ShaderMaterial({
  depthTest: false,
  depthWrite: false,
  uniforms: {
    time: { value: 0 },
    resolution: { value: drawingSize.clone() },
    cameraPos: { value: camera.position.clone() },
    cameraMatrix: { value: camera.matrixWorld.clone() },
    cameraFov: { value: camera.fov },
    starTexture: { value: starTexture },
    rs: { value: 0.32 },
    spin: { value: 0.62 },
    diskSpeed: { value: 1.0 },
    diskInner: { value: 0.37 },
    diskOuter: { value: 3.6 },
    diskTilt: { value: 0.16 },
    jetPower: { value: 0.55 },
    starWarp: { value: 1.0 },
    exposure: { value: 1.18 },
    quality: { value: 1.0 }
  },
  vertexShader: /* glsl */`
    void main() {
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;

    uniform float time;
    uniform vec2 resolution;
    uniform vec3 cameraPos;
    uniform mat4 cameraMatrix;
    uniform float cameraFov;
    uniform sampler2D starTexture;
    uniform float rs;
    uniform float spin;
    uniform float diskSpeed;
    uniform float diskInner;
    uniform float diskOuter;
    uniform float diskTilt;
    uniform float jetPower;
    uniform float starWarp;
    uniform float exposure;
    uniform float quality;

    #define PI 3.14159265359
    #define MAX_STEPS 140

    mat2 rot(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.52;
      mat2 m = mat2(1.63, 1.18, -1.18, 1.63);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p + 7.17;
        a *= 0.5;
      }
      return v;
    }

    vec3 sampleStars(vec3 dir, float lensEnergy) {
      dir = normalize(dir);
      float u = 0.5 + atan(dir.z, dir.x) / (2.0 * PI);
      float v = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI;
      vec3 stars = texture2D(starTexture, vec2(u, v)).rgb;

      float milky = pow(max(0.0, 1.0 - abs(dir.y + 0.08) * 4.0), 2.2);
      vec2 bandUv = vec2(u * 12.0 + time * 0.003, v * 8.0);
      float dust = fbm(bandUv) * fbm(bandUv * 2.1 + 19.0);
      vec3 band = mix(vec3(0.03, 0.045, 0.08), vec3(0.24, 0.17, 0.10), dust);

      float glint = pow(max(max(stars.r, stars.g), stars.b), 7.0) * lensEnergy;
      return stars * (0.9 + lensEnergy * 0.8) + band * milky * 0.38 + vec3(0.9, 0.72, 0.48) * glint;
    }

    vec4 diskEmission(vec3 p, vec3 rd) {
      p.yz = rot(diskTilt) * p.yz;

      float r = length(p.xz);
      if (r < diskInner || r > diskOuter) return vec4(0.0);

      float angle = atan(p.z, p.x);
      float invR = inversesqrt(max(r, 0.04));
      float orbital = diskSpeed * (0.42 + spin * 0.34) * invR;
      float flow = angle - time * orbital;

      float spiral = sin(flow * 5.0 + pow(r, 1.35) * 5.8 - time * 0.55);
      float turbulence = fbm(vec2(flow * 2.4 + spiral * 0.18, r * 3.8 - time * 0.06));
      turbulence += 0.55 * fbm(vec2(flow * 7.6 + 5.0, r * 10.0 + time * 0.08));
      turbulence = clamp(turbulence * 0.68, 0.0, 1.0);

      float normalizedRadius = (r - diskInner) / max(diskOuter - diskInner, 0.001);
      float heat = pow(1.0 - normalizedRadius, 1.8);
      vec3 whiteHot = vec3(3.2, 2.55, 1.68);
      vec3 amber = vec3(1.8, 0.62, 0.11);
      vec3 ember = vec3(0.52, 0.075, 0.018);
      vec3 color = mix(ember, amber, smoothstep(0.15, 0.95, heat));
      color = mix(color, whiteHot, smoothstep(0.62, 1.0, heat));

      float azimuth = p.x / max(r, 0.001);
      float doppler = exp(azimuth * (1.15 + spin * 1.25));
      color *= clamp(doppler, 0.26, 4.1);
      color.b += max(azimuth, 0.0) * 0.36;

      float flare = pow(max(0.0, sin(flow * 11.0 + r * 4.0 - time * 2.1)), 9.0);
      float verticalSigma = 0.0028 + r * 0.0025;
      float thickness = exp(-(p.y * p.y) / verticalSigma);
      float radialFeather = smoothstep(diskInner, diskInner + 0.12, r) * (1.0 - smoothstep(diskOuter * 0.82, diskOuter, r));
      float opacity = thickness * radialFeather * (0.24 + turbulence * 0.95 + flare * 0.65);

      float extinction = smoothstep(0.0, 0.04, abs(p.y)) * 0.2;
      color *= 0.62 + turbulence * 1.45 + flare * 1.8 - extinction;
      color *= 1.0 + 0.08 * sin(time * 1.4 + r * 7.0);

      return vec4(max(color, vec3(0.0)), clamp(opacity, 0.0, 1.0));
    }

    vec3 jetEmission(vec3 p) {
      float r = length(p);
      float axial = abs(p.y) / max(r, 0.001);
      float core = exp(-length(p.xz) * length(p.xz) * 13.0 / max(abs(p.y), 0.25));
      float fade = smoothstep(rs * 1.3, rs * 4.0, abs(p.y)) * (1.0 - smoothstep(4.0, 12.0, r));
      float filaments = fbm(vec2(atan(p.z, p.x) * 3.0 + time * 0.24, p.y * 1.2 - time * 0.35));
      vec3 blue = vec3(0.18, 0.48, 1.45);
      vec3 violet = vec3(0.68, 0.36, 1.25);
      return mix(blue, violet, filaments) * core * fade * pow(axial, 8.0) * jetPower;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
      float vignette = smoothstep(1.18, 0.22, length(uv));

      float fovScale = tan(radians(cameraFov) * 0.5);
      vec3 viewRay = normalize(vec3(uv * fovScale * 2.0, -1.0));
      vec3 rd = normalize((cameraMatrix * vec4(viewRay, 0.0)).xyz);
      vec3 ro = cameraPos;

      vec3 accumulated = vec3(0.0);
      float transmittance = 1.0;
      float minR = 1e6;
      float lensEnergy = 0.0;
      bool absorbed = false;

      for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(ro);
        minR = min(minR, r);

        if (r < rs) {
          absorbed = true;
          break;
        }
        if (r > 115.0) break;

        float nearField = 1.0 - smoothstep(rs * 1.6, 8.0, r);
        float stepSize = mix(0.024, 0.16, smoothstep(rs * 1.4, 8.0, r));
        stepSize *= mix(0.75, 1.3, clamp(quality, 0.55, 1.35));

        vec3 rhat = ro / max(r, 0.0001);
        float gravity = (1.32 + spin * 0.32) * rs / max(r * r, 0.001);
        vec3 frameDrag = vec3(-rhat.z, 0.0, rhat.x) * spin * rs * 0.028 / max(r * r, 0.001);
        rd = normalize(rd - rhat * gravity * stepSize + frameDrag * stepSize);
        lensEnergy += nearField * stepSize * 0.15;

        vec4 disk = diskEmission(ro, rd);
        if (disk.a > 0.002) {
          accumulated += disk.rgb * disk.a * transmittance * 0.72;
          transmittance *= max(0.0, 1.0 - disk.a * 0.19);
        }

        vec3 jet = jetEmission(ro);
        accumulated += jet * transmittance * stepSize * 0.19;

        if (transmittance < 0.004) break;
        ro += rd * stepSize;
      }

      vec3 background = absorbed ? vec3(0.0) : sampleStars(rd, clamp(lensEnergy * starWarp, 0.0, 1.8)) * transmittance;

      float photonRadius = rs * 2.58;
      float photon = exp(-pow((minR - photonRadius) / max(rs * 0.32, 0.001), 2.0));
      float innerHalo = exp(-pow((minR - rs * 1.18) / max(rs * 0.52, 0.001), 2.0));
      vec3 ringColor = vec3(2.25, 1.62, 0.86) * photon * (absorbed ? 0.35 : 1.0);
      ringColor += vec3(0.22, 0.42, 1.2) * innerHalo * jetPower * 0.22;

      float shadowEdge = absorbed ? 0.0 : smoothstep(rs * 0.92, rs * 2.45, minR);
      vec3 color = accumulated + background * shadowEdge + ringColor;

      float chroma = length(uv) * (0.018 + lensEnergy * 0.008);
      color.r *= 1.0 + chroma;
      color.g *= 1.0 + chroma * 0.15;
      color.b *= 1.0 - chroma * 0.42;

      float filmGrain = hash12(gl_FragCoord.xy + time * 60.0) - 0.5;
      color += filmGrain * 0.012;
      color *= 0.88 + vignette * 0.18;
      color *= exposure;

      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `
})

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rayMarchMaterial)
quad.frustumCulled = false
scene.add(quad)

const bloomEffect = new BloomEffect({
  intensity: 1.35,
  luminanceThreshold: 0.055,
  luminanceSmoothing: 0.38,
  mipmapBlur: true,
  radius: 0.88
})

const toneMappingEffect = new ToneMappingEffect({
  mode: ToneMappingMode.ACES_FILMIC
})

const vignetteEffect = new VignetteEffect({
  darkness: 0.52,
  offset: 0.18
})

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new EffectPass(camera, bloomEffect, toneMappingEffect, vignetteEffect))

const hud = document.createElement('div')
hud.style.cssText = `
  position: fixed;
  top: 18px;
  left: 18px;
  color: rgba(255, 205, 132, 0.86);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 1.85;
  pointer-events: none;
  text-shadow: 0 0 14px rgba(255, 129, 36, 0.55);
  letter-spacing: 0.08em;
  max-width: min(360px, calc(100vw - 36px));
`
document.body.appendChild(hud)

const fpsDiv = document.createElement('div')
fpsDiv.style.cssText = `
  position: fixed;
  top: 18px;
  right: 18px;
  color: rgba(255, 205, 132, 0.64);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 1.65;
  pointer-events: none;
  text-shadow: 0 0 14px rgba(255, 129, 36, 0.45);
  letter-spacing: 0.16em;
  text-align: right;
`
document.body.appendChild(fpsDiv)

function getPhysics(rs) {
  const c = 299792458
  const G = 6.6743e-11
  const hbar = 1.054571817e-34
  const k = 1.380649e-23
  const solarMass = 1.98847e30
  const massKg = (rs / 0.32) * solarMass * 14
  const rsSI = (2 * G * massKg) / (c * c)
  const hawkingTemperature = (hbar * Math.pow(c, 3)) / (8 * Math.PI * G * massKg * k)
  const area = 4 * Math.PI * rsSI * rsSI
  const entropy = (area * Math.pow(c, 3)) / (4 * G * hbar)
  const evaporationYears = (5120 * Math.PI * G * G * Math.pow(massKg, 3)) / (hbar * Math.pow(c, 4)) / (365.25 * 24 * 3600)
  return {
    solarMasses: massKg / solarMass,
    rsSI,
    photonSphere: 1.5 * rsSI,
    hawkingTemperature,
    area,
    entropy,
    evaporationYears
  }
}

function updateHUD() {
  const p = getPhysics(rayMarchMaterial.uniforms.rs.value)
  hud.innerHTML = `
    <div style="font-size:10px;letter-spacing:0.28em;opacity:0.7;margin-bottom:2px">SCHWARZSCHILD-KERR LENS</div>
    <div style="font-size:10px;opacity:0.44;margin-bottom:7px">RELATIVISTIC RAYMARCH KERNEL</div>
    <div>MASS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${p.solarMasses.toExponential(2)} M&#9737;</div>
    <div>EVENT R&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${p.rsSI.toExponential(2)} m</div>
    <div>PHOTON R&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${p.photonSphere.toExponential(2)} m</div>
    <div>AREA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${p.area.toExponential(2)} m&sup2;</div>
    <div>ENTROPY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${p.entropy.toExponential(2)}</div>
    <div>HAWKING T&nbsp;&nbsp;&nbsp;${p.hawkingTemperature.toExponential(2)} K</div>
    <div>LIFETIME&nbsp;&nbsp;&nbsp;&nbsp;${p.evaporationYears.toExponential(2)} yr</div>
  `
}

const params = {
  mass: rayMarchMaterial.uniforms.rs.value,
  spin: rayMarchMaterial.uniforms.spin.value,
  diskSpeed: rayMarchMaterial.uniforms.diskSpeed.value,
  diskSize: rayMarchMaterial.uniforms.diskOuter.value,
  diskTilt: rayMarchMaterial.uniforms.diskTilt.value,
  jetPower: rayMarchMaterial.uniforms.jetPower.value,
  lensStars: rayMarchMaterial.uniforms.starWarp.value,
  quality: 1.0,
  bloom: bloomEffect.intensity,
  exposure: rayMarchMaterial.uniforms.exposure.value,
  autoRotate: true
}

const gui = new GUI({ title: 'Black Hole Observatory' })
gui.add(params, 'mass', 0.16, 0.72, 0.005).name('Mass').onChange((v) => {
  rayMarchMaterial.uniforms.rs.value = v
  rayMarchMaterial.uniforms.diskInner.value = v * 1.16
  updateHUD()
})
gui.add(params, 'spin', 0, 1, 0.01).name('Spin').onChange((v) => {
  rayMarchMaterial.uniforms.spin.value = v
})
gui.add(params, 'diskSpeed', 0, 3, 0.05).name('Disk speed').onChange((v) => {
  rayMarchMaterial.uniforms.diskSpeed.value = v
})
gui.add(params, 'diskSize', 1.4, 6.5, 0.05).name('Disk radius').onChange((v) => {
  rayMarchMaterial.uniforms.diskOuter.value = v
})
gui.add(params, 'diskTilt', -0.65, 0.65, 0.01).name('Disk tilt').onChange((v) => {
  rayMarchMaterial.uniforms.diskTilt.value = v
})
gui.add(params, 'jetPower', 0, 1.8, 0.01).name('Jet power').onChange((v) => {
  rayMarchMaterial.uniforms.jetPower.value = v
})
gui.add(params, 'lensStars', 0, 2.5, 0.01).name('Star lensing').onChange((v) => {
  rayMarchMaterial.uniforms.starWarp.value = v
})
gui.add(params, 'quality', 0.55, 1.35, 0.01).name('Ray quality').onChange((v) => {
  rayMarchMaterial.uniforms.quality.value = v
})
gui.add(params, 'bloom', 0, 4, 0.05).name('Bloom').onChange((v) => {
  bloomEffect.intensity = v
})
gui.add(params, 'exposure', 0.4, 2.4, 0.02).name('Exposure').onChange((v) => {
  rayMarchMaterial.uniforms.exposure.value = v
})
gui.add(params, 'autoRotate').name('Drift camera').onChange((v) => {
  controls.autoRotate = v
})

updateHUD()

let frames = 0
let lastFps = performance.now()
let currentPixelRatio = renderer.getPixelRatio()

function resize() {
  viewport.set(window.innerWidth, window.innerHeight)
  camera.aspect = viewport.x / viewport.y
  camera.updateProjectionMatrix()
  renderer.setSize(viewport.x, viewport.y, false)
  composer.setSize(viewport.x, viewport.y)
  renderer.getDrawingBufferSize(drawingSize)
  rayMarchMaterial.uniforms.resolution.value.copy(drawingSize)
}

function tunePixelRatio(fps) {
  const dpr = Math.min(window.devicePixelRatio, 1.8)
  let target = currentPixelRatio
  if (fps < 42) target = Math.max(0.82, currentPixelRatio - 0.08)
  if (fps > 58) target = Math.min(dpr, currentPixelRatio + 0.04)
  if (Math.abs(target - currentPixelRatio) > 0.025) {
    currentPixelRatio = target
    renderer.setPixelRatio(currentPixelRatio)
    resize()
  }
}

window.addEventListener('resize', resize)
resize()

function animate() {
  requestAnimationFrame(animate)

  const t = clock.getElapsedTime()
  controls.update()

  rayMarchMaterial.uniforms.time.value = t
  rayMarchMaterial.uniforms.cameraPos.value.copy(camera.position)
  rayMarchMaterial.uniforms.cameraMatrix.value.copy(camera.matrixWorld)
  rayMarchMaterial.uniforms.cameraFov.value = camera.fov

  composer.render()

  frames++
  const now = performance.now()
  if (now - lastFps > 650) {
    const fps = Math.round((frames * 1000) / (now - lastFps))
    tunePixelRatio(fps)
    const distance = camera.position.length()
    const horizon = rayMarchMaterial.uniforms.rs.value
    const redshift = (1 / Math.sqrt(Math.max(1 - horizon / Math.max(distance, horizon + 0.02), 0.01)) - 1).toFixed(3)
    fpsDiv.innerHTML = `
      <div>${fps} FPS</div>
      <div style="opacity:0.54;font-size:10px">DPR ${currentPixelRatio.toFixed(2)}</div>
      <div style="opacity:0.54;font-size:10px">DIST ${distance.toFixed(2)}</div>
      <div style="opacity:0.54;font-size:10px">REDSHIFT z=${redshift}</div>
    `
    frames = 0
    lastFps = now
  }
}

animate()
