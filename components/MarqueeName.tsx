"use client";

interface Props {
  name: string;
  className?: string;
}

export function MarqueeName({ name, className }: Props) {
  if (name.length <= 12) {
    return <span className={className}>{name}</span>;
  }

  // Container carries the className (font-size) so that `ch` unit
  // in the keyframe calc resolves to the correct character width.
  return (
    <span
      className={className}
      style={{ display: "block", width: "12ch", overflow: "hidden" }}
    >
      <span
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          animation: "marquee-name 5s ease-in-out infinite",
        }}
      >
        {name}
      </span>
    </span>
  );
}
