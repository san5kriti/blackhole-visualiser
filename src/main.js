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
import { createLoadingScreen } from './loading.js'

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
const fixedPixelRatio = Math.min(window.devicePixelRatio, 1.3)
renderer.setPixelRatio(fixedPixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

const canvas = renderer.domElement
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#000006'
app.appendChild(canvas)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.045
controls.enablePan = false
controls.autoRotate = true
controls.autoRotateSpeed = 0.13
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
  const starCount = 90000
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * size
    const y = Math.random() * size * 0.5
    const luminosity = Math.pow(Math.random(), 5.8)
    const radius = 0.08 + luminosity * 0.95
    const alpha = 0.18 + luminosity * 0.82
    const type = Math.random()
    const color = type < 0.18 ? [255, 210, 155] : type < 0.48 ? [168, 196, 255] : [255, 255, 255]
    ctx.beginPath()
    ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    if (luminosity > 0.86) {
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.25})`
      ctx.lineWidth = 0.45
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
    diskSpeed: { value: 1.35 },
    diskInner: { value: 0.37 },
    diskOuter: { value: 3.6 },
    diskTilt: { value: 0.16 },
    jetPower: { value: 0.55 },
    starWarp: { value: 1.45 },
    starMotion: { value: 1.35 },
    tracerIntensity: { value: 1.35 },
    exposure: { value: 1.18 },
    quality: { value: 1.0 }
  },
  vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
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
    uniform float starMotion;
    uniform float tracerIntensity;
    uniform float exposure;
    uniform float quality;

    #define PI 3.14159265359
    #define MAX_STEPS 140

    mat2 rot(float a) {
      float s = sin(a); float c = cos(a);
      return mat2(c, -s, s, c);
    }
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash12(i); float b = hash12(i + vec2(1,0));
      float c = hash12(i + vec2(0,1)); float d = hash12(i + vec2(1,1));
      return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.52;
      mat2 m = mat2(1.63, 1.18, -1.18, 1.63);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p + 7.17; a *= 0.5; }
      return v;
    }
    vec3 sampleStars(vec3 dir, float lensEnergy) {
      dir = normalize(dir);
      float u = 0.5 + atan(dir.z, dir.x) / (2.0 * PI);
      float v = 0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI;
      float drift = time * 0.0035 * starMotion;
      float shear = lensEnergy * starMotion;
      u += drift + sin(v * 18.0 + time * 0.18) * shear * 0.0025;
      v += cos(u * 13.0 - time * 0.12) * shear * 0.0012;
      vec3 stars = texture2D(starTexture, vec2(u, v)).rgb;
      vec3 starTrail = vec3(0.0);
      float smear = clamp(lensEnergy * (0.018 + starMotion * 0.018), 0.0, 0.055);
      starTrail += texture2D(starTexture, vec2(u + smear, v)).rgb;
      starTrail += texture2D(starTexture, vec2(u - smear, v)).rgb;
      starTrail += texture2D(starTexture, vec2(u + smear * 2.0, v)).rgb * 0.45;
      starTrail += texture2D(starTexture, vec2(u - smear * 2.0, v)).rgb * 0.45;
      starTrail += texture2D(starTexture, vec2(u + smear * 3.6, v + smear * 0.18)).rgb * 0.18;
      starTrail += texture2D(starTexture, vec2(u - smear * 3.6, v - smear * 0.18)).rgb * 0.18;
      float milky = pow(max(0.0, 1.0 - abs(dir.y + 0.08) * 4.0), 2.2);
      vec2 bandUv = vec2(u * 12.0 + time * 0.003, v * 8.0);
      float dust = fbm(bandUv) * fbm(bandUv * 2.1 + 19.0);
      vec3 band = mix(vec3(0.03, 0.045, 0.08), vec3(0.24, 0.17, 0.10), dust);
      float glint = pow(max(max(stars.r, stars.g), stars.b), 7.0) * lensEnergy;
      return stars * (0.9 + lensEnergy * 0.55) + starTrail * lensEnergy * (0.18 + starMotion * 0.24) + band * milky * 0.38 + vec3(0.9, 0.72, 0.48) * glint;
    }
    vec3 photonOrbitTracers(vec2 uv, float minR, float lensEnergy) {
      float fovScale = tan(radians(cameraFov) * 0.5);
      float cameraDistance = max(length(cameraPos), 0.25);
      float photonScreen = clamp((rs * 2.58 / cameraDistance) / (2.0 * fovScale), 0.045, 0.34);
      float radius = length(uv);
      float angle = atan(uv.y, uv.x);
      float nearPhoton = exp(-pow((minR - rs * 2.58) / max(rs * 0.9, 0.001), 2.0));
      vec3 glow = vec3(0.0);
      float ringCore = exp(-pow((radius - photonScreen) / max(photonScreen * 0.035, 0.002), 2.0));
      float ringOuter = exp(-pow((radius - photonScreen * 1.22) / max(photonScreen * 0.07, 0.003), 2.0));
      float dash = smoothstep(0.62, 1.0, fract(angle * 18.0 + radius * 33.0 - time * starMotion * 0.7));
      glow += vec3(1.8, 1.55, 1.18) * ringCore * (0.14 + lensEnergy * 0.18);
      glow += vec3(0.62, 0.78, 1.35) * ringOuter * dash * 0.13 * starMotion;
      for (int i = 0; i < 64; i++) {
        float fi = float(i);
        float seed = hash12(vec2(fi, fi * 2.17));
        float lane = mix(0.82, 1.42, hash12(vec2(fi * 3.1, 8.2)));
        float orbitRadius = photonScreen * lane;
        float speed = mix(0.24, 1.85, seed) * (hash12(vec2(fi, 5.0)) < 0.5 ? -1.0 : 1.0);
        float phase = fi * 2.399963 + time * speed * starMotion;
        float angularDistance = abs(atan(sin(angle - phase), cos(angle - phase)));
        float radialDistance = radius - orbitRadius;
        float point = exp(-(radialDistance * radialDistance) / max(0.000012, photonScreen * photonScreen * 0.0012));
        point *= exp(-(angularDistance * angularDistance) / mix(0.000035, 0.00045, seed));
        float tailPhase = angle - phase + speed * 0.045;
        float tailDistance = abs(atan(sin(tailPhase), cos(tailPhase)));
        float tail = exp(-(radialDistance * radialDistance) / max(0.000018, photonScreen * photonScreen * 0.0017));
        tail *= smoothstep(0.105, 0.0, tailDistance) * smoothstep(0.0, 0.028, tailDistance);
        vec3 starColor = mix(vec3(0.95, 0.86, 0.72), vec3(0.42, 0.85, 1.55), hash12(vec2(fi, 9.7)));
        starColor = mix(starColor, vec3(1.0, 0.34, 0.62), step(0.92, seed));
        glow += starColor * (point * 2.2 + tail * 0.42) * (0.35 + nearPhoton + lensEnergy * 0.25);
      }
      float falloff = smoothstep(0.46, 0.02, abs(radius - photonScreen));
      return glow * tracerIntensity * falloff;
    }
    vec4 diskSurfaceEmission(vec3 p, vec3 rd, float imageOrder) {
      p.yz = rot(diskTilt) * p.yz;
      float r = length(p.xz);
      if (r < diskInner || r > diskOuter) return vec4(0.0);
      float angle = atan(p.z, p.x);
      float invR = inversesqrt(max(r, 0.04));
      float orbital = diskSpeed * (0.58 + spin * 0.28) * invR;
      float flow = angle - time * orbital;
      float spiral = sin(flow * 7.0 + pow(r, 1.18) * 10.5 - time * 0.55);
      float turbulence = fbm(vec2(flow * 3.2 + spiral * 0.22, r * 5.2 - time * 0.08));
      turbulence += 0.42 * fbm(vec2(flow * 14.0 + 5.0, r * 18.0 + time * 0.08));
      turbulence = clamp(turbulence * 0.74, 0.0, 1.0);
      float normalizedRadius = (r - diskInner) / max(diskOuter - diskInner, 0.001);
      float heat = pow(1.0 - normalizedRadius, 2.15);
      vec3 whiteHot = vec3(4.0, 3.35, 2.15);
      vec3 amber = vec3(2.45, 0.84, 0.14);
      vec3 ember = vec3(0.55, 0.075, 0.016);
      vec3 color = mix(ember, amber, smoothstep(0.15, 0.95, heat));
      color = mix(color, whiteHot, smoothstep(0.62, 1.0, heat));
      vec3 tangent = normalize(vec3(-p.z, 0.0, p.x));
      float beta = clamp((0.34 + 0.22 * spin) * invR, 0.05, 0.62);
      float los = dot(normalize(-rd), tangent);
      float gamma = inversesqrt(max(1.0 - beta * beta, 0.08));
      float doppler = 1.0 / max(gamma * (1.0 - beta * los), 0.08);
      float gravitational = sqrt(max(1.0 - rs / max(r, rs + 0.001), 0.025));
      float spectralShift = doppler * gravitational;
      color *= pow(clamp(doppler, 0.2, 5.2), 3.0) * pow(gravitational, 1.65);
      color = mix(color * vec3(1.0, 0.6, 0.32), color * vec3(0.66, 0.92, 1.35), smoothstep(0.82, 1.55, spectralShift));
      float flare = pow(max(0.0, sin(flow * 11.0 + r * 4.0 - time * 2.1)), 9.0);
      float radialFeather = smoothstep(diskInner, diskInner + 0.18, r) * (1.0 - smoothstep(diskOuter * 0.78, diskOuter, r));
      float lane = smoothstep(0.16, 0.9, turbulence) * smoothstep(0.0, 0.8, 1.0 - normalizedRadius);
      float opacity = radialFeather * (0.18 + lane * 0.86 + flare * 0.5);
      opacity *= mix(1.0, 0.42, clamp(imageOrder, 0.0, 1.0));
      color *= 0.52 + turbulence * 1.7 + flare * 1.55;
      color *= 1.0 + 0.07 * sin(time * 1.4 + r * 7.0);
      color *= mix(1.0, 0.56, clamp(imageOrder, 0.0, 1.0));
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
      int diskImages = 0;
      bool absorbed = false;
      for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(ro);
        minR = min(minR, r);
        if (r < rs) { absorbed = true; break; }
        if (r > 115.0) break;
        float nearField = 1.0 - smoothstep(rs * 1.6, 8.0, r);
        float stepSize = mix(0.024, 0.16, smoothstep(rs * 1.4, 8.0, r));
        stepSize *= mix(0.75, 1.3, clamp(quality, 0.55, 1.35));
        vec3 previousRo = ro;
        vec3 rhat = ro / max(r, 0.0001);
        float gravity = (1.32 + spin * 0.32) * rs / max(r * r, 0.001);
        vec3 frameDrag = vec3(-rhat.z, 0.0, rhat.x) * spin * rs * 0.028 / max(r * r, 0.001);
        rd = normalize(rd - rhat * gravity * stepSize + frameDrag * stepSize);
        lensEnergy += nearField * stepSize * 0.15;
        vec3 nextRo = ro + rd * stepSize;
        vec3 previousDisk = previousRo;
        vec3 nextDisk = nextRo;
        previousDisk.yz = rot(diskTilt) * previousDisk.yz;
        nextDisk.yz = rot(diskTilt) * nextDisk.yz;
        if (previousDisk.y * nextDisk.y <= 0.0 && abs(previousDisk.y - nextDisk.y) > 0.00001) {
          float crossT = clamp(previousDisk.y / (previousDisk.y - nextDisk.y), 0.0, 1.0);
          vec3 diskHit = mix(previousRo, nextRo, crossT);
          vec4 disk = diskSurfaceEmission(diskHit, rd, float(diskImages));
          if (disk.a > 0.002) {
            float imageWeight = diskImages == 0 ? 0.92 : 0.46;
            float absorptionOrder = diskImages == 0 ? 0.0 : 1.0;
            accumulated += disk.rgb * disk.a * transmittance * imageWeight;
            transmittance *= max(0.0, 1.0 - disk.a * mix(0.16, 0.08, absorptionOrder));
            diskImages++;
          }
        }
        float diskRadius = length(previousDisk.xz);
        float corona = exp(-abs(previousDisk.y) * 18.0) * smoothstep(diskInner * 0.8, diskOuter, diskRadius) * (1.0 - smoothstep(diskOuter * 0.95, diskOuter * 1.7, diskRadius));
        accumulated += vec3(1.0, 0.42, 0.08) * corona * transmittance * stepSize * 0.08;
        vec3 jet = jetEmission(ro);
        accumulated += jet * transmittance * stepSize * 0.19;
        if (transmittance < 0.004) break;
        ro = nextRo;
      }
      vec3 background = absorbed ? vec3(0.0) : sampleStars(rd, clamp(lensEnergy * starWarp, 0.0, 1.8)) * transmittance;
      float photonRadius = rs * 2.58;
      float photon = exp(-pow((minR - photonRadius) / max(rs * 0.32, 0.001), 2.0));
      float innerHalo = exp(-pow((minR - rs * 1.18) / max(rs * 0.52, 0.001), 2.0));
      vec3 ringColor = vec3(2.25, 1.62, 0.86) * photon * (absorbed ? 0.35 : 1.0);
      ringColor += vec3(0.22, 0.42, 1.2) * innerHalo * jetPower * 0.22;
      float shadowEdge = absorbed ? 0.0 : smoothstep(rs * 0.92, rs * 2.45, minR);
      vec3 color = accumulated + background * shadowEdge + ringColor;
      color += photonOrbitTracers(uv, minR, lensEnergy);
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
renderer.compile(scene, camera)

const bloomEffect = new BloomEffect({ intensity: 1.35, luminanceThreshold: 0.055, luminanceSmoothing: 0.38, mipmapBlur: true, radius: 0.88 })
const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
const vignetteEffect = new VignetteEffect({ darkness: 0.52, offset: 0.18 })
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new EffectPass(camera, bloomEffect, toneMappingEffect, vignetteEffect))

const styleEl = document.createElement('style')
styleEl.textContent = `
  @keyframes flicker {
    0%, 89%, 91%, 93%, 100% { opacity: 1; }
    90% { opacity: 0.3; }
    92% { opacity: 0.7; }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(255,160,94,0.1); }
    50% { box-shadow: 0 0 22px rgba(255,160,94,0.3); }
  }
  .social-link {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,211,166,0.45);
    text-decoration: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9px;
    letter-spacing: 0.26em;
    transition: all 0.25s ease;
    pointer-events: all;
    padding: 4px 0;
    text-transform: uppercase;
  }
  .social-link::before {
    content: '';
    display: block;
    width: 16px;
    height: 1px;
    background: rgba(255,160,94,0.3);
    transition: all 0.25s ease;
    flex-shrink: 0;
  }
  .social-link:hover {
    color: rgba(255,220,180,0.95);
    letter-spacing: 0.34em;
  }
  .social-link:hover::before {
    width: 28px;
    background: rgba(255,160,94,0.9);
    box-shadow: 0 0 8px rgba(255,160,94,0.4);
  }
  .sci-btn {
    background: transparent;
    border: 1px solid rgba(255,160,94,0.25);
    color: rgba(255,211,166,0.6);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9px;
    letter-spacing: 0.28em;
    padding: 7px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    pointer-events: all;
    animation: pulseGlow 4s ease infinite;
  }
  .sci-btn:hover {
    background: rgba(122,47,20,0.25);
    border-color: rgba(255,160,94,0.8);
    color: rgba(255,220,180,0.95);
    box-shadow: 0 0 20px rgba(255,100,30,0.18);
  }
