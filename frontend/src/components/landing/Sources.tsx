import { useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  wrap,
} from "motion/react";
import { Bug, Fish, Gauge, Globe, MapPin, Network, ShieldAlert, TrendingUp } from "lucide-react";

const sources = [
  { name: "RDAP", icon: Globe },
  { name: "Tranco", icon: TrendingUp },
  { name: "Open PageRank", icon: Gauge },
  { name: "PhishTank", icon: Fish },
  { name: "URLhaus", icon: Bug },
  { name: "OpenPhish", icon: ShieldAlert },
  { name: "Résolution DNS", icon: Network },
  { name: "ip-api", icon: MapPin },
];

const SPEED = 40;

function SourceSet({ setRef }: { setRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={setRef} className="flex shrink-0" aria-hidden={setRef ? undefined : true}>
      {sources.map((s) => (
        <span
          key={s.name}
          className="mr-16 inline-flex items-center gap-2.5 whitespace-nowrap text-text-muted"
        >
          <s.icon className="size-4 text-text-faint" />
          <span className="font-mono text-sm">{s.name}</span>
        </span>
      ))}
    </div>
  );
}

export default function Sources() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  const [setWidth, setSetWidth] = useState(0);
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const set = setRef.current;
    const container = containerRef.current;
    if (!set || !container) return;

    const measure = () => {
      const sw = set.offsetWidth;
      const cw = container.offsetWidth;
      if (sw <= 0) return;
      setSetWidth(sw);
      setCopies(Math.max(2, Math.ceil((cw * 2) / sw) + 1));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(set);
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (reduceMotion || setWidth === 0) return;
    const moveBy = (SPEED * delta) / 1000;
    x.set(wrap(-setWidth, 0, x.get() - moveBy));
  });

  return (
    <section id="sources" className="border-y border-border py-10">
      <p className="mb-8 text-center font-mono text-xs uppercase tracking-widest text-text-faint">
        Verdicts croisés depuis des sources publiques reconnues
      </p>
      <div
        ref={containerRef}
        className="overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        }}
      >
        <motion.div className="flex w-max" style={{ x }}>
          {Array.from({ length: copies }).map((_, i) => (
            <SourceSet key={i} setRef={i === 0 ? setRef : undefined} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
