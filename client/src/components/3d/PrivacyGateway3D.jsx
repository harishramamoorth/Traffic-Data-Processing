import React, { useEffect, useRef, useState, Component } from 'react';
import * as THREE from 'three';
import { useThemeStore } from '../../store/useThemeStore';
import { ShieldCheck, Lock, Activity, Eye, Zap, Sparkles, RefreshCw } from 'lucide-react';

// Error Boundary for WebGL 3D Scene
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

// Lightweight 2D/CSS Fallback for Mobile, Low-Power, or Reduced Motion
function PrivacyGatewayFallback({ themeColors }) {
  return (
    <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-theme-border/60 p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_70%)]" />
      <div className="relative z-10 flex items-center justify-between w-full max-w-lg">
        {/* Raw Ingestion Side */}
        <div className="flex flex-col items-center gap-2 text-rose-400">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center animate-pulse shadow-lg shadow-rose-500/20">
            <Lock className="w-7 h-7 text-rose-400" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wider">RAW TELEMETRY</span>
          <span className="text-[10px] text-slate-400 font-mono">Unmasked Plates & GPS</span>
        </div>

        {/* Gateway Center */}
        <div className="flex flex-col items-center gap-2 px-4">
          <div className="relative w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_35px_rgba(6,182,212,0.5)]">
            <ShieldCheck className="w-10 h-10 text-cyan-300 animate-bounce" />
            <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
          </div>
          <span className="text-xs font-extrabold tracking-widest text-cyan-300 uppercase font-mono">
            Privacy Portal
          </span>
          <span className="text-[10px] font-mono text-cyan-400/90 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
            HMAC-SHA256 • ZERO RETENTION
          </span>
        </div>

        {/* Anonymized Output Side */}
        <div className="flex flex-col items-center gap-2 text-emerald-400">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/20">
            <Activity className="w-7 h-7 text-emerald-400" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wider">SANITIZED OUTPUT</span>
          <span className="text-[10px] text-slate-400 font-mono">Audited & Reconciled</span>
        </div>
      </div>
    </div>
  );
}

