import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

/** Carte avec tilt 3D qui suit la souris (effet repris de la carte login 21st.dev). */
export function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  // position normalisée du curseur dans la carte : -0.5 (bord gauche/haut) → 0.5
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 300,
    damping: 25,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), {
    stiffness: 300,
    damping: 25,
  });

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div style={{ perspective: 1000 }} className="h-full">
      <motion.div
        className={className}
        style={{ rotateX, rotateY }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
