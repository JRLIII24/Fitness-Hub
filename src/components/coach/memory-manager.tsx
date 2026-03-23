"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Trash2, X } from "lucide-react";
import { T } from "@/lib/coach-tokens";

interface MemoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Memory {
  id: string;
  category: "injury" | "goal" | "preference" | "note";
  content: string;
  created_at: string;
  updated_at: string;
}

const CATEGORY_CONFIG: Record<
  Memory["category"],
  { label: string; color: string }
> = {
  injury: { label: "Injuries", color: T.error },
  goal: { label: "Goals", color: T.volt },
  preference: { label: "Preferences", color: T.sky },
  note: { label: "Notes", color: T.text2 },
};

const CATEGORIES: Memory["category"][] = [
  "injury",
  "goal",
  "preference",
  "note",
];

export function MemoryManager({ isOpen, onClose }: MemoryManagerProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<string>
  >(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen, fetchMemories]);

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/coach/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      // silent
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: memories.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  const isEmpty = memories.length === 0 && !loading;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 90,
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "60vh",
              zIndex: 91,
              background: T.bgCard,
              border: `1px solid ${T.border1}`,
              borderBottom: "none",
              borderRadius: "20px 20px 0 0",
              backdropFilter: "blur(24px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px 12px",
                borderBottom: `1px solid ${T.border1}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Brain size={18} style={{ color: T.volt }} />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.text1,
                    fontFamily: T.fontSans,
                  }}
                >
                  APEX Memory
                </span>
                {memories.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: T.text2,
                      fontFamily: T.fontSans,
                    }}
                  >
                    ({memories.length})
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.text2,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div
              style={{
                overflowY: "auto",
                padding: "12px 20px 20px",
                flex: 1,
              }}
            >
              {loading && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 0",
                    color: T.text2,
                    fontSize: 12,
                    fontFamily: T.fontSans,
                  }}
                >
                  Loading memories...
                </div>
              )}

              {isEmpty && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: T.text2,
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: T.fontSans,
                  }}
                >
                  APEX hasn&apos;t stored any memories yet. As you chat,
                  I&apos;ll remember your injuries, goals, and preferences.
                </div>
              )}

              {!loading &&
                grouped.map(({ category, items }) => {
                  const config = CATEGORY_CONFIG[category];
                  const isCollapsed = collapsedCategories.has(category);

                  return (
                    <div key={category} style={{ marginBottom: 16 }}>
                      {/* Category header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 0",
                          width: "100%",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            color: config.color,
                            fontFamily: T.fontSans,
                          }}
                        >
                          {config.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: T.text2,
                            fontFamily: T.fontSans,
                          }}
                        >
                          ({items.length})
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: T.text2,
                            marginLeft: "auto",
                            transition: "transform 0.2s",
                            transform: isCollapsed
                              ? "rotate(-90deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          &#9660;
                        </span>
                      </button>

                      {/* Memory items */}
                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: "hidden" }}
                          >
                            {items.map((memory) => (
                              <div
                                key={memory.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  padding: "8px 0",
                                  borderBottom: `1px solid ${T.border1}`,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: T.text1,
                                    lineHeight: 1.5,
                                    fontFamily: T.fontSans,
                                    flex: 1,
                                  }}
                                >
                                  {memory.content}
                                </span>
                                <button
                                  onClick={() => handleDelete(memory.id)}
                                  disabled={deletingIds.has(memory.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: deletingIds.has(memory.id)
                                      ? "wait"
                                      : "pointer",
                                    padding: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 24,
                                    height: 24,
                                    flexShrink: 0,
                                    color: T.text2,
                                    opacity: deletingIds.has(memory.id)
                                      ? 0.4
                                      : 0.6,
                                    transition: "color 0.15s, opacity 0.15s",
                                  }}
                                  onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.color =
                                      T.error;
                                    (e.currentTarget as HTMLButtonElement).style.opacity =
                                      "1";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.color =
                                      T.text2;
                                    (e.currentTarget as HTMLButtonElement).style.opacity =
                                      "0.6";
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
