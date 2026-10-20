import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Activity } from 'lucide-react';

const DEFAULT_STEPS = [
  { label: 'BOOT · PRIVACY ENGINE', pct: 12 },
  { label: 'LOADING · ANONYMISATION CORE', pct: 28 },
  { label: 'LINKING · K-ANONYMITY MODULE', pct: 47 },
  { label: 'VERIFYING · DATA INTEGRITY', pct: 63 },
  { label: 'CALIBRATING · TELEMETRY FEED', pct: 79 },
  { label: 'SECURING · PIPELINE GATEWAY', pct: 91 },
  { label: 'READY', pct: 100 },
];

function DataGlobe({ reducedMotion }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameId = 0;
    let previousTime = 0;
    let rotation = 0;
    let sweepTime = 0;
    const points = [];
    const rows = 21;
    const columns = 50;

    // Build the digit positions once; only the camera angle changes per frame.
    for (let row = 0; row <= rows; row += 1) {
      const latitude = -Math.PI / 2 + (Math.PI * row) / rows;
      for (let column = 0; column < columns; column += 1) {
        const longitude = (2 * Math.PI * column) / columns;
        const seed = row * columns + column;
        points.push({
          x: Math.cos(latitude) * Math.cos(longitude),
          y: Math.sin(latitude),
          z: Math.cos(latitude) * Math.sin(longitude),
          digit: String((seed * 7 + row * 3 + column) % 10),
          variation: ((seed * 17) % 13) / 13,
          longitude,
        });
      }
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const render = (time) => {
      frameId = window.requestAnimationFrame(render);
      if (!width || !height) return;
      if (!reducedMotion && previousTime) {
        rotation += Math.min(time - previousTime, 40) * 0.00088;
        sweepTime += Math.min(time - previousTime, 40) * 0.00115;
      }
      previousTime = time;

      context.clearRect(0, 0, width, height);
      const radius = Math.min(width * 0.24, height * 0.34);
      const centerX = width / 2;
      const centerY = height / 2 - 2;
      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      const tilt = -0.17;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);
      const projected = points.map((point) => {
        const rotatedX = point.x * cosY + point.z * sinY;
        const rotatedZ = -point.x * sinY + point.z * cosY;
        const rotatedY = point.y * cosX - rotatedZ * sinX;
        const depth = point.y * sinX + rotatedZ * cosX;
        const perspective = 2.35 / (2.35 - depth * 0.72);
        return {
          x: centerX + rotatedX * radius * perspective,
          y: centerY + rotatedY * radius * perspective,
          depth,
          digit: point.digit,
          variation: point.variation,
          longitude: point.longitude,
        };
      }).sort((a, b) => a.depth - b.depth);

      for (const point of projected) {
        const frontness = (point.depth + 1) / 2;
        // A traveling data surge wraps around the globe, briefly brightening a narrow band of digits.
        const angle = point.longitude + rotation;
        const delta = Math.atan2(Math.sin(angle - sweepTime), Math.cos(angle - sweepTime));
        const band = Math.exp(-Math.pow(delta / 0.22, 2));
        const flare = band * (0.72 + 0.28 * Math.sin(time * 0.012 + point.y * 18));
        const light = Math.max(0, Math.min(1, 0.22 + frontness * 0.48 + point.variation * 0.14 + flare * (0.24 + frontness * 0.5)));
        const size = 6.5 + frontness * 4 + point.variation * 1.2 + flare * 2.8;
        context.globalAlpha = Math.min(1, 0.1 + light * 0.62 + flare * 0.28);
        context.fillStyle = flare > 0.58 || light > 0.77 ? '#ffffff' : '#d8dce8';
        context.font = `500 ${size.toFixed(1)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(point.digit, point.x, point.y);
      }
      context.globalAlpha = 1;
    };

    frameId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [reducedMotion]);

  return (
    <div className="digit-globe-scene" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

/**
 * PageLoader — cinematic, image-inspired privacy-engine loader.
 * Variants: 'hud' | 'full' | 'minimal' | 'card'.
 * This is a CSS/SVG animation; it does not require a video asset.
 */
export default function PageLoader({
  variant = 'hud',
  title = 'Traffic',
  titleAccent = 'Processor',
  subtitle = 'DATA PRIVACY & TELEMETRY ENGINE',
  steps = DEFAULT_STEPS,
  duration = 2600,
  className = '',
  onComplete = null,
}) {
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const completionCalled = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const reducedMotion = useReducedMotion();
  const safeSteps = steps?.length ? steps : DEFAULT_STEPS;

  useEffect(() => {
    let frameId;
    let completionTimer;
    let startTime;
    let cancelled = false;
    const total = Math.max(250, duration);
    const stepTimer = window.setInterval(() => {
      setStepIdx((index) => Math.min(index + 1, safeSteps.length - 1));
    }, total / safeSteps.length);

    const tick = (now) => {
      if (startTime == null) startTime = now;
      const t = Math.min((now - startTime) / total, 1);
      // Ease-out gives the loading bar a polished finish without a sudden jump.
      const eased = 1 - Math.pow(1 - t, 2.4);
      setProgress(eased * 100);
      if (t < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        setStepIdx(safeSteps.length - 1);
        if (onCompleteRef.current && !completionCalled.current) {
          completionCalled.current = true;
          completionTimer = window.setTimeout(() => {
            if (!cancelled) onCompleteRef.current?.();
          }, 220);
        }
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(completionTimer);
    };
  }, [duration, safeSteps.length]);

  const currentStep = safeSteps[Math.min(stepIdx, safeSteps.length - 1)];
  const skip = () => {
    if (completionCalled.current) return;
    completionCalled.current = true;
    onCompleteRef.current?.();
  };

  if (variant === 'minimal') {
    return (
      <div className={`loader-minimal ${className}`} role="status" aria-live="polite">
        <span className="mini-orb" aria-hidden="true"><i /></span>
        <span>{title}</span>
        <style>{styles}</style>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <section className={`loader-card ${className}`} role="status" aria-live="polite">
        <div className="card-orb" aria-hidden="true"><Activity size={22} /></div>
        <div><h2>{title} {titleAccent}</h2><p>{subtitle}</p></div>
        <AnimatePresence mode="wait">
          <motion.p key={stepIdx} className="card-step" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <span className="status-dot" />{currentStep.label}
          </motion.p>
        </AnimatePresence>
        <div className="card-progress" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <style>{styles}</style>
      </section>
    );
  }

  return (
    <main className={`page-loader ${className}`} role="status" aria-live="polite" aria-busy={progress < 100}>
      <div className="loader-noise" aria-hidden="true" />
      <div className="loader-meta loader-meta-left"><span>PRIVACY ENGINE</span><span>SECURE · LOCAL</span></div>
      <div className="loader-meta loader-meta-right"><ShieldCheck size={14} /><span>ENCRYPTED</span></div>

      <div className="loader-content">
        <DataGlobe reducedMotion={reducedMotion} />
        <div className="loader-heading">
          <h1>{title}<span>{titleAccent}</span></h1>
          <p>{subtitle}</p>
        </div>
        <div className="loader-progress-wrap">
          <div className="loader-progress" role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="loader-status">
            <AnimatePresence mode="wait">
              <motion.span key={stepIdx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
                {currentStep.label}
              </motion.span>
            </AnimatePresence>
            <span className="loader-percent">{Math.round(progress)}%</span>
          </div>
          <div className="loader-pips" aria-hidden="true">
            {safeSteps.map((step, index) => <i key={`${step.label}-${index}`} className={index <= stepIdx ? 'is-active' : ''} />)}
          </div>
        </div>
      </div>

      {onComplete && (
        <button type="button" className="loader-skip" onClick={skip}>
          Skip <span aria-hidden="true">→</span>
        </button>
      )}
      <style>{styles}</style>
    </main>
  );
}

const styles = `
.page-loader,.loader-card,.loader-minimal{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}
.page-loader *,.loader-card *,.loader-minimal *{box-sizing:border-box}
.page-loader{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;color:#f5f7ff;background:#000;isolation:isolate}
.loader-noise{position:absolute;inset:0;pointer-events:none;opacity:.32;background:radial-gradient(ellipse at 50% 42%,rgba(25,35,92,.24),transparent 46%),radial-gradient(ellipse at 50% 100%,rgba(18,30,86,.13),transparent 48%)}
.page-loader{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;color:#f5f7ff;background:#000;isolation:isolate}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.loader-meta{position:absolute;top:28px;display:flex;align-items:center;gap:9px;color:#777f9d;font:500 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em}
.loader-meta-left{left:30px;align-items:flex-start;flex-direction:column;gap:5px}.loader-meta-right{right:30px;color:#aab6ee}
.loader-content{position:relative;z-index:1;display:flex;width:min(440px,calc(100vw - 42px));flex-direction:column;align-items:center;gap:24px;padding:24px 0}
.loader-heading{text-align:center}.loader-heading h1{margin:0;font-size:clamp(23px,5vw,32px);font-weight:650;letter-spacing:-.045em;color:#f3f5ff}.loader-heading h1 span{margin-left:8px;color:#9aa9ff}.loader-heading p{margin:9px 0 0;color:#707895;font:500 9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.24em}
.loader-progress-wrap{width:100%;margin-top:4px}.loader-progress{height:2px;overflow:hidden;border-radius:99px;background:rgba(143,156,255,.17)}.loader-progress span,.card-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#556dff,#a8b7ff,#e8edff);box-shadow:0 0 12px #8298ff;transition:width .12s linear}
.loader-status{display:flex;justify-content:space-between;gap:12px;margin-top:11px;color:#9ba7e5;font:500 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.loader-percent{color:#e0e5ff;font-variant-numeric:tabular-nums}
.loader-pips{display:flex;justify-content:center;gap:6px;margin-top:17px}.loader-pips i{width:4px;height:4px;border-radius:9px;background:#323956;transition:all .25s ease}.loader-pips i.is-active{width:17px;background:#aab8ff;box-shadow:0 0 9px rgba(130,151,255,.8)}
.loader-skip{position:absolute;right:28px;bottom:24px;border:1px solid rgba(151,165,255,.25);border-radius:999px;padding:9px 13px;background:rgba(14,17,33,.65);color:#aab3da;font:500 10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;cursor:pointer;transition:background .2s,border-color .2s}.loader-skip:hover{background:#171c35;border-color:#8396ff}.loader-skip span{margin-left:6px}
.loader-minimal{display:flex;align-items:center;gap:10px;padding:18px;color:#e8ebff;background:#050610}.mini-orb{position:relative;width:22px;height:22px;border:1px solid #8195ff;border-radius:50%;box-shadow:0 0 14px #495cff}.mini-orb i{position:absolute;inset:7px;border-radius:50%;background:white;box-shadow:0 0 8px #96a5ff}.loader-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:15px;overflow:hidden;max-width:420px;margin:16px;padding:30px;border:1px solid rgba(123,142,255,.2);border-radius:20px;color:#eef0ff;text-align:center;background:radial-gradient(ellipse at 50% 0%,rgba(65,79,175,.18),transparent 58%),#080a14}.card-orb{display:grid;width:60px;height:60px;place-items:center;border:1px solid #8496ff;border-radius:50%;color:#eef0ff;box-shadow:0 0 24px rgba(94,112,255,.4)}.loader-card h2{margin:0;font-size:16px}.loader-card p{margin:5px 0 0;color:#8c94b3;font-size:11px}.loader-card .card-step{display:flex;align-items:center;gap:8px;color:#aab6f2;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.status-dot{width:6px;height:6px;border-radius:50%;background:#bac7ff;box-shadow:0 0 8px #869cff}.card-progress{width:180px;height:2px;background:#292d45}.card-progress span{background:#9aabff}

.digit-globe-scene{position:relative;width:min(100%,420px);height:310px;overflow:hidden;display:grid;place-items:center}
.digit-globe-scene canvas{display:block;width:100%;height:100%}
@media(max-width:520px){.digit-globe-scene{height:260px}}
@media(max-width:520px){.loader-meta{top:18px}.loader-meta-left{left:18px}.loader-meta-right{right:18px}.loader-content{gap:18px}.loader-skip{right:18px;bottom:17px}.loader-heading p{font-size:8px;letter-spacing:.16em}}
@media(prefers-reduced-motion:reduce){.loader-progress span,.card-progress span{transition:none}}
`;