// 3D Canvas Scene
function ThreeScene() {
  const containerRef = useRef(null);
  const theme = useThemeStore((s) => s.theme);
  const colors = useThemeStore((s) => s.getThemeColors)();
  
  // Interactive Controls State
  const [cameraMode, setCameraMode] = useState('tunnel'); // 'tunnel' | 'scanner' | 'iris'
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [pulseTrigger, setPulseTrigger] = useState(0);
  const [liveRate, setLiveRate] = useState(128450);

  // Live fluctuating telemetry rate
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveRate((prev) => {
        const delta = Math.floor((Math.random() - 0.48) * 1200);
        return Math.max(98000, Math.min(165000, prev + delta));
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Shared ref for canvas interactions
  const sceneStateRef = useRef({
    cameraMode: 'tunnel',
    speedMultiplier: 1,
    shockwaveRadius: 0,
    shockwaveActive: false,
    triggerShockwave: () => {}
  });

  useEffect(() => {
    sceneStateRef.current.cameraMode = cameraMode;
    sceneStateRef.current.speedMultiplier = speedMultiplier;
  }, [cameraMode, speedMultiplier]);

  useEffect(() => {
    if (pulseTrigger > 0) {
      sceneStateRef.current.triggerShockwave();
    }
  }, [pulseTrigger]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 340;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.045);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 7.8);
    camera.lookAt(0, 0, 0);

    // Camera target positions for modes
    const cameraTargets = {
      tunnel: { pos: new THREE.Vector3(0, 1.1, 7.5), look: new THREE.Vector3(0, 0, 0) },
      scanner: { pos: new THREE.Vector3(4.5, 2.8, 5.5), look: new THREE.Vector3(0, 0, 0) },
      iris: { pos: new THREE.Vector3(-5.5, 0.3, 2.2), look: new THREE.Vector3(1.2, 0, 0) }
    };

    // 2. Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const primaryColor = new THREE.Color(colors.primary);
    const secondaryColor = new THREE.Color(colors.secondary || '#3b82f6');
    const rawColor = new THREE.Color(0xf43f5e); // Rose / Raw PII

    // Core Gateway Light
    const coreLight = new THREE.PointLight(primaryColor, 3.5, 12);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // Ingress (Red) & Egress (Accent) Accent Lights
    const ingressLight = new THREE.PointLight(rawColor, 2.0, 8);
    ingressLight.position.set(-4, 1.5, 1);
    scene.add(ingressLight);

    const egressLight = new THREE.PointLight(secondaryColor, 2.5, 8);
    egressLight.position.set(4, 1.5, 1);
    scene.add(egressLight);

    // 4. Multi-Layered Privacy Gateway Iris (Center X = 0)
    const portalGroup = new THREE.Group();
    scene.add(portalGroup);

    // Ring 1: Outer Segmented Gyro Ring
    const outerRingGeo = new THREE.TorusGeometry(1.85, 0.045, 16, 72);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    portalGroup.add(outerRing);

    // Ring 2: Counter-Rotating Glyphed Iris
    const midRingGeo = new THREE.TorusGeometry(1.4, 0.035, 12, 48);
    const midRingMat = new THREE.MeshBasicMaterial({
      color: secondaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const midRing = new THREE.Mesh(midRingGeo, midRingMat);
    portalGroup.add(midRing);

    // Ring 3: Fast Inner Quantum Iris
    const innerRingGeo = new THREE.TorusGeometry(0.95, 0.025, 8, 36);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.9
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    portalGroup.add(innerRing);

    // Holographic Forcefield Membrane at X = 0
    const membraneGeo = new THREE.CircleGeometry(1.35, 48);
    const membraneMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const membrane = new THREE.Mesh(membraneGeo, membraneMat);
    membrane.rotation.y = Math.PI / 2;
    portalGroup.add(membrane);

    // Center Cryptographic Core (Floating Rotating Crystal)
    const coreGeo = new THREE.IcosahedronGeometry(0.36, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      emissive: primaryColor,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9,
      wireframe: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    portalGroup.add(coreMesh);

    // Shockwave Ring Mesh
    const shockwaveGeo = new THREE.RingGeometry(0.1, 0.25, 48);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockwaveMesh.rotation.y = Math.PI / 2;
    portalGroup.add(shockwaveMesh);

    // Holographic Vertical Scanning Laser Beam
    const laserGeo = new THREE.PlaneGeometry(0.04, 3.8);
    const laserMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const laserBeam = new THREE.Mesh(laserGeo, laserMat);
    laserBeam.rotation.y = Math.PI / 2;
    portalGroup.add(laserBeam);

    // 5. High-Performance Particle Stream (1,200 particles)
    const particleCount = 1200;
    const positions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);
    const offsets = new Float32Array(particleCount * 2); // angle and base radius

    for (let i = 0; i < particleCount; i++) {
      // Span along X from -8.0 to +8.0
      const x = -8.0 + Math.random() * 16.0;
      const angle = Math.random() * Math.PI * 2;
      const baseRadius = 0.25 + Math.random() * 1.5;

      offsets[i * 2] = angle;
      offsets[i * 2 + 1] = baseRadius;

      // Convergence towards center gateway aperture
      const distFromCenter = Math.abs(x);
      const funnelScale = Math.min(1.0, 0.45 + (distFromCenter / 8.0) * 0.7);
      const radius = baseRadius * funnelScale;

      const y = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      velocities[i] = 0.04 + Math.random() * 0.045;

      // Color depends on position relative to X = 0
      const c = x < 0 ? rawColor : primaryColor;
      particleColors[i * 3] = c.r;
      particleColors[i * 3 + 1] = c.g;
      particleColors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Custom circular glowing particle texture
    const createParticleTexture = () => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.8, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
      return new THREE.CanvasTexture(c);
    };

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: createParticleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // 6. Floating Telemetry Data Packets (Cubes passing through gateway)
    const packetCount = 6;
    const packetBoxes = [];
    const packetGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);

    for (let i = 0; i < packetCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: rawColor,
        wireframe: true,
        transparent: true,
        opacity: 0.75
      });
      const mesh = new THREE.Mesh(packetGeo, mat);
      // Staggered along X
      const x = -7 + (i * 14) / packetCount;
      const angle = (i * Math.PI * 2) / packetCount;
      mesh.position.set(x, Math.sin(angle) * 0.8, Math.cos(angle) * 0.8);
      scene.add(mesh);
      packetBoxes.push({ mesh, mat, speed: 0.035, angleOffset: angle });
    }

    // Shockwave Trigger Callback
    let shockwaveProgress = -1;
    sceneStateRef.current.triggerShockwave = () => {
      shockwaveProgress = 0;
    };

    // Mouse Interaction Tracking
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / height - 0.5) * 2;
    };
    const handleClick = () => {
      sceneStateRef.current.triggerShockwave();
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 7. Main Animation Loop (High-resolution timer, zero deprecation warnings)
    let animationFrameId;
    let lastTime = performance.now();
    const startTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsedTime = (now - startTime) / 1000;
      const speed = sceneStateRef.current.speedMultiplier;

      // Camera smoothly transitioning between viewpoints
      const currentMode = sceneStateRef.current.cameraMode;
      const targetConfig = cameraTargets[currentMode] || cameraTargets.tunnel;

      camera.position.x += (targetConfig.pos.x + mouseX * 0.45 - camera.position.x) * 0.05;
      camera.position.y += (targetConfig.pos.y + mouseY * 0.3 - camera.position.y) * 0.05;
      camera.position.z += (targetConfig.pos.z - camera.position.z) * 0.05;
      camera.lookAt(targetConfig.look.x, targetConfig.look.y, targetConfig.look.z);

      // Rotate Gateway Components
      outerRing.rotation.z = elapsedTime * 0.45 * speed;
      outerRing.rotation.y = elapsedTime * 0.25 * speed;

      midRing.rotation.z = -elapsedTime * 0.65 * speed;
      midRing.rotation.x = Math.sin(elapsedTime * 0.5) * 0.3;

      innerRing.rotation.z = elapsedTime * 1.1 * speed;
      innerRing.rotation.y = -elapsedTime * 0.5 * speed;

      coreMesh.rotation.x = elapsedTime * 0.9 * speed;
      coreMesh.rotation.y = elapsedTime * 1.2 * speed;

      // Pulsing Forcefield Membrane
      const membraneScale = 1.0 + Math.sin(elapsedTime * 4.0) * 0.06;
      membrane.scale.set(membraneScale, membraneScale, 1.0);
      membraneMat.opacity = 0.16 + Math.sin(elapsedTime * 3.0) * 0.08;

      // Oscillating Scanner Laser Sweep
      laserBeam.position.x = Math.sin(elapsedTime * 2.5) * 0.25;

      // Interactive Shockwave expansion
      if (shockwaveProgress >= 0) {
        shockwaveProgress += delta * 2.8 * speed;
        if (shockwaveProgress > 1.0) {
          shockwaveProgress = -1;
          shockwaveMat.opacity = 0;
        } else {
          const s = shockwaveProgress * 3.5;
          shockwaveMesh.scale.set(s, s, s);
          shockwaveMat.opacity = (1.0 - shockwaveProgress) * 0.9;
        }
      }

      // Dynamic Particle Streaming & Transformations
      const pos = particleGeo.attributes.position.array;
      const col = particleGeo.attributes.color.array;

      for (let i = 0; i < particleCount; i++) {
        // Advance particle along X axis
        pos[i * 3] += velocities[i] * speed;

        // Wrap around when exiting on the right (+8.0)
        if (pos[i * 3] > 8.0) {
          pos[i * 3] = -8.0;
        }

        const currX = pos[i * 3];
        const distFromCenter = Math.abs(currX);
        const angle = offsets[i * 2] + elapsedTime * 0.25;
        const baseRadius = offsets[i * 2 + 1];

        // Funnel constriction towards aperture at X = 0
        const funnelScale = Math.min(1.0, 0.4 + (distFromCenter / 8.0) * 0.7);
        let radius = baseRadius * funnelScale;

        // Shockwave displacement impulse
        if (shockwaveProgress >= 0) {
          const waveFront = shockwaveProgress * 3.5;
          const distToWave = Math.abs(radius - waveFront);
          if (distToWave < 0.4) {
            radius += (0.4 - distToWave) * 0.45;
          }
        }

        if (currX < 0) {
          // RAW INGESTION: Micro-jitter / high-entropy brownian fluctuation
          const jitter = (Math.sin(elapsedTime * 20 + i) * 0.02) * (distFromCenter / 4.0);
          pos[i * 3 + 1] = Math.sin(angle) * radius + jitter;
          pos[i * 3 + 2] = Math.cos(angle) * radius + jitter;

          // Warning Red / Rose Color
          col[i * 3] = rawColor.r;
          col[i * 3 + 1] = rawColor.g;
          col[i * 3 + 2] = rawColor.b;
        } else {
          // SANITIZED EGRESS: Laminar, coherent streamlines with smooth harmonic waves
          const wave = Math.sin(elapsedTime * 3.0 + currX * 0.8) * 0.08;
          pos[i * 3 + 1] = Math.sin(angle) * radius + wave;
          pos[i * 3 + 2] = Math.cos(angle) * radius;

          // Transformation flash right at X = 0, then theme primary/secondary
          if (currX < 0.6) {
            col[i * 3] = 1.0; // Flash bright white-hot energy
            col[i * 3 + 1] = 1.0;
            col[i * 3 + 2] = 1.0;
          } else {
            col[i * 3] = primaryColor.r;
            col[i * 3 + 1] = primaryColor.g;
            col[i * 3 + 2] = primaryColor.b;
          }
        }
      }

      particleGeo.attributes.position.needsUpdate = true;
      particleGeo.attributes.color.needsUpdate = true;

      // Advance Telemetry Data Packets
      packetBoxes.forEach((pkt) => {
        pkt.mesh.position.x += pkt.speed * speed;
        if (pkt.mesh.position.x > 7.5) {
          pkt.mesh.position.x = -7.5;
        }

        const pX = pkt.mesh.position.x;
        pkt.mesh.rotation.x += 0.02;
        pkt.mesh.rotation.y += 0.03;

        // Packet transformation: Red before gateway -> Emerald/Accent after gateway
        if (pX < 0) {
          pkt.mat.color.copy(rawColor);
        } else {
          pkt.mat.color.copy(secondaryColor);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // 8. Cleanup & Disposals
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Geometries
      outerRingGeo.dispose();
      outerRingMat.dispose();
      midRingGeo.dispose();
      midRingMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      membraneGeo.dispose();
      membraneMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      shockwaveGeo.dispose();
      shockwaveMat.dispose();
      laserGeo.dispose();
      laserMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      packetGeo.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [theme, colors]);

  return (
    <div className="relative w-full h-full min-h-[320px] select-none">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="w-full h-full min-h-[320px] cursor-crosshair" />

      {/* Cyber Corner Reticle Brackets */}
      <div className="absolute top-2 left-2 text-cyan-400/50 font-mono text-xs pointer-events-none">┌</div>
      <div className="absolute top-2 right-2 text-cyan-400/50 font-mono text-xs pointer-events-none">┐</div>
      <div className="absolute bottom-2 left-2 text-cyan-400/50 font-mono text-xs pointer-events-none">└</div>
      <div className="absolute bottom-2 right-2 text-cyan-400/50 font-mono text-xs pointer-events-none">┘</div>

      {/* Top HUD: Real-time Telemetry Monitor */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold">QUANTUM PRIVACY GATEWAY</span>
          <span className="text-cyan-400/60 hidden sm:inline">// HMAC-SHA256</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{liveRate.toLocaleString()} rec/s</span>
          </div>
        </div>
      </div>

      {/* Bottom HUD: Interactive Camera View Modes & Speed Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
        {/* View Angle Mode Pills */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800">
          {[
            { id: 'tunnel', label: 'Tunnel', icon: Zap },
            { id: 'scanner', label: 'Scanner', icon: Eye },
            { id: 'iris', label: 'Iris Core', icon: Sparkles }
          ].map((m) => {
            const isAct = cameraMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCameraMode(m.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                  isAct
                    ? 'bg-cyan-500 text-black font-bold shadow-sm shadow-cyan-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title={`Switch camera view to ${m.label}`}
              >
                <m.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Shockwave Pulse & Speed Turbo */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPulseTrigger((c) => c + 1)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 font-mono text-[10px] font-semibold transition-all shadow-sm hover:scale-105 active:scale-95"
            title="Click to pulse cryptographic shockwave through portal"
          >
            <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
            <span>Shockwave</span>
          </button>

          <button
            type="button"
            onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : 1))}
            className={`px-2.5 py-1 rounded-xl border text-[10px] font-mono font-bold transition-all ${
              speedMultiplier === 2
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle particle stream speed"
          >
            {speedMultiplier === 2 ? '2x Turbo' : '1x Speed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Export Component with Device & Preference Handling
export default function PrivacyGateway3D(props) {
  const animLevel = useThemeStore((s) => s.animationLevel);
  const colors = useThemeStore((s) => s.getThemeColors)();
  const [shouldRender3D, setShouldRender3D] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animLevel === 'off' || prefersReducedMotion) {
      setShouldRender3D(false);
    } else {
      setShouldRender3D(true);
    }
  }, [animLevel]);

  if (!shouldRender3D) {
    return <PrivacyGatewayFallback themeColors={colors} />;
  }

  return (
    <ThreeErrorBoundary fallback={<PrivacyGatewayFallback themeColors={colors} />}>
      <ThreeScene {...props} />
    </ThreeErrorBoundary>
  );
}
