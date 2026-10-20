import React, { useEffect, useRef, useState, Component } from 'react';
import * as THREE from 'three';
import { useThemeStore } from '../../store/useThemeStore';
import { ShieldCheck, Lock, Activity } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Error Boundary for WebGL 3D Scene
// ─────────────────────────────────────────────────────────────
export class ThreeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[3D Gateway] WebGL Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Lightweight 2D/CSS Graphic for Mobile, Low-Power, or Reduced Motion
// ─────────────────────────────────────────────────────────────
export function PrivacyGatewayFallback({ themeColors }) {
  return (
    <div className="relative w-full h-full min-h-[220px] sm:min-h-[240px] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-theme-border/60 p-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_70%)]" />
      <div className="relative z-10 flex items-center justify-between w-full max-w-md">
        <div className="flex flex-col items-center gap-1.5 text-rose-400">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shadow-md shadow-rose-500/10">
            <Lock className="w-5 h-5 text-rose-400" />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-wider">RAW POINTS</span>
          <span className="text-[9px] text-slate-400 font-mono">Direct Identifiers</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-3">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-cyan-500/15 border border-cyan-400/60 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.4)]">
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-300" />
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping opacity-75" />
          </div>
          <span className="text-[10px] font-extrabold tracking-widest text-cyan-300 uppercase font-mono mt-1">
            Privacy Pipeline
          </span>
          <span className="text-[9px] font-mono text-cyan-400/90 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
            HMAC-SHA256 • AUDITED
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-emerald-400">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-500/10">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[11px] font-mono font-bold tracking-wider">CLEAN POINTS</span>
          <span className="text-[9px] text-slate-400 font-mono">Protected Microdata</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GPU particle shaders
// Raw points (chaotic, rose) → squeezed through the gate (white-hot)
// → re-emerge as an ordered crystalline lattice (emerald).
// All motion is computed on the GPU, so thousands of points stay cheap.
// ─────────────────────────────────────────────────────────────
const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uBurst;
  uniform vec3 uRaw;
  uniform vec3 uMid;
  uniform vec3 uClean;

  attribute vec4 aSeed;   // angle, radius, speed, phase
  attribute float aRand;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    const float L = 16.0;
    float x = mod(aSeed.w * L + uTime * aSeed.z, L) - L * 0.5;
    float ax = abs(x);

    float gate = 1.0 - smoothstep(0.0, 2.6, ax);      // 1 at the shield
    float k = smoothstep(0.2, 3.8, x);                // 0..1 order amount (clean side)
    float isClean = step(0.0, x);

    // Funnel toward the gate
    float pinch = aSeed.y * mix(1.0, 0.2, gate);

    // RAW side: chaotic spin + turbulence
    float rawAng = aSeed.x + uTime * (0.4 + aRand * 0.8) + ax * 0.35;
    float rawR = pinch + sin(uTime * 2.2 + aSeed.x * 5.0 + x * 1.3) * 0.28 * (1.0 - gate) * (0.4 + aRand);

    // CLEAN side: snap to a rotating lattice (12 spokes x concentric rings)
    float qa = 6.2831853 / 12.0;
    float latAng = floor(aSeed.x / qa + 0.5) * qa;
    float latR = max(floor(aSeed.y * 2.5 + 0.5) / 2.5, 0.4);
    latR *= 1.0 + 0.08 * sin(uTime * 1.5 + latAng * 3.0 + x * 0.8);
    float cleanAng = mix(aSeed.x, latAng, k) + uTime * 0.18;
    float cleanR = mix(pinch, latR, k);

    float ang = mix(rawAng, cleanAng, isClean);
    float rad = mix(rawR, cleanR, isClean);
    rad *= 1.0 + uBurst * 0.45 * gate;

    vec3 pos = vec3(x, sin(ang) * rad, cos(ang) * rad);

    // Color ramp
    vec3 col = mix(uRaw, uMid, smoothstep(0.0, 1.0, gate));
    vec3 cc = mix(uMid, uClean, smoothstep(0.0, 2.2, x));
    col = mix(col, cc, isClean);
    col += vec3(1.0) * pow(gate, 4.0) * (0.45 + uBurst * 0.5);
    vColor = col;

    vAlpha = smoothstep(-8.0, -6.0, x) * (1.0 - smoothstep(6.0, 8.0, x)) * (0.5 + 0.5 * gate);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize * (0.55 + aRand * 0.95) * (1.0 + gate * 0.9 + uBurst * gate);
    gl_PointSize = size * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

// ─────────────────────────────────────────────────────────────
// 3D Scene
// ─────────────────────────────────────────────────────────────
function ThreeScene() {
  const containerRef = useRef(null);
  const theme = useThemeStore((s) => s.theme);
  const colors = useThemeStore((s) => s.getThemeColors)();
  const primaryHex = colors.primary;
  const secondaryHex = colors.secondary || '#3b82f6';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 480;
    let height = container.clientHeight || 240;
    const isSmall = width < 560;

    // ── Scene / camera / renderer ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.045);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSmall,
      powerPreference: 'high-performance'
    });
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);

    // ── Palette ──
    const primary = new THREE.Color(primaryHex);
    const secondary = new THREE.Color(secondaryHex);
    const rawColor = new THREE.Color(0xf43f5e);
    const cleanColor = new THREE.Color(0x10b981);
    const white = new THREE.Color(0xffffff);

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const coreLight = new THREE.PointLight(primary, 3, 12);
    scene.add(coreLight);
    const ingressLight = new THREE.PointLight(rawColor, 1.6, 7);
    ingressLight.position.set(-4, 1, 1);
    scene.add(ingressLight);
    const egressLight = new THREE.PointLight(cleanColor, 2, 7);
    egressLight.position.set(4, 1, 1);
    scene.add(egressLight);

    // ── Starfield (deep parallax backdrop) ──
    const starCount = isSmall ? 150 : 380;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 50;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      starPos[i * 3 + 2] = -6 - Math.random() * 22;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Perspective floor grid (scrolls along the flow direction) ──
    const CELL = 0.5;
    const grid = new THREE.GridHelper(36, 72, primary, primary);
    grid.position.y = -2.1;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.material.depthWrite = false;
    scene.add(grid);

    // ── Gateway portal ──
    const portal = new THREE.Group();
    scene.add(portal);

    const rings = [];
    const addRing = (radius, tube, color, opacity, tiltX, tiltY, speed) => {
      const geo = new THREE.TorusGeometry(radius, tube, 12, 72);
      const mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(tiltX, tiltY, 0);
      portal.add(mesh);
      rings.push({ mesh, speed });
    };
    // Gyroscope: three rings on different axes
    addRing(1.75, 0.035, primary, 0.75, 0, 0, new THREE.Vector3(0.1, 0.25, 0.35));
    addRing(1.4, 0.028, secondary, 0.65, Math.PI / 2, 0.4, new THREE.Vector3(-0.35, 0.15, -0.25));
    addRing(1.05, 0.02, white, 0.35, 0.8, Math.PI / 3, new THREE.Vector3(0.3, -0.4, 0.2));

    // Faceted energy shell
    const shellGeo = new THREE.IcosahedronGeometry(0.95, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: primary,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    portal.add(shell);

    // Hex-web membrane + translucent disc (the "shield")
    const hexGeo = new THREE.RingGeometry(0.15, 1.5, 6, 4);
    const hexMat = new THREE.MeshBasicMaterial({
      color: primary,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const hexWeb = new THREE.Mesh(hexGeo, hexMat);
    hexWeb.rotation.y = Math.PI / 2;
    portal.add(hexWeb);

    const discGeo = new THREE.CircleGeometry(1.5, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: primary,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.y = Math.PI / 2;
    portal.add(disc);

    // Scan line sweeping the membrane
    const scanGeo = new THREE.PlaneGeometry(3.1, 0.035);
    const scanMat = new THREE.MeshBasicMaterial({
      color: white,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const scan = new THREE.Mesh(scanGeo, scanMat);
    scan.rotation.y = Math.PI / 2;
    portal.add(scan);

    // Cryptographic core
    const coreGeo = new THREE.OctahedronGeometry(0.32, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: 0.9,
      wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    portal.add(coreMesh);

    const heartGeo = new THREE.IcosahedronGeometry(0.14, 1);
    const heartMat = new THREE.MeshBasicMaterial({
      color: white,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    portal.add(heart);

    // Shockwave pool (expanding rings, periodic + on click)
    const SHOCKS = 4;
    const shockGeo = new THREE.RingGeometry(0.96, 1, 72);
    const shocks = [];
    for (let i = 0; i < SHOCKS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: primary,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(shockGeo, mat);
      mesh.rotation.y = Math.PI / 2;
      mesh.visible = false;
      scene.add(mesh);
      shocks.push({ mesh, mat, t0: -999 });
    }
    let shockIndex = 0;
    let nextAutoShock = 1.2;
    let burst = 0;
    const spawnShock = (t) => {
      const s = shocks[shockIndex % SHOCKS];
      shockIndex++;
      s.t0 = t;
    };

    // ── GPU particle stream ──
    const particleCount = isSmall ? 2200 : 5200;
    const seed = new Float32Array(particleCount * 4);
    const rnd = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      seed[i * 4] = Math.random() * Math.PI * 2;        // angle
      seed[i * 4 + 1] = 0.2 + Math.random() * 1.8;      // radius
      seed[i * 4 + 2] = 0.55 + Math.random() * 0.55;    // speed
      seed[i * 4 + 3] = Math.random();                  // phase
      rnd[i] = Math.random();
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
    particleGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    particleGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.12 },
        uScale: { value: (height * dpr) / 2 },
        uBurst: { value: 0 },
        uRaw: { value: new THREE.Vector3(rawColor.r, rawColor.g, rawColor.b) },
        uMid: { value: new THREE.Vector3(primary.r, primary.g, primary.b) },
        uClean: { value: new THREE.Vector3(cleanColor.r, cleanColor.g, cleanColor.b) }
      }
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystem.frustumCulled = false;
    scene.add(particleSystem);

    // ── Data packets: tumbling raw cubes → settle into clean gems ──
    const PACKETS = isSmall ? 16 : 36;
    const packetGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const packetMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.95
    });
    const packets = new THREE.InstancedMesh(packetGeo, packetMat, PACKETS);
    packets.frustumCulled = false;
    const packetData = [];
    for (let i = 0; i < PACKETS; i++) {
      packetData.push({
        phase: i / PACKETS + Math.random() * 0.02,
        angle: Math.random() * Math.PI * 2,
        radius: 0.9 + Math.random() * 1.7,
        spin: new THREE.Vector3(Math.random() + 0.4, Math.random() + 0.4, Math.random() + 0.4),
        size: 0.1 + Math.random() * 0.1
      });
      packets.setColorAt(i, rawColor);
    }
    scene.add(packets);

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    // ── Interaction: hover parallax + drag-to-orbit (springs back) ──
    const timer = new THREE.Timer();
    timer.connect(document);
    let mouseX = 0;
    let mouseY = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragYaw = 0;
    let dragPitch = 0;

    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (dragging) {
        dragYaw += (e.clientX - lastX) * 0.008;
        dragPitch += (e.clientY - lastY) * 0.006;
        dragYaw = THREE.MathUtils.clamp(dragYaw, -1.3, 1.3);
        dragPitch = THREE.MathUtils.clamp(dragPitch, -0.45, 0.6);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onPointerDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      burst = 1;
      spawnShock(timer.getElapsed());
      container.setPointerCapture?.(e.pointerId);
    };
    const onPointerUp = (e) => {
      dragging = false;
      container.releasePointerCapture?.(e.pointerId);
    };
    const onPointerLeave = () => {
      mouseX = 0;
      mouseY = 0;
    };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);

    // ── Resize (ResizeObserver, no stale sizes) ──
    const resize = () => {
      width = container.clientWidth || width;
      height = container.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      particleMat.uniforms.uScale.value = (height * renderer.getPixelRatio()) / 2;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ── Run only while visible ──
    let inView = true;
    let tabVisible = !document.hidden;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
      },
      { threshold: 0.01 }
    );
    io.observe(container);
    const onVis = () => {
      tabVisible = !document.hidden;
      if (tabVisible) timer.reset();
    };
    document.addEventListener('visibilitychange', onVis);

    // ── Animation loop ──
    let rafId;
    let yaw = 0;
    let pitch = 0.1;
    let camDist = 7.2;

    const animate = (timestamp) => {
      rafId = requestAnimationFrame(animate);
      if (!inView || !tabVisible) return;

      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();

      // Camera: slow cinematic sway + hover parallax + drag orbit (all damped)
      const aspect = width / height;
      const baseDist = Math.min(13, 8.8 * Math.max(1, 1.5 / aspect));
      camDist += (baseDist - camDist) * 0.06;
      if (!dragging) {
        dragYaw += (0 - dragYaw) * 0.04;
        dragPitch += (0 - dragPitch) * 0.04;
      }
      const targetYaw = Math.sin(t * 0.12) * 0.35 + mouseX * 0.22 + dragYaw;
      const targetPitch = 0.12 + Math.sin(t * 0.09) * 0.05 + mouseY * 0.1 + dragPitch;
      yaw += (targetYaw - yaw) * 0.06;
      pitch += (targetPitch - pitch) * 0.06;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * camDist,
        Math.sin(pitch) * camDist + 0.3,
        Math.cos(yaw) * Math.cos(pitch) * camDist
      );
      camera.lookAt(0, 0, 0);

      // Burst decay
      burst = Math.max(0, burst - dt * 1.4);

      // Gateway motion
      rings.forEach(({ mesh, speed }) => {
        mesh.rotation.x += speed.x * dt;
        mesh.rotation.y += speed.y * dt;
        mesh.rotation.z += speed.z * dt;
      });
      shell.rotation.x = t * 0.2;
      shell.rotation.y = -t * 0.28;
      hexWeb.rotation.x = t * 0.15;
      coreMesh.rotation.x = t * 0.7;
      coreMesh.rotation.y = t * 0.95;
      const pulse = 1 + Math.sin(t * 2.4) * 0.05 + burst * 0.25;
      disc.scale.set(pulse, pulse, 1);
      hexWeb.scale.set(pulse, pulse, 1);
      shell.scale.setScalar(pulse);
      const heartScale = 1 + Math.sin(t * 5) * 0.18 + burst * 0.8;
      heart.scale.setScalar(heartScale);
      discMat.opacity = 0.1 + burst * 0.25;
      coreLight.intensity = 3 + Math.sin(t * 3) * 0.6 + burst * 4;
      scan.position.y = Math.sin(t * 1.6) * 1.4;
      scanMat.opacity = 0.35 + (1 - Math.abs(Math.sin(t * 1.6))) * 0.5;

      // Shockwaves
      if (t > nextAutoShock) {
        spawnShock(t);
        nextAutoShock = t + 2.4;
      }
      for (let i = 0; i < SHOCKS; i++) {
        const s = shocks[i];
        const age = t - s.t0;
        if (age < 0 || age > 1.8) {
          s.mesh.visible = false;
          continue;
        }
        s.mesh.visible = true;
        const sc = 0.8 + age * 2.4;
        s.mesh.scale.set(sc, sc, 1);
        s.mat.opacity = (1 - age / 1.8) * 0.55;
      }

      // Floor + stars drift in flow direction
      grid.position.x = ((t * 0.9) % (CELL * 2)) - 0;
      stars.position.x = Math.sin(t * 0.05) * 0.8;
      stars.rotation.z = Math.sin(t * 0.03) * 0.03;

      // Particles (GPU)
      particleMat.uniforms.uTime.value = t;
      particleMat.uniforms.uBurst.value = burst;

      // Packets
      for (let i = 0; i < PACKETS; i++) {
        const p = packetData[i];
        const u = (p.phase + t * 0.07) % 1;
        const x = u * 16 - 8;
        const ax = Math.abs(x);
        const gate = 1 - THREE.MathUtils.smoothstep(ax, 0, 2.6);
        const k = THREE.MathUtils.smoothstep(x, 0.2, 3.8);
        const r = p.radius * (1 - gate * 0.85);
        const ang = p.angle + (x < 0 ? t * 0.3 : t * 0.18);
        const chaos = x < 0 ? 1 : 1 - k;

        dummy.position.set(x, Math.sin(ang) * r, Math.cos(ang) * r);
        dummy.rotation.set(
          t * p.spin.x * 2.2 * chaos,
          t * p.spin.y * 2.2 * chaos,
          t * p.spin.z * 1.4 * chaos
        );
        const s = p.size * (1 + gate * 1.4 + k * 0.3) * (0.4 + 0.6 * Math.min(1, (8 - ax) / 1.5));
        dummy.scale.setScalar(Math.max(0.001, s));
        dummy.updateMatrix();
        packets.setMatrixAt(i, dummy.matrix);

        if (x < 0) tmpColor.copy(rawColor).lerp(primary, gate);
        else tmpColor.copy(primary).lerp(cleanColor, THREE.MathUtils.smoothstep(x, 0, 2.2));
        tmpColor.lerp(white, Math.pow(gate, 4) * 0.5);
        packets.setColorAt(i, tmpColor);
      }
      packets.instanceMatrix.needsUpdate = true;
      if (packets.instanceColor) packets.instanceColor.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(rafId);
      timer.dispose();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      packets.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // Rebuild only when the theme colors actually change
  }, [theme, primaryHex, secondaryHex]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden rounded-xl bg-slate-950 flex flex-col justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.12),transparent_70%)] pointer-events-none" />
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Header Badge */}
      <div className="relative top-0 inset-x-0 p-3 sm:p-3.5 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono text-slate-200 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-cyan-300">Privacy Pipeline</span>
          <span className="text-slate-400 hidden sm:inline">// HMAC Shield</span>
        </div>
        <span className="text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-sm hidden sm:inline-block">
          drag to orbit
        </span>
      </div>

      {/* Stage labels */}
      <div className="relative bottom-0 inset-x-0 p-3 sm:p-3.5 flex items-center justify-between pointer-events-none z-10 font-mono text-[10px]">
        <span className="px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-md border border-rose-500/40 text-rose-300 shadow-sm">
          Raw Points
        </span>
        <span className="px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 text-cyan-300 shadow-sm">
          HMAC-SHA256
        </span>
        <span className="px-2.5 py-1 rounded-md bg-slate-900/90 backdrop-blur-md border border-emerald-500/40 text-emerald-300 shadow-sm">
          Clean Points
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main export: 3D on tablet/desktop, CSS fallback otherwise
// ─────────────────────────────────────────────────────────────
export default function PrivacyGateway3D(props) {
  const animLevel = useThemeStore((s) => s.animationLevel);
  const colors = useThemeStore((s) => s.getThemeColors)();
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    const check = () => setIsWide(typeof window !== 'undefined' && window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!isWide || animLevel === 'reduced' || animLevel === 'off' || prefersReducedMotion) {
    return <PrivacyGatewayFallback themeColors={colors} />;
  }

  return (
    <ThreeErrorBoundary fallback={<PrivacyGatewayFallback themeColors={colors} />}>
      <ThreeScene {...props} />
    </ThreeErrorBoundary>
  );
}