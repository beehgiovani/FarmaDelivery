import type { ReactNode } from "react";

type MetricProps = {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "amber" | "green" | "red" | "blue";
};

export function Metric({ icon, label, value, tone }: MetricProps) {
  return (
    <article className={`metric ${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}
