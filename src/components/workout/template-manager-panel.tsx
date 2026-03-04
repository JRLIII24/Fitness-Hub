"use client";

import { Send, Pencil, Copy, Trash2, Heart, LayoutList } from "lucide-react";
import { getMuscleColor } from "@/components/marketplace/muscle-colors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WorkoutTemplate } from "@/hooks/workout/use-template-actions";

interface TemplateManagerPanelProps {
  templates: WorkoutTemplate[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  showTemplateManager: boolean;
  templateActionBusyId: string | null;
  likedTemplateIds: Set<string>;
  onToggleManager: () => void;
  onSelectTemplate: (id: string, name: string) => void;
  onSelectStartFresh: () => void;
  onSendTemplate: (template: WorkoutTemplate) => void;
  onEditTemplate: (template: WorkoutTemplate) => void;
  onCopyTemplate: (template: WorkoutTemplate) => void;
  onDeleteTemplate: (template: WorkoutTemplate) => void;
  onToggleLike: (templateId: string) => void;
}

export function TemplateManagerPanel({
  templates,
  loadingTemplates,
  selectedTemplateId,
  showTemplateManager,
  templateActionBusyId,
  likedTemplateIds,
  onToggleManager,
  onSelectTemplate,
  onSelectStartFresh,
  onSendTemplate,
  onEditTemplate,
  onCopyTemplate,
  onDeleteTemplate,
  onToggleLike,
}: TemplateManagerPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center justify-between">
        <Label
          htmlFor="saved-template"
          className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
        >
          Template Selection
        </Label>
        <button
          type="button"
          onClick={onToggleManager}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutList className="size-3" />
          {showTemplateManager ? "Hide Manager" : "Template Manager"}
        </button>
      </div>
      {showTemplateManager ? (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {loadingTemplates ? (
            <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
              No templates yet.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-xl border px-3 py-2 transition ${selectedTemplateId === template.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/70 bg-card/70"
                  }`}
              >
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onSendTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Send
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onEditTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onCopyTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteTemplate(template)}
                    disabled={templateActionBusyId === template.id}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={likedTemplateIds.has(template.id) ? "default" : "secondary"}
                    onClick={() => onToggleLike(template.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Heart className="mr-1 h-3 w-3" />
                    {likedTemplateIds.has(template.id) ? "Liked" : "Like"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSelectStartFresh}
          className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === "none"
            ? "border-primary/40 bg-primary/10"
            : "border-border/70 bg-card/70 hover:bg-card"
            }`}
        >
          <p className="text-sm font-semibold">Start Fresh</p>
          <p className="text-xs text-muted-foreground">No template preloaded</p>
        </button>
        {loadingTemplates ? (
          <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            No templates yet. Use Template Manager above to create one here.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTemplate(template.id, template.name)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelectTemplate(template.id, template.name);
              }}
              className={`rounded-xl border px-3 py-2 text-left transition ${selectedTemplateId === template.id
                ? "border-primary/40 bg-primary/10"
                : "border-border/70 bg-card/70 hover:bg-card"
                }`}
            >
              <div className="flex items-start justify-between gap-1 mb-0.5">
                <p className="truncate text-sm font-semibold">{template.name}</p>
                <div className="flex shrink-0 items-center gap-1">
                  {likedTemplateIds.has(template.id) ? (
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                  ) : null}
                  {template.primary_muscle_group && template.primary_muscle_group.split(",").map((cat) => {
                    const trimmed = cat.trim();
                    const tgc = getMuscleColor(trimmed);
                    return (
                      <span
                        key={trimmed}
                        className="rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize"
                        style={{ background: tgc.bgAlpha, color: tgc.labelColor, border: `1px solid ${tgc.borderAlpha}` }}
                      >
                        {trimmed}
                      </span>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tap to preload</p>
              <div className="mt-1.5 flex gap-1.5">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleLike(template.id);
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${likedTemplateIds.has(template.id)
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    : "border-border/70 text-muted-foreground"
                    }`}
                >
                  <Heart className="h-3 w-3" />
                  Like
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
