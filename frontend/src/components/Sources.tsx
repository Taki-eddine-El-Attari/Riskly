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

export default function Sources() {
  const items = [...sources, ...sources]; // dupliqué pour la boucle infinie du marquee

  return (
    <section id="sources" className="border-y border-border py-10">
      <p className="mb-8 text-center font-mono text-xs uppercase tracking-widest text-text-faint">
        Verdicts croisés depuis des sources publiques reconnues
      </p>
      <div className="marquee">
        <div className="marquee-track">
          {items.map((s, i) => (
            <span
              key={i}
              className="mx-8 inline-flex items-center gap-2.5 whitespace-nowrap text-text-muted"
            >
              <s.icon className="size-4 text-text-faint" />
              <span className="font-mono text-sm">{s.name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
