import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

/* ────────────────────────────────────────────────────────────────────────────
 * Copy for each privacy action (aliases share one entry)
 * ──────────────────────────────────────────────────────────────────────────── */

const DELETED = {
  badge: '100% Private',
  title: 'Personal Details Deleted',
  description:
    'Permanently removed personal information (names, phone numbers, passport numbers, emails, and home addresses) so no one can identify drivers.',
  riskReduction: 'Zero personal data stored',
  auditStandard: 'Privacy Standard (PASSED)',
};
const PLATES = {
  badge: 'Scrambled Plates',
  title: 'Anonymous Vehicle Numbers',
  description:
    'Replaced real license plates and vehicle IDs with secure secret codes. Analysts can still study traffic flow without knowing who owns the car.',
  riskReduction: 'Driver identity protected',
  auditStandard: 'Plate Privacy (PASSED)',
};
const GPS = {
  badge: 'Blurred Map Locations',
  title: 'Approximate GPS Coordinates',
  description:
    'Rounded exact GPS coordinates to a safe ~1 km grid and grouped times into 15-minute blocks so specific home or office driveways cannot be traced.',
  riskReduction: 'Sensitive locations blurred',
  auditStandard: 'Map Privacy (PASSED)',
};
const TEXT = {
  badge: 'Comment Notes Cleaned',
  title: 'Driver Comments Scrubbed',
  description:
    'Automatically scanned driver remarks and notes to erase accidentally typed phone numbers, customer names, or building door codes.',
  riskReduction: 'Notes safely cleaned',
  auditStandard: 'Text Safety (PASSED)',
};

const METHOD_DETAILS = {
  'Personal Info Deleted': DELETED,
  'Scrambled Plates': PLATES,
  'Blurred GPS Maps': GPS,
  'Cleaned Comments': TEXT,
  'Direct Dropped': {
    ...DELETED,
    description:
      'Permanently removed personal information (names, phone numbers, passport numbers, emails, and IP addresses) so no one can identify drivers.',
  },
  'HMAC Hashed': PLATES,
  'GPS Generalized': GPS,
  'Text Redacted': TEXT,
};

const FALLBACK_DETAILS = (name) => ({
  badge: 'Privacy Operation',
  title: name,
  description: 'Applied transformation to safeguard sensitive quasi-identifiers and maintain statistical utility.',
  riskReduction: 'Zero direct identifier retention',
  auditStandard: 'QC Audit Battery Verified',
});

const DEFAULT_COLORS = ['#BE123C', '#EA580C', '#D97706', '#8B5CF6', '#4F46E5'];

// Compact sizing: the chart fills ~86-88% of the bounding box probe,
// perfectly sizing the 3D pie to ~112px within the 160px canvas with smooth breathing room.
const FIT_FILL = 0.86;
const CANVAS_ASPECT = 1.6;

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Largest-remainder rounding so the legend always adds up to 100. */
function toPercents(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  const rem = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) out[order[k % order.length][1]]++;
  return out;
}

function createShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PrivacyMethodsChart3D
 * Tiered 3D donut with spring pop-out, auto-fitted camera, and linked legend.
 * ──────────────────────────────────────────────────────────────────────────── */

