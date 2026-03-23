"use client";

import { T } from "@/lib/coach-tokens";

interface Alternative {
  name: string;
  muscle_group: string;
  reasoning: string;
  difficulty: "easier" | "similar" | "harder";
}

interface AlternativesData {
  current_exercise: string;
  alternatives: Alternative[];
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  easier: { label: "Easier", color: T.success },
  similar: { label: "Similar", color: T.sky },
  harder: { label: "Harder", color: T.amber },
};

export function AlternativesCard({
  data,
  onSelectOption,
}: {
  data: AlternativesData;
  onSelectOption?: (text: string) => void;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: T.r16,
        background: `linear-gradient(135deg, ${T.glassElevated}, ${T.glassCard})`,
        border: `1px solid ${T.glassBorder}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 14px" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: T.violet,
          }}
        >
          Alternatives for{" "}
          <span style={{ color: T.text1 }}>{data.current_exercise}</span>
        </span>
      </div>

      <div style={{ height: 1, background: T.border1 }} />

      {/* Alternative tiles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {data.alternatives.map((alt, i) => {
          const diff = DIFFICULTY_CONFIG[alt.difficulty] ?? DIFFICULTY_CONFIG.similar;

          return (
            <div key={i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  cursor: onSelectOption ? "pointer" : "default",
                  WebkitTapHighlightColor: "transparent",
                }}
                onClick={() =>
                  onSelectOption?.(
                    `Swap ${data.current_exercise} to ${alt.name}`
                  )
                }
                role={onSelectOption ? "button" : undefined}
                tabIndex={onSelectOption ? 0 : undefined}
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap" as const,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.text1,
                      }}
                    >
                      {alt.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        padding: "2px 7px",
                        borderRadius: T.rFull,
                        background: T.glassElevated,
                        border: `1px solid ${T.border2}`,
                        color: T.sky,
                      }}
                    >
                      {alt.muscle_group}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        padding: "2px 7px",
                        borderRadius: T.rFull,
                        background: `color-mix(in oklch, ${diff.color}, transparent 85%)`,
                        border: `1px solid color-mix(in oklch, ${diff.color}, transparent 70%)`,
                        color: diff.color,
                      }}
                    >
                      {diff.label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      color: T.text2,
                      margin: "4px 0 0",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {alt.reasoning}
                  </p>
                </div>

                {/* Swap button */}
                {onSelectOption && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase" as const,
                      padding: "5px 12px",
                      borderRadius: T.r8,
                      background: `color-mix(in oklch, ${T.volt}, transparent 85%)`,
                      border: `1px solid color-mix(in oklch, ${T.volt}, transparent 65%)`,
                      color: T.volt,
                      flexShrink: 0,
                      cursor: "pointer",
                    }}
                  >
                    Swap
                  </span>
                )}
              </div>

              {/* Divider */}
              {i < data.alternatives.length - 1 && (
                <div
                  style={{
                    height: 1,
                    background: T.border1,
                    marginLeft: 14,
                    marginRight: 14,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
