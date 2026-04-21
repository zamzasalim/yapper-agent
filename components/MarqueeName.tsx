"use client";

interface Props {
  name: string;
  className?: string;
}

export function MarqueeName({ name, className }: Props) {
  if (name.length <= 15) {
    return <span className={className}>{name}</span>;
  }

  return (
    <span className="overflow-hidden block max-w-full">
      <span
        className={className}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          animation: "marquee-name 6s ease-in-out infinite",
        }}
      >
        {name}
        <span style={{ margin: "0 1.25rem", opacity: 0.25, userSelect: "none" }}>·</span>
        {name}
      </span>
    </span>
  );
}
