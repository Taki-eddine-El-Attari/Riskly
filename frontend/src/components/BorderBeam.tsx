interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export const BorderBeam = ({
  className = "",
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  // couleurs projet : accent cyan → bleu profond
  colorFrom = "#22d3ee",
  colorTo = "#0891b2",
  delay = 0,
}: BorderBeamProps) => {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration,
          "--anchor": anchor,
          "--border-width": borderWidth,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`,
        } as React.CSSProperties
      }
      className={`border-beam-layer ${className}`}
    />
  );
};