`
document.head.appendChild(styleEl)


const hud = document.createElement('div')
hud.style.cssText = `
  position: fixed;
  top: 28px;
  left: 28px;
  color: rgba(235, 237, 230, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.8;
  pointer-events: none;
  text-shadow: 0 0 14px rgba(255,255,255,0.1);
  letter-spacing: 0.16em;
  max-width: min(420px, calc(100vw - 56px));
  z-index: 10;
`
document.body.appendChild(hud)


const fpsDiv = document.createElement('div')
fpsDiv.style.cssText = `
  position: fixed;
  top: 54px;
  right: 18px;
  color: rgba(235, 237, 230, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  line-height: 1.65;
  pointer-events: none;
  letter-spacing: 0.14em;
  text-align: right;
  z-index: 10;
`
document.body.appendChild(fpsDiv)


const scienceBtn = document.createElement('button')
scienceBtn.className = 'sci-btn'
scienceBtn.textContent = '◈ SCIENTIFIC READOUT'
scienceBtn.style.cssText += `
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 101;
`
document.body.appendChild(scienceBtn)


let scienceOpen = false
const sciencePopup = document.createElement('div')
sciencePopup.style.cssText = `
  position: fixed;
  right: 18px;
  top: 50%;
  transform: translateY(-50%) translateX(16px);
  width: min(340px, calc(100vw - 36px));
  background: rgba(2,3,7,0.92);
  border: 1px solid rgba(255,160,94,0.18);
  box-shadow: 0 0 60px rgba(255,100,30,0.07), inset 0 0 30px rgba(0,0,0,0.5);
  backdrop-filter: blur(14px);
  padding: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  line-height: 1.8;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease, transform 0.4s ease;
  z-index: 100;
  letter-spacing: 0.1em;
  color: rgba(235,237,230,0.65);
`
document.body.appendChild(sciencePopup)

scienceBtn.addEventListener('click', () => {
  scienceOpen = !scienceOpen
  if (scienceOpen) {
    sciencePopup.style.opacity = '1'
    sciencePopup.style.transform = 'translateY(-50%) translateX(0)'
    sciencePopup.style.pointerEvents = 'all'
    scienceBtn.textContent = '✕ CLOSE READOUT'
    scienceBtn.style.borderColor = 'rgba(255,160,94,0.7)'
    scienceBtn.style.color = 'rgba(255,220,180,0.9)'
  } else {
    sciencePopup.style.opacity = '0'
    sciencePopup.style.transform = 'translateY(-50%) translateX(16px)'
    sciencePopup.style.pointerEvents = 'none'
    scienceBtn.textContent = '◈ SCIENTIFIC READOUT'
    scienceBtn.style.borderColor = 'rgba(255,160,94,0.25)'
    scienceBtn.style.color = 'rgba(255,211,166,0.6)'
  }
})


const bottomBar = document.createElement('div')
bottomBar.style.cssText = `
  position: fixed;
  left: 0; right: 0; bottom: 0;
  padding: 10px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, rgba(100,38,10,0.12) 0%, transparent 55%);
  border-top: 1px solid rgba(255,160,94,0.07);
  pointer-events: none;
  z-index: 10;
`

const warningText = document.createElement('div')
warningText.style.cssText = `
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
  color: rgba(255,140,60,0.45);
  animation: flicker 12s ease infinite;
  text-transform: uppercase;
`
warningText.innerHTML = `<span style="color:rgba(255,100,40,0.6);margin-right:10px">▲</span>CAUTION — PHOTON SPHERE r=1.5Rₛ &nbsp;·&nbsp; ISCO r=3Rₛ &nbsp;·&nbsp; NO RETURN BEYOND EVENT HORIZON`

const attributionText = document.createElement('div')
attributionText.style.cssText = `
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.2em;
  color: rgba(255,211,166,0.22);
  text-align: right;
  line-height: 1.7;
`
attributionText.innerHTML = `CREATED BY SANSKRITI SHELKE<br><span style="opacity:0.6">∿ null geodesics don't lie</span>`

bottomBar.appendChild(warningText)
bottomBar.appendChild(attributionText)
document.body.appendChild(bottomBar)


const socialsPanel = document.createElement('div')
socialsPanel.style.cssText = `
  position: fixed;
  right: 28px;
  bottom: 44px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 10;
`
const socialLinks = [
  { label: 'Portfolio', href: 'https://sanskritishelke.vercel.app' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/sanskritishelke' },
  { label: 'GitHub', href: 'https://github.com/san5kriti' },
  { label: 'Email', href: 'mailto:sanskritishelke.r@gmail.com' },
]
socialLinks.forEach(({ label, href }) => {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.textContent = label
  a.className = 'social-link'
  socialsPanel.appendChild(a)
})
document.body.appendChild(socialsPanel)


function getPhysics(rs) {
  const c = 299792458, G = 6.6743e-11, hbar = 1.054571817e-34
  const k = 1.380649e-23, solarMass = 1.98847e30
  const massKg = (rs / 0.32) * solarMass * 14
  const rsSI = (2 * G * massKg) / (c * c)
  const hawkingTemperature = (hbar * Math.pow(c, 3)) / (8 * Math.PI * G * massKg * k)
  const area = 4 * Math.PI * rsSI * rsSI
  const entropy = (area * Math.pow(c, 3)) / (4 * G * hbar)
  const evaporationYears = (5120 * Math.PI * G * G * Math.pow(massKg, 3)) / (hbar * Math.pow(c, 4)) / (365.25 * 24 * 3600)
  return { solarMasses: massKg / solarMass, rsSI, photonSphere: 1.5 * rsSI, hawkingTemperature, area, entropy, evaporationYears }
}

function updateSciencePopup(p) {
  sciencePopup.innerHTML = `
    <div style="font-size:9px;letter-spacing:0.3em;color:rgba(255,160,94,0.7);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(255,160,94,0.1)">BEKENSTEIN-HAWKING THERMODYNAMICS</div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:5px 20px;margin-bottom:16px">
      <div>HORIZON AREA</div><div style="color:rgba(255,200,130,0.85)">${p.area.toExponential(2)} m²</div>
      <div>ENTROPY S/k_B</div><div style="color:rgba(255,200,130,0.85)">${p.entropy.toExponential(2)}</div>
      <div>T_HAWKING</div><div style="color:rgba(255,200,130,0.85)">${p.hawkingTemperature.toExponential(2)} K</div>
      <div>T_EVAPORATION</div><div style="color:rgba(255,200,130,0.85)">${p.evaporationYears.toExponential(2)} yr</div>
      <div>MASS</div><div style="color:rgba(255,200,130,0.85)">${p.solarMasses.toExponential(2)} M☉</div>
      <div>SCHWARZSCHILD R</div><div style="color:rgba(255,200,130,0.85)">${p.rsSI.toExponential(2)} m</div>
      <div>PHOTON SPHERE</div><div style="color:rgba(255,200,130,0.85)">${p.photonSphere.toExponential(2)} m</div>
      <div>ISCO</div><div style="color:rgba(255,200,130,0.85)">${(p.rsSI * 3).toExponential(2)} m</div>
    </div>
    <div style="height:1px;background:rgba(255,160,94,0.08);margin-bottom:12px"></div>
    <div style="font-size:9px;letter-spacing:0.2em;color:rgba(255,160,94,0.5);margin-bottom:6px">TRANSFER MODEL</div>
    <div style="font-size:9px;color:rgba(235,237,230,0.28);line-height:1.7;margin-bottom:14px">
      Null-ray bending via Schwarzschild geodesics with Kerr frame-drag approximation.
      Thin disk crossings, relativistic doppler beaming, gravitational redshift,
      Blandford-Znajek jet emission, photon-sphere light paths.
    </div>
    <div style="height:1px;background:rgba(255,160,94,0.08);margin-bottom:12px"></div>
    <div style="font-size:9px;letter-spacing:0.2em;color:rgba(255,160,94,0.5);margin-bottom:8px">HAWKING SPECTRUM</div>
    <svg viewBox="0 0 300 60" width="100%" height="60" style="opacity:.75">
      <defs>
        <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(57,235,255,0)"/>
          <stop offset="55%" stop-color="rgba(57,235,255,0.85)"/>
          <stop offset="100%" stop-color="rgba(57,235,255,0.1)"/>
        </linearGradient>
      </defs>
      <polyline points="8,54 35,50 70,42 110,34 150,30 185,33 220,42 255,50 292,56"
        fill="none" stroke="url(#sg)" stroke-width="1.5"/>
      <circle cx="150" cy="30" r="2.5" fill="rgba(57,235,255,0.9)"/>
      <line x1="150" y1="8" x2="150" y2="54" stroke="rgba(255,160,94,0.18)" stroke-dasharray="2 3"/>
      <text x="155" y="16" fill="rgba(255,160,94,0.45)" font-size="7.5" font-family="monospace">peak</text>
      <text x="8" y="10" fill="rgba(235,237,230,0.25)" font-size="7.5" font-family="monospace">frequency →</text>
    </svg>
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
  starMotion: rayMarchMaterial.uniforms.starMotion.value,
  horizonTracers: rayMarchMaterial.uniforms.tracerIntensity.value,
  quality: 1.0,
  bloom: bloomEffect.intensity,
  exposure: rayMarchMaterial.uniforms.exposure.value,
  autoRotate: true
}

const gui = new GUI({ title: 'Black Hole Observatory' })
gui.domElement.style.cssText = `
  position: fixed;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --background-color: rgba(3,4,8,0.55);
  --text-color: rgba(255,211,166,0.85);
  --title-background-color: rgba(122,47,20,0.4);
  --title-text-color: rgba(255,220,180,0.95);
  --widget-color: rgba(40,20,8,0.8);
  --hover-color: rgba(80,35,10,0.8);
  --focus-color: rgba(255,120,50,0.4);
  --number-color: rgba(255,200,130,0.9);
  --string-color: rgba(255,180,100,0.9);
  border: 1px solid rgba(255,160,94,0.18);
  border-radius: 2px;
  box-shadow: 0 0 40px rgba(255,100,30,0.07), inset 0 0 20px rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
  min-width: 220px;
  z-index: 50;
`
gui.add(params, 'mass', 0.16, 0.72, 0.005).name('Mass').onChange(v => {
  rayMarchMaterial.uniforms.rs.value = v
  rayMarchMaterial.uniforms.diskInner.value = v * 1.16
  updateHUD()
})
gui.add(params, 'spin', 0, 1, 0.01).name('Spin').onChange(v => { rayMarchMaterial.uniforms.spin.value = v })
gui.add(params, 'diskSpeed', 0, 3, 0.05).name('Disk speed').onChange(v => { rayMarchMaterial.uniforms.diskSpeed.value = v })
gui.add(params, 'diskSize', 1.4, 6.5, 0.05).name('Disk radius').onChange(v => { rayMarchMaterial.uniforms.diskOuter.value = v })
gui.add(params, 'diskTilt', -0.65, 0.65, 0.01).name('Disk tilt').onChange(v => { rayMarchMaterial.uniforms.diskTilt.value = v })
gui.add(params, 'jetPower', 0, 1.8, 0.01).name('Jet power').onChange(v => { rayMarchMaterial.uniforms.jetPower.value = v })
gui.add(params, 'lensStars', 0, 2.5, 0.01).name('Star lensing').onChange(v => { rayMarchMaterial.uniforms.starWarp.value = v })
gui.add(params, 'starMotion', 0, 3.5, 0.01).name('Star motion').onChange(v => { rayMarchMaterial.uniforms.starMotion.value = v })
gui.add(params, 'horizonTracers', 0, 3.0, 0.01).name('Horizon riders').onChange(v => { rayMarchMaterial.uniforms.tracerIntensity.value = v })
gui.add(params, 'quality', 0.55, 1.35, 0.01).name('Ray quality').onChange(v => { rayMarchMaterial.uniforms.quality.value = v })
gui.add(params, 'bloom', 0, 4, 0.05).name('Bloom').onChange(v => { bloomEffect.intensity = v })
gui.add(params, 'exposure', 0.4, 2.4, 0.02).name('Exposure').onChange(v => { rayMarchMaterial.uniforms.exposure.value = v })
gui.add(params, 'autoRotate').name('Drift camera').onChange(v => { controls.autoRotate = v })


function updateHUD() {
  const p = getPhysics(rayMarchMaterial.uniforms.rs.value)
  hud.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
      <div style="width:38px;height:16px;border-top:2px solid rgba(235,237,230,.75);border-bottom:2px solid rgba(235,237,230,.35);border-radius:50%;transform:rotate(-10deg)"></div>
      <div style="font-size:18px;letter-spacing:.34em">GARGANTUA.exe</div>
    </div>
    <div style="font-size:10px;opacity:.55">// you are not supposed to be here</div>
    <div style="font-size:9px;opacity:.28;margin-bottom:10px">SYNC_LOCK 0x57 / THIN DISK TRANSFER</div>
    <div style="display:inline-block;border:1px solid rgba(104,238,255,.45);padding:2px 8px;color:rgba(210,248,255,.8);font-size:9px;letter-spacing:.14em;white-space:nowrap">[ KERR METRIC · a/M = ${rayMarchMaterial.uniforms.spin.value.toFixed(2)} · BOYER-LINDQUIST COORDS ]</div>
  `
  updateSciencePopup(p)
}

updateHUD()


function resize() {
  viewport.set(window.innerWidth, window.innerHeight)
  camera.aspect = viewport.x / viewport.y
  camera.updateProjectionMatrix()
  renderer.setSize(viewport.x, viewport.y, false)
  composer.setSize(viewport.x, viewport.y)
  renderer.getDrawingBufferSize(drawingSize)
  rayMarchMaterial.uniforms.resolution.value.copy(drawingSize)
}
window.addEventListener('resize', resize)
resize()

let frames = 0
let lastFps = performance.now()

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
    const distance = camera.position.length()
    const horizon = rayMarchMaterial.uniforms.rs.value
    const redshiftValue = 1 / Math.sqrt(Math.max(1 - horizon / Math.max(distance, horizon + 0.02), 0.01)) - 1
    const redshift = redshiftValue.toFixed(3)
    const dilation = (1 / (1 + redshiftValue)).toFixed(3)
    fpsDiv.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(5,auto);gap:18px;align-items:end">
        <div><div style="font-size:8px;opacity:.45">FPS</div><div>${fps} HZ</div></div>
        <div><div style="font-size:8px;opacity:.45">QUALITY</div><div>${params.quality.toFixed(2)}</div></div>
        <div><div style="font-size:8px;opacity:.45">HORIZON</div><div>${(horizon / 0.16).toFixed(2)} Rₛ</div></div>
        <div><div style="font-size:8px;opacity:.45">REDSHIFT</div><div>z=${redshift}</div></div>
        <div><div style="font-size:8px;opacity:.45">DILATION</div><div>${dilation}x</div></div>
      </div>
      <div style="opacity:.28;font-size:9px;margin-top:4px">CAMERA R=${distance.toFixed(2)} / DPR ${fixedPixelRatio.toFixed(2)}</div>
    `
    frames = 0
    lastFps = now
  }
}

createLoadingScreen().then(() => {
  camera.updateMatrixWorld(true)
  controls.update()
  rayMarchMaterial.uniforms.cameraPos.value.copy(camera.position)
  rayMarchMaterial.uniforms.cameraMatrix.value.copy(camera.matrixWorld)
  rayMarchMaterial.uniforms.cameraFov.value = camera.fov
  renderer.getDrawingBufferSize(drawingSize)
  rayMarchMaterial.uniforms.resolution.value.copy(drawingSize)
  for (let i = 0; i < 4; i++) {
    rayMarchMaterial.uniforms.time.value = i * 0.025
    composer.render()
  }
  animate()
})
