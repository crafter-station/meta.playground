"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import {
  MODELS,
  PROVIDER_COLORS,
  calculateCost,
  formatCost,
} from "@/lib/models";
import {
  Upload,
  X,
  Loader2,
  Check,
  AlertCircle,
  ImageIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Calculator,
  RotateCcw,
} from "lucide-react";
import { type MetadataResult, DEFAULT_PROMPT } from "./api/extract/route";
import { CrafterStationLogo } from "@/components/logos/crafter-station";

type ExtractionResult = {
  metadata: MetadataResult;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  duration: number;
  model: string;
  cost: number;
};

type ModelExtractionState = {
  status: "idle" | "loading" | "success" | "error";
  result?: ExtractionResult;
  error?: string;
};

const VOLUME_TIERS = [1, 100, 1_000, 10_000, 100_000] as const;

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function PlaygroundPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(MODELS.map((m) => m.id))
  );
  const [extractions, setExtractions] = useState<
    Record<string, ModelExtractionState>
  >({});
  const [isDragging, setIsDragging] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [jsonViewCards, setJsonViewCards] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample image on mount
  useEffect(() => {
    fetch("/sample_image.jpg")
      .then((res) => res.blob())
      .then((blob) => {
        const f = new File([blob], "sample_image.jpg", { type: "image/jpeg" });
        setFile(f);
        setPreview("/sample_image.jpg");
      })
      .catch(() => {});
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setExtractions({});
    setExpandedCards(new Set());
    setJsonViewCards(new Set());
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    setExtractions({});
    setExpandedCards(new Set());
    setJsonViewCards(new Set());
  }, [preview]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith("image/")) handleFile(f);
    },
    [handleFile]
  );

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleJsonView = (id: string) => {
    setJsonViewCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const extractAll = async () => {
    if (!file || selectedModels.size === 0) return;

    const initial: Record<string, ModelExtractionState> = {};
    selectedModels.forEach((id) => {
      initial[id] = { status: "loading" };
    });
    setExtractions(initial);
    setExpandedCards(new Set());
    setJsonViewCards(new Set());

    const promises = Array.from(selectedModels).map(async (modelId) => {
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("model", modelId);
        formData.append("prompt", prompt);

        const res = await fetch("/api/extract", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const config = MODELS.find((m) => m.id === modelId)!;
        const cost = calculateCost(
          config,
          data.usage.promptTokens,
          data.usage.completionTokens
        );

        setExtractions((prev) => ({
          ...prev,
          [modelId]: { status: "success", result: { ...data, cost } },
        }));
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setExtractions((prev) => ({
          ...prev,
          [modelId]: { status: "error", error: message },
        }));
      }
    });

    await Promise.allSettled(promises);
  };

  const isExtracting = Object.values(extractions).some(
    (e) => e.status === "loading"
  );
  const completedResults = Object.entries(extractions)
    .filter(([, e]) => e.status === "success" && e.result)
    .map(([id, e]) => ({ modelId: id, ...e.result! }));

  const cheapestCost =
    completedResults.length > 0
      ? Math.min(...completedResults.map((r) => r.cost))
      : 0;
  const fastestDuration =
    completedResults.length > 0
      ? Math.min(...completedResults.map((r) => r.duration))
      : 0;

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <a
            href="https://github.com/crafter-station"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 hover:text-[#F8BC31] transition-colors"
          >
            <CrafterStationLogo className="w-8 h-8" />
          </a>
          <a
            href="https://github.com/crafter-station/meta.playground"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/stars/crafter-station/meta.playground?style=flat&logo=github"
              alt="GitHub stars"
              className="h-6 opacity-70 hover:opacity-100 transition-opacity dark:invert"
            />
          </a>
        </div>
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">
          Metadata Playground
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Upload an image, select AI models, and compare the metadata each one
          extracts — including cost projections at scale.
        </p>
      </header>

      {/* Upload + Models */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
        {/* Upload Zone */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
            Image
          </label>

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center
                h-64 border-2 border-dashed cursor-pointer
                transition-all duration-200
                ${
                  isDragging
                    ? "border-foreground/30 bg-accent"
                    : "border-border hover:border-foreground/20 hover:bg-accent/50"
                }
              `}
            >
              <Upload
                className="w-8 h-8 text-muted-foreground mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm text-muted-foreground">
                Drop an image here or{" "}
                <span className="underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                PNG, JPG, WebP up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          ) : (
            <div className="relative h-64 overflow-hidden border border-border bg-muted">
              <Image
                src={preview}
                alt="Uploaded image"
                fill
                className="object-contain"
                unoptimized
              />
              <button
                onClick={clearFile}
                className="absolute top-3 right-3 p-1.5 bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-3 right-3">
                <div className="px-3 py-1.5 bg-background/80 backdrop-blur-sm border border-border text-xs font-mono text-muted-foreground truncate">
                  {file.name}{" "}
                  <span className="text-muted-foreground/60">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Model Selector */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Models
            </label>
            <button
              onClick={() => {
                if (selectedModels.size === MODELS.length) {
                  setSelectedModels(new Set());
                } else {
                  setSelectedModels(new Set(MODELS.map((m) => m.id)));
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedModels.size === MODELS.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {MODELS.map((model) => {
              const selected = selectedModels.has(model.id);
              const color = PROVIDER_COLORS[model.provider];
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className={`
                    group flex items-start gap-3 p-3 border text-left
                    transition-all duration-150
                    ${
                      selected
                        ? "border-foreground/15 bg-card"
                        : "border-transparent bg-transparent hover:bg-accent/50"
                    }
                  `}
                >
                  <div
                    className={`
                      mt-0.5 w-4 h-4 border flex items-center justify-center flex-shrink-0
                      transition-all duration-150
                      ${
                        selected
                          ? "border-foreground/30 bg-foreground text-background"
                          : "border-border group-hover:border-foreground/20"
                      }
                    `}
                  >
                    {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      {model.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {model.provider}
                      </span>
                      <span className="text-xs text-muted-foreground/50 mx-0.5">
                        ·
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ${model.inputCostPer1MTokens}/
                        {model.outputCostPer1MTokens}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2">
            Cost shown as input/output per 1M tokens (USD)
          </p>
        </div>
      </div>

      {/* Prompt */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prompt
          </label>
          {prompt !== DEFAULT_PROMPT && (
            <button
              onClick={() => setPrompt(DEFAULT_PROMPT)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-y font-mono"
          placeholder="Describe what metadata to extract from the image..."
        />
      </div>

      {/* Extract Button */}
      <div className="mb-12">
        <button
          onClick={extractAll}
          disabled={!file || selectedModels.size === 0 || isExtracting}
          className={`
            w-full py-3 px-6 text-sm font-medium
            transition-all duration-200 flex items-center justify-center gap-2
            ${
              !file || selectedModels.size === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : isExtracting
                  ? "bg-foreground/90 text-background cursor-wait"
                  : "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.99]"
            }
          `}
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Extracting with {selectedModels.size} model
              {selectedModels.size > 1 ? "s" : ""}...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Extract Metadata
              {selectedModels.size > 0 &&
                ` with ${selectedModels.size} model${selectedModels.size > 1 ? "s" : ""}`}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {Object.keys(extractions).length > 0 && (
        <section className="mb-12 animate-fade-in">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Results
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MODELS.filter((m) => extractions[m.id]).map((model) => {
              const state = extractions[model.id];
              const color = PROVIDER_COLORS[model.provider];
              const isExpanded = expandedCards.has(model.id);
              const isJsonView = jsonViewCards.has(model.id);
              const isCheapest =
                state.status === "success" &&
                state.result?.cost === cheapestCost &&
                completedResults.length > 1;
              const isFastest =
                state.status === "success" &&
                state.result?.duration === fastestDuration &&
                completedResults.length > 1;

              return (
                <div
                  key={model.id}
                  className={`
                    border bg-card overflow-hidden
                    transition-all duration-300
                    ${state.status === "success" ? "animate-fade-in" : ""}
                    ${state.status === "error" ? "border-red-500/20" : "border-border"}
                  `}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{model.name}</span>

                    {/* Formatted / JSON tabs */}
                    {state.status === "success" && (
                      <div className="flex items-center gap-0 ml-auto mr-2 border border-border">
                        <button
                          onClick={() => {
                            if (isJsonView) toggleJsonView(model.id);
                          }}
                          className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            !isJsonView
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Formatted
                        </button>
                        <button
                          onClick={() => {
                            if (!isJsonView) toggleJsonView(model.id);
                          }}
                          className={`px-2 py-0.5 text-[10px] font-mono font-medium transition-colors ${
                            isJsonView
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          JSON
                        </button>
                      </div>
                    )}

                    <span className={`text-xs text-muted-foreground font-mono flex items-center ${state.status !== "success" ? "ml-auto" : ""}`}>
                      {state.status === "loading" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {state.status === "success" &&
                        formatDuration(state.result!.duration)}
                      {state.status === "error" && (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      )}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4">
                    {state.status === "loading" && (
                      <div className="space-y-3">
                        <div className="h-4 animate-shimmer" />
                        <div className="h-4 animate-shimmer w-4/5" />
                        <div className="h-3 animate-shimmer w-3/5" />
                        <div className="flex gap-1.5 mt-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-5 w-14 animate-shimmer"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {state.status === "error" && (
                      <div className="text-sm text-red-500/80">
                        <p className="font-medium mb-1">Extraction failed</p>
                        <p className="text-xs font-mono break-all opacity-70">
                          {state.error}
                        </p>
                      </div>
                    )}

                    {state.status === "success" && state.result && !isJsonView && (
                      <div className="space-y-3">
                        {/* Title */}
                        <h3 className="text-sm font-semibold leading-snug">
                          {state.result.metadata.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {state.result.metadata.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {state.result.metadata.tags
                            .slice(0, isExpanded ? undefined : 5)
                            .map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] bg-accent text-accent-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          {!isExpanded &&
                            state.result.metadata.tags.length > 5 && (
                              <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
                                +{state.result.metadata.tags.length - 5}
                              </span>
                            )}
                        </div>

                        {/* Colors */}
                        <div className="flex items-center gap-1.5">
                          {state.result.metadata.colors.map((c, i) => (
                            <div
                              key={i}
                              title={`${c.name} (${c.hex})`}
                            >
                              <div
                                className="w-5 h-5 rounded-full border border-border"
                                style={{ backgroundColor: c.hex }}
                              />
                            </div>
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {state.result.metadata.mood} ·{" "}
                            {state.result.metadata.style}
                          </span>
                        </div>

                        {/* Expressions & Emotions */}
                        {(state.result.metadata.expressions ||
                          state.result.metadata.emotions.length > 0) && (
                          <div className="space-y-1.5 pt-2 border-t border-border">
                            {state.result.metadata.expressions && (
                              <MetaRow label="Expression">
                                {state.result.metadata.expressions}
                              </MetaRow>
                            )}
                            {state.result.metadata.emotions.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {state.result.metadata.emotions.map((e) => (
                                  <span
                                    key={e}
                                    className="px-2 py-0.5 text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                  >
                                    {e}
                                  </span>
                                ))}
                              </div>
                            )}
                            {state.result.metadata.focusLevel && (
                              <MetaRow label="Focus">
                                {state.result.metadata.focusLevel}
                              </MetaRow>
                            )}
                          </div>
                        )}

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="space-y-2 pt-2 border-t border-border animate-fade-in">
                            <MetaRow label="Category">
                              {state.result.metadata.category}
                            </MetaRow>
                            {state.result.metadata.bodyLanguage && (
                              <MetaRow label="Body language">
                                {state.result.metadata.bodyLanguage}
                              </MetaRow>
                            )}
                            <MetaRow label="Objects">
                              {state.result.metadata.objects.join(", ")}
                            </MetaRow>
                            {state.result.metadata.textContent && (
                              <MetaRow label="Text">
                                {state.result.metadata.textContent}
                              </MetaRow>
                            )}
                            <MetaRow label="Alt text">
                              {state.result.metadata.altText}
                            </MetaRow>
                            <MetaRow label="Tokens">
                              {state.result.usage.promptTokens.toLocaleString()}{" "}
                              in /{" "}
                              {state.result.usage.completionTokens.toLocaleString()}{" "}
                              out
                            </MetaRow>
                          </div>
                        )}

                        {/* Toggle */}
                        <button
                          onClick={() => toggleExpanded(model.id)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> More details
                            </>
                          )}
                        </button>

                        {/* Stats Footer */}
                        <div className="flex items-center gap-3 pt-2 border-t border-border text-[10px] font-mono text-muted-foreground">
                          <span
                            className={
                              isFastest
                                ? "text-emerald-600 dark:text-emerald-400"
                                : ""
                            }
                          >
                            {formatDuration(state.result.duration)}
                            {isFastest && " (fastest)"}
                          </span>
                          <span>
                            {state.result.usage.totalTokens.toLocaleString()}{" "}
                            tok
                          </span>
                          <span
                            className={`ml-auto ${
                              isCheapest
                                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                                : ""
                            }`}
                          >
                            {formatCost(state.result.cost)}
                            {isCheapest && " (cheapest)"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* JSON View */}
                    {state.status === "success" && state.result && isJsonView && (
                      <div className="animate-fade-in">
                        <pre className="text-[11px] font-mono leading-relaxed text-card-foreground overflow-x-auto whitespace-pre-wrap break-words">
                          <code>
                            {JSON.stringify(state.result.metadata, null, 2)}
                          </code>
                        </pre>
                        <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border text-[10px] font-mono text-muted-foreground">
                          <span>
                            {formatDuration(state.result.duration)}
                          </span>
                          <span>
                            {state.result.usage.totalTokens.toLocaleString()}{" "}
                            tok
                          </span>
                          <span className="ml-auto">
                            {formatCost(state.result.cost)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cost Projection Table */}
      {completedResults.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cost Projection
            </h2>
          </div>

          <div className="border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Model
                  </th>
                  {VOLUME_TIERS.map((vol) => (
                    <th
                      key={vol}
                      className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {vol === 1 ? "1 img" : `${formatNumber(vol)} imgs`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedResults
                  .sort((a, b) => a.cost - b.cost)
                  .map((result, idx) => {
                    const model = MODELS.find(
                      (m) => m.id === result.modelId
                    )!;
                    const color = PROVIDER_COLORS[model.provider];
                    const isCheapestRow =
                      idx === 0 && completedResults.length > 1;
                    return (
                      <tr
                        key={result.modelId}
                        className={`
                          border-b border-border last:border-0
                          ${isCheapestRow ? "bg-emerald-500/[0.04]" : ""}
                        `}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium text-sm whitespace-nowrap">
                              {model.name}
                            </span>
                            {isCheapestRow && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                cheapest
                              </span>
                            )}
                          </div>
                        </td>
                        {VOLUME_TIERS.map((vol) => (
                          <td
                            key={vol}
                            className="px-4 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap"
                          >
                            {formatCost(result.cost * vol)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">
            Projections based on actual token usage from the extraction above.
            Real costs may vary with image size and content complexity.
          </p>
        </section>
      )}

      {/* Empty State */}
      {Object.keys(extractions).length === 0 && !file && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ImageIcon
            className="w-12 h-12 text-muted-foreground/30 mb-4"
            strokeWidth={1}
          />
          <p className="text-sm text-muted-foreground">
            Upload an image to get started
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 pb-8 text-center">
        <p className="text-[10px] text-muted-foreground/40">
          Built with Vercel AI SDK · Costs are estimates based on published
          pricing
        </p>
      </footer>
    </main>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span className="text-card-foreground">{children}</span>
    </div>
  );
}
