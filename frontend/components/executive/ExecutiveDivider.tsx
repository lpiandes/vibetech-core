import { semanticColors } from "@/design/tokens";

export default function ExecutiveDivider() {
  return (
    <div
      style={{
        height: 1,
        width: "100%",
        backgroundColor: semanticColors.border,
        margin: 0,
      }}
      aria-hidden="true"
    />
  );
}