export default function PrivacyMethodsChart3D({ data = [], height = 160 }) {
  const mountRef = useRef(null);
  const theme = useThemeStore((s) => s.theme);
  const isLight = theme === 'light-pro';

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [tip, setTip] = useState(null); // { x, y, index }
  const [webglFailed, setWebglFailed] = useState(false);

  const hoveredRef = useRef(null);
  const selectedRef = useRef(null);
  hoveredRef.current = hoveredIndex;
  selectedRef.current = selectedIndex;

  // Single source of truth for order, colour and percentage – used by both the 3D scene and the legend
  const items = useMemo(() => {
    const sorted = [...(data || [])]
      .map((d) => ({ ...d, value: Math.max(0, Number(d.value) || 0) }))
      .sort((a, b) => b.value - a.value);
    const pcts = toPercents(sorted.map((d) => d.value));
    return sorted.map((d, i) => ({
      ...d,
      idx: i,
      color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      pct: pcts[i],
    }));
  }, [data]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Only rebuild the scene when what's drawn actually changes (parents often pass a fresh array each render)
  const sig = useMemo(() => items.map((d) => `${d.name}:${d.value}:${d.color}`).join('|'), [items]);

  useEffect(() => {
    setSelectedIndex(null);
    setHoveredIndex(null);
    setTip(null);
  }, [sig]);

  // Escape closes the pop-up
  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e) => e.key === 'Escape' && setSelectedIndex(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex]);

  /* ── Three.js scene ───────────────────────────────────────────────────── */
  useEffect(() => {
    const container = mountRef.current;
    const all = itemsRef.current;
    const live = all.filter((d) => d.value > 0);
    if (!container || live.length === 0) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth || 280;
    let canvasHeight = container.clientHeight || height;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('[PrivacyMethodsChart3D] WebGL unavailable:', e);
      setWebglFailed(true);
      return;
    }
    setWebglFailed(false);
    renderer.setSize(width, canvasHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight ? 1.15 : 1.25;
    const el = renderer.domElement;
    el.style.display = 'block';
    el.style.touchAction = 'pan-y'; // taps/hover work, vertical swipes still scroll the page
    container.appendChild(el);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / canvasHeight, 0.1, 100);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, isLight ? 0.95 : 0.85));
    const mainLight = new THREE.DirectionalLight(0xffffff, isLight ? 1.6 : 1.8);
    mainLight.position.set(6, 12, 8);
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(isLight ? 0x93c5fd : 0x818cf8, 0.65);
    fillLight.position.set(-6, 5, -4);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -6, 6);
    scene.add(rimLight);

    // Slices
    const totalVal = live.reduce((a, d) => a + d.value, 0) || 1;
    const chartGroup = new THREE.Group();
    scene.add(chartGroup);

    const meshes = [];
    const radius = 2.05;
    const baseExplode = 0.22;
    let currentAngle = Math.PI * 0.82;

    live.forEach((item, j) => {
      const sliceAngle = (item.value / totalVal) * Math.PI * 2;
      const startAngle = currentAngle;
      currentAngle += sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      const tier = live.length > 1 ? j / (live.length - 1) : 0;
      const depth = 0.55 + tier * 1.15;
      const elevation = tier * 0.75;

      // FIX: after geometry.rotateX(-π/2) a shape's +Y becomes world -Z,
      // so the outward direction is (cos, -sin). The old code used +sin and pushed slices the wrong way on Z.
      const dirX = Math.cos(midAngle);
      const dirZ = -Math.sin(midAngle);

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      const segments = Math.max(16, Math.round(sliceAngle * 28));
      for (let i = 0; i <= segments; i++) {
        const th = startAngle + (i / segments) * sliceAngle;
        shape.lineTo(Math.cos(th) * radius, Math.sin(th) * radius);
      }
      shape.lineTo(0, 0);

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.08,
      });
      geometry.rotateX(-Math.PI / 2);

      const baseColor = new THREE.Color(item.color);
      const material = new THREE.MeshStandardMaterial({
        color: baseColor.clone(),
        emissive: baseColor.clone(),
        emissiveIntensity: 0,
        roughness: isLight ? 0.32 : 0.25,
        metalness: isLight ? 0.08 : 0.15,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(dirX * baseExplode, elevation, dirZ * baseExplode);
      // Keep mesh at scale 1 while constructing chartGroup so bounding box measures true dimensions
      mesh.userData = {
        index: item.idx,
        order: j,
        ox: dirX * baseExplode,
        oy: elevation,
        oz: dirZ * baseExplode,
        dirX,
        dirZ,
        baseColor,
        pop: 0, // spring value: 0 rest, ~0.5 hover, 1 selected
        vel: 0,
        dim: 0,
      };
      chartGroup.add(mesh);
      meshes.push(mesh);
    });

    // Fit camera to the full chart (incl. pop-out margin) for any canvas size / aspect ratio
    chartGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(chartGroup);
    // Balanced margin: preserves space for pop-out explosion, floating wave, and tilt without over-zooming out
    box.min.x -= 0.35; box.max.x += 0.35;
    box.min.z -= 0.35; box.max.z += 0.35;
    box.min.y -= 0.15; box.max.y += 0.35;
    const center = box.getCenter(new THREE.Vector3());
    const corners = [];
    [box.min.x, box.max.x].forEach((x) =>
      [box.min.y, box.max.y].forEach((y) => [box.min.z, box.max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z))))
    );
    const viewDir = new THREE.Vector3(1.6, 4.6, 5.2).normalize();
    const probe = new THREE.Vector3();
    const fitCamera = () => {
      let lo = 4;
      let hi = 40;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        camera.position.copy(center).addScaledVector(viewDir, mid);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        let m = 0;
        for (const c of corners) {
          probe.copy(c).project(camera);
          m = Math.max(m, Math.abs(probe.x), Math.abs(probe.y));
        }
        if (m > FIT_FILL) lo = mid; else hi = mid;
      }
      // Slightly closer camera distance (~25% larger visual size) while keeping safe bounds for animations
      camera.position.copy(center).addScaledVector(viewDir, hi * 0.78);
      camera.lookAt(center);
      camera.updateMatrixWorld();
    };
    fitCamera();

    // Now set initial scale to 0.0001 for smooth entrance animation
    meshes.forEach((m) => m.scale.setScalar(0.0001));

    // Soft contact shadow under the chart
    const shadowTex = createShadowTexture();
    let shadowMesh = null;
    if (shadowTex) {
      shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 3.1, radius * 3.1),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: isLight ? 0.3 : 0.6, depthWrite: false })
      );
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = -0.12;
      scene.add(shadowMesh);
    }

    // Interaction
    let targetTiltX = 0;
    let targetTiltZ = 0;
    const baseRotY = 0.05;
    chartGroup.rotation.y = baseRotY;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const pick = (e) => {
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      ndc.set((px / rect.width) * 2 - 1, -((py / rect.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return { px, py, nx: ndc.x, ny: ndc.y, index: hit ? hit.object.userData.index : null };
    };

    const onMove = (e) => {
      const { px, py, nx, ny, index } = pick(e);
      targetTiltX = ny * 0.08;
      targetTiltZ = -nx * 0.08;
      el.style.cursor = index !== null ? 'pointer' : 'default';
      setHoveredIndex((prev) => (prev === index ? prev : index));
      setTip(index !== null ? { x: px, y: py, index } : null);
    };
    const onLeave = () => {
      targetTiltX = 0;
      targetTiltZ = 0;
      setHoveredIndex(null);
      setTip(null);
    };
    const onClick = (e) => {
      const { index } = pick(e);
      setSelectedIndex((prev) => (index === null ? null : prev === index ? null : index));
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('click', onClick);

    // Render loop: real spring physics, frame-rate independent, paused when offscreen / hidden
    const timer = new THREE.Timer();
    let raf = 0;
    let running = false;
    let inView = true;
    const STIFF = 170;
    const DAMP = reduceMotion ? 2 * Math.sqrt(STIFF) : 15; // critically damped (no bounce) for reduced motion

    const frame = (timestamp) => {
      raf = requestAnimationFrame(frame);
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();
      const k = 1 - Math.exp(-dt * 6);

      chartGroup.rotation.x += (targetTiltX - chartGroup.rotation.x) * k;
      chartGroup.rotation.z += (targetTiltZ - chartGroup.rotation.z) * k;
      chartGroup.rotation.y += (baseRotY + targetTiltZ * 0.5 - chartGroup.rotation.y) * k;

      const hov = hoveredRef.current;
      const sel = selectedRef.current;

      for (const mesh of meshes) {
        const u = mesh.userData;
        const isSel = sel === u.index;
        const isHov = hov === u.index;

        // spring toward target
        const target = isSel ? 1 : isHov ? 0.5 : 0;
        u.vel += ((target - u.pop) * STIFF - u.vel * DAMP) * dt;
        u.pop += u.vel * dt;

        // dim non-selected slices while one is open
        const dimTarget = sel !== null && !isSel ? 1 : 0;
        u.dim += (dimTarget - u.dim) * k;

        const push = u.pop * 0.48;
        const lift = u.pop * 0.28;
        const float = reduceMotion ? 0 : Math.sin(t * 1.9 + u.order * 0.95) * 0.08;
        mesh.position.set(u.ox + u.dirX * push, u.oy + lift + float, u.oz + u.dirZ * push);

        const introP = reduceMotion ? 1 : clamp01((t - u.order * 0.09) / 0.75);
        mesh.visible = introP > 0;
        mesh.scale.setScalar(Math.max(0.0001, (1 + u.pop * 0.08) * easeOutBack(introP)));

        const sweep = reduceMotion ? 0 : Math.pow((Math.sin(t * 2.2 - u.order * 1.1) + 1) / 2, 3) * 0.32;
        mesh.material.emissiveIntensity = Math.max(sweep, Math.max(0, u.pop) * 0.7) * (1 - u.dim * 0.6);
        mesh.material.color.copy(u.baseColor).multiplyScalar(1 - u.dim * 0.45);
      }

      renderer.render(scene, camera);
    };
    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      timer.reset(); // swallow the time spent paused
      frame();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? start() : stop();
    });
    io.observe(container);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();

    // Resize (container-based, not window-based)
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      width = w;
      canvasHeight = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      fitCamera();
    });
    ro.observe(container);

    return () => {
      stop();
      timer.dispose();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('click', onClick);
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      if (shadowMesh) {
        shadowMesh.geometry.dispose();
        shadowMesh.material.dispose();
      }
      shadowTex?.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (container.contains(el)) container.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, height, isLight]);

  /* ── Derived UI state ─────────────────────────────────────────────────── */
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;
  const selectedDetails = selectedItem ? METHOD_DETAILS[selectedItem.name] || FALLBACK_DETAILS(selectedItem.name) : null;
  const tipItem = tip ? items[tip.index] : null;
  const pctLabel = (it) => (it.value > 0 && it.pct === 0 ? '<1' : it.pct);

  const toggle = (idx) => setSelectedIndex((prev) => (prev === idx ? null : idx));

  const ariaLabel = items.length
    ? `Privacy methods breakdown: ${items.map((d) => `${d.name} ${pctLabel(d)} percent`).join(', ')}`
    : 'No privacy methods recorded';

  // Pure-CSS donut used only if WebGL is unavailable
  const conic = useMemo(() => {
    let acc = 0;
    const stops = items.map((d) => {
      const from = acc;
      acc += d.pct;
      return `${d.color} ${from}% ${acc}%`;
    });
    return stops.length ? `conic-gradient(${stops.join(', ')})` : 'none';
  }, [items]);

  if (items.every((d) => d.value === 0)) {
    return (
      <div
        className="w-full flex items-center justify-center text-[11px] font-mono text-theme-dim rounded-xl border border-dashed border-theme-border"
        style={{ height: `${height}px` }}
      >
        No privacy actions recorded for this run yet.
      </div>
    );
  }

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* 3D canvas */}
      <div
        className="relative w-full mx-auto select-none"
        style={{ height: `${height}px`, maxWidth: `${Math.round(height * CANVAS_ASPECT)}px` }}
        role="img"
        aria-label={ariaLabel}
      >
        <div ref={mountRef} className="absolute inset-0" />

        {webglFailed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full"
              style={{
                width: Math.min(height - 16, 140),
                height: Math.min(height - 16, 140),
                background: conic,
                WebkitMask: 'radial-gradient(circle at center, transparent 42%, #000 43%)',
                mask: 'radial-gradient(circle at center, transparent 42%, #000 43%)',
              }}
            />
          </div>
        )}

        {/* Hover label that follows the cursor */}
        {tip && tipItem && !selectedItem && (
          <div
            className="absolute z-20 pointer-events-none px-2 py-1 rounded-md bg-theme-card/95 border border-theme-border shadow-lg text-[10px] font-mono text-theme-text whitespace-nowrap"
            style={{ left: Math.min(tip.x + 12, (mountRef.current?.clientWidth ?? 280) - 150), top: Math.max(0, tip.y - 30) }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: tipItem.color }} />
            {tipItem.name} · <strong>{pctLabel(tipItem)}%</strong>
          </div>
        )}
      </div>

      <div className="text-[10px] font-mono text-theme-dim tracking-wider uppercase mb-1 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-theme-accent motion-safe:animate-pulse" />
        Click slice to pop up details
      </div>

      {/* Pop-up inspection card */}
      <AnimatePresence>
        {selectedItem && selectedDetails && (
          <motion.div
            key={selectedItem.name}
            role="dialog"
            aria-label={`${selectedDetails.title} details`}
            initial={{ opacity: 0, scale: 0.88, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 340 }}
            className="absolute inset-x-0 -top-1 z-30 p-3.5 rounded-2xl border border-theme-border bg-theme-card/95 backdrop-blur-xl shadow-2xl space-y-2 text-xs ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-theme-border/60">
              <span
                className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px] flex items-center gap-1.5"
                style={{
                  backgroundColor: `color-mix(in srgb, ${selectedItem.color} 14%, transparent)`,
                  color: selectedItem.color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full motion-safe:animate-ping" style={{ backgroundColor: selectedItem.color }} />
                {selectedDetails.badge}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="p-1 rounded-md text-theme-dim hover:text-theme-text hover:bg-theme-secondary/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent"
                aria-label="Close pop-up"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-baseline justify-between pt-0.5">
              <h4 className="font-bold text-theme-text text-sm">{selectedDetails.title}</h4>
              <span className="font-mono font-black text-base tabular-nums" style={{ color: selectedItem.color }}>
                {pctLabel(selectedItem)}%
              </span>
            </div>

            <p className="text-[11px] text-theme-dim leading-relaxed">{selectedDetails.description}</p>

            <div className="pt-1.5 flex items-center justify-between text-[10px] font-mono text-theme-muted border-t border-theme-border/40">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">{selectedDetails.riskReduction}</span>
              </span>
              <span className="text-[9px] text-theme-dim font-bold shrink-0 ml-1">{selectedDetails.auditStandard}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend: keyboard-accessible, linked to the 3D slices */}
      <ul className="w-full space-y-1.5 pt-1">
        {items.map((item) => {
          const isSelected = selectedIndex === item.idx;
          const isHovered = hoveredIndex === item.idx;
          const disabled = item.value <= 0;
          return (
            <li key={item.name}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => toggle(item.idx)}
                onMouseEnter={() => !disabled && setHoveredIndex(item.idx)}
                onMouseLeave={() => setHoveredIndex((h) => (h === item.idx ? null : h))}
                onFocus={() => !disabled && setHoveredIndex(item.idx)}
                onBlur={() => setHoveredIndex((h) => (h === item.idx ? null : h))}
                className={`w-full flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-theme-secondary font-bold text-theme-text shadow-sm ring-1 ring-theme-accent'
                    : isHovered
                    ? 'bg-theme-secondary/70 font-semibold text-theme-text'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono font-bold text-theme-text tabular-nums ml-2">
                  {pctLabel(item)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}