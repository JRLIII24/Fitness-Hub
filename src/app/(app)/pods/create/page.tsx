"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { usePods } from "@/hooks/use-pods";
import { Y2K } from "@/lib/pods/y2k-tokens";
import { StarGrid, Panel, HeroPanel } from "@/components/pods/tacx";

export default function CreatePodPage() {
  const router = useRouter();
  const { createPod } = usePods();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim().length < 2 || name.trim().length > 50) {
      setError("Crew name must be 2-50 characters");
      return;
    }

    if (description.trim().length > 200) {
      setError("Description must be 200 characters or less");
      return;
    }

    setLoading(true);
    setError("");

    const podId = await createPod(name.trim(), description.trim() || undefined);

    if (podId) {
      router.push(`/pods/${podId}`);
    } else {
      setError("Failed to create crew. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: Y2K.r12,
    background: Y2K.bg3,
    border: `1px solid ${Y2K.border2}`,
    color: Y2K.text1,
    fontFamily: Y2K.fontSans,
    fontSize: "14px",
    outline: "none",
  };

  return (
    <div
      className="relative mx-auto max-w-lg px-4 pt-5 pb-28"
      style={{ minHeight: "100vh", background: Y2K.bg0 }}
    >
      <StarGrid />

      <div className="relative flex flex-col gap-3" style={{ zIndex: 1 }}>
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1"
          style={{
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            color: Y2K.text2,
            fontFamily: Y2K.fontDisplay,
            fontSize: "11px",
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            minHeight: "44px",
            alignSelf: "flex-start",
          }}
        >
          <ArrowLeft size={14} />
          BACK
        </button>

        <HeroPanel tier="bronze">
          <div className="flex items-center gap-3" style={{ marginBottom: "4px" }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: Y2K.rFull,
                background: Y2K.div.bronze.bg,
                border: `1px solid ${Y2K.div.bronze.border}`,
              }}
            >
              <Sparkles size={20} style={{ color: Y2K.div.bronze.fg }} />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "20px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: Y2K.text1,
                  margin: 0,
                }}
              >
                Start New Crew
              </h1>
              <p
                style={{
                  fontFamily: Y2K.fontSans,
                  fontSize: "11px",
                  color: Y2K.text3,
                  margin: 0,
                }}
              >
                Create a crew of 2-8 to stay consistent
              </p>
            </div>
          </div>
        </HeroPanel>

        <Panel accent={Y2K.div.bronze.fg}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Squad name */}
            <div>
              <label
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.text3,
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                CREW NAME *
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                maxLength={50}
                autoFocus
                placeholder="e.g. Morning Grinders, Push Pull Crew"
                style={inputStyle}
              />
              <span
                style={{
                  fontFamily: Y2K.fontSans,
                  fontSize: "9px",
                  color: Y2K.text3,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {name.length}/50
              </span>
            </div>

            {/* Briefing */}
            <div>
              <label
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.text3,
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                DESCRIPTION (OPTIONAL)
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError("");
                }}
                maxLength={200}
                rows={3}
                placeholder="What's your crew about? Goals, schedule, vibe..."
                style={{ ...inputStyle, resize: "none" }}
              />
              <span
                style={{
                  fontFamily: Y2K.fontSans,
                  fontSize: "9px",
                  color: Y2K.text3,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {description.length}/200
              </span>
            </div>

            {/* Error */}
            {error && (
              <p style={{ fontFamily: Y2K.fontSans, fontSize: "12px", color: Y2K.status.critical.fg, margin: 0 }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: Y2K.r12,
                background: name.trim().length >= 2
                  ? `linear-gradient(135deg, ${Y2K.div.bronze.fg}, ${Y2K.div.bronze.fg}cc)`
                  : "rgba(255,255,255,0.06)",
                border: name.trim().length >= 2
                  ? `1px solid ${Y2K.div.bronze.fg}`
                  : `1px solid ${Y2K.border1}`,
                color: name.trim().length >= 2 ? Y2K.bg0 : Y2K.text3,
                fontFamily: Y2K.fontDisplay,
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: name.trim().length >= 2 ? "pointer" : "not-allowed",
                opacity: loading ? 0.5 : 1,
                minHeight: "44px",
              }}
            >
              {loading ? "CREATING..." : "LAUNCH CREW"}
            </button>

            {/* Intel card */}
            <div
              style={{
                padding: "10px",
                borderRadius: Y2K.r12,
                background: Y2K.cyanBg,
                border: `1px solid ${Y2K.cyanBorder}`,
              }}
            >
              <span
                style={{
                  fontFamily: Y2K.fontDisplay,
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  color: Y2K.cyan,
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                HOW IT WORKS
              </span>
              <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
                {[
                  "You start as crew leader",
                  "Invite up to 7 players",
                  "Set weekly workout goals together",
                  "Send messages to stay accountable",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily: Y2K.fontSans,
                      fontSize: "11px",
                      color: Y2K.text2,
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </Panel>
      </div>

      <style jsx global>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
