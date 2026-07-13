import { useEffect, useRef, useCallback } from "react";
import createGlobe from "cobe";
import { useReducedMotion } from "motion/react";

// Globe cobe v2 : points de présence (TLD) + arcs vers les sources de données.
// Les étiquettes flottantes s'accrochent aux ancres CSS exposées par cobe
// (--cobe-<id> / --cobe-visible-<id>) — rendues uniquement si le navigateur
// supporte CSS Anchor Positioning, sinon le globe reste seul (dégradation propre).

interface GlobeMarker {
  id: string;
  location: [number, number];
  label: string;
}

interface GlobeArc {
  id: string;
  from: [number, number];
  to: [number, number];
  source: string;
}

interface GlobeProps {
  markers?: GlobeMarker[];
  arcs?: GlobeArc[];
  className?: string;
  speed?: number;
}

// Villes → TLD analysés (clin d'œil : .ma, cf. exemples du hero).
const defaultMarkers: GlobeMarker[] = [
  { id: "tld-com", location: [38.95, -77.45], label: ".com" },
  { id: "tld-io", location: [37.62, -122.38], label: ".io" },
  { id: "tld-fr", location: [49.01, 2.55], label: ".fr" },
  { id: "tld-jp", location: [35.55, 139.78], label: ".jp" },
  { id: "tld-au", location: [-33.95, 151.18], label: ".au" },
  { id: "tld-br", location: [-23.43, -46.47], label: ".br" },
  { id: "tld-sg", location: [1.36, 103.99], label: ".sg" },
  { id: "tld-ma", location: [33.57, -7.59], label: ".ma" },
  { id: "tld-ie", location: [53.43, -6.25], label: ".ie" },
  { id: "tld-in", location: [19.09, 72.87], label: ".in" },
];

// Chaque arc = une requête vers une source croisée par Riskly.
const defaultArcs: GlobeArc[] = [
  { id: "src-whois", from: [38.95, -77.45], to: [49.01, 2.55], source: "WHOIS" },
  { id: "src-gsb", from: [37.62, -122.38], to: [35.55, 139.78], source: "Safe Browsing" },
  { id: "src-spamhaus", from: [49.01, 2.55], to: [1.36, 103.99], source: "Spamhaus" },
  { id: "src-tranco", from: [38.95, -77.45], to: [-23.43, -46.47], source: "Tranco" },
  { id: "src-wayback", from: [35.55, 139.78], to: [-33.95, 151.18], source: "Wayback" },
  { id: "src-dns", from: [33.57, -7.59], to: [49.01, 2.55], source: "DNS" },
];

// #22D3EE (accent cyan) en RGB normalisé pour cobe.
const CYAN: [number, number, number] = [34 / 255, 211 / 255, 238 / 255];

const supportsAnchors =
  typeof CSS !== "undefined" && CSS.supports("position-anchor", "--x");

export function Globe({
  markers = defaultMarkers,
  arcs = defaultArcs,
  className = "",
  speed = 0.003,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const reduced = useReducedMotion();
  const speedRef = useRef(speed);
  speedRef.current = reduced ? 0 : speed;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPausedRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId: number;
    let ro: ResizeObserver | null = null;
    let phi = 0;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.2,
        dark: 1,
        diffuse: 1.6,
        mapSamples: 16000,
        mapBrightness: 7,
        baseColor: [0.28, 0.38, 0.58],
        markerColor: CYAN,
        glowColor: [0.05, 0.14, 0.2],
        opacity: 0.92,
        markerElevation: 0.02,
        markers: markers.map((m) => ({ location: m.location, size: 0.035, id: m.id })),
        arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        arcColor: CYAN,
        arcWidth: 0.5,
        arcHeight: 0.25,
      });

      function animate() {
        if (!isPausedRef.current) phi += speedRef.current;
        globe!.update({
          phi: phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        });
        animationId = requestAnimationFrame(animate);
      }
      animate();
      setTimeout(() => canvas && (canvas.style.opacity = "1"));
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      ro = new ResizeObserver((entries) => {
        if ((entries[0]?.contentRect.width ?? 0) > 0) {
          ro?.disconnect();
          init();
        }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
      ro?.disconnect();
    };
  }, [markers, arcs]);

  // Petite pyramide 3D en CSS qui tourne au-dessus de chaque point.
  const pyramidFaceStyle = (nth: number): React.CSSProperties => {
    const transforms = [
      "rotateY(0deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(120deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(240deg) translateZ(4px) rotateX(19.5deg)",
      "rotateX(-90deg) rotateZ(60deg) translateY(4px)",
    ];
    const colors = ["#67E8F9", "#22D3EE", "#0E7490", "#155E75"];
    return {
      position: "absolute",
      left: -0.5,
      top: 0,
      width: 0,
      height: 0,
      borderLeft: "6.5px solid transparent",
      borderRight: "6.5px solid transparent",
      borderBottom: `13px solid ${colors[nth]}`,
      transformOrigin: "center bottom",
      transform: transforms[nth],
    };
  };

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        aria-label="Globe interactif des domaines analysés dans le monde"
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />
      {supportsAnchors &&
        markers.map((m) => (
          <div
            key={m.id}
            className="pointer-events-none absolute flex flex-col items-center gap-1.5"
            style={{
              positionAnchor: `--cobe-${m.id}`,
              bottom: "anchor(top)",
              left: "anchor(center)",
              translate: "-50% 0",
              opacity: `var(--cobe-visible-${m.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
              transition: "opacity 0.3s, filter 0.3s",
            }}
          >
            <div
              className="globe-pyramid relative size-3"
              style={{ transformStyle: "preserve-3d" }}
            >
              {[0, 1, 2, 3].map((n) => (
                <div key={n} style={pyramidFaceStyle(n)} />
              ))}
            </div>
            <span className="whitespace-nowrap rounded border border-border bg-bg-elevated/90 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-accent shadow-sm">
              {m.label}
            </span>
          </div>
        ))}
      {supportsAnchors &&
        arcs.map((a) => (
          <div
            key={a.id}
            className="pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap rounded border border-border bg-bg/90 px-2 py-1 font-mono text-[10px] text-text-muted"
            style={{
              positionAnchor: `--cobe-arc-${a.id}`,
              bottom: "anchor(top)",
              left: "anchor(center)",
              translate: "-50% 0",
              opacity: `var(--cobe-visible-arc-${a.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-arc-${a.id}, 0)) * 8px))`,
              transition: "opacity 0.3s, filter 0.3s",
            }}
          >
            {a.source} <span className="text-good">✓</span>
          </div>
        ))}
    </div>
  );
}
