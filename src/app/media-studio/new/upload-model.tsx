"use client";

import { useCallback, useId, useRef, useState } from "react";
import { UploadCloud, FileCheck2, AlertTriangle, Loader2 } from "lucide-react";
import {
  ACCEPTED_MODEL_EXTENSIONS,
  MODEL_LIMITS,
  validateModelBytes,
} from "@/lib/media/model-validation";

/**
 * Mode A — upload an existing 3D model.
 *
 * The file is checked here by reading its first bytes, so someone who picks an
 * FBX renamed to .glb is told immediately rather than after a long upload. That
 * check is a courtesy, not a control: the same validator runs server-side on
 * the bytes that actually arrive, because everything in this component is
 * attacker-controlled.
 *
 * Every state shown is real. There is no simulated percentage: the bar reflects
 * XMLHttpRequest's own upload progress, and once bytes are sent the UI says the
 * asset is queued rather than inventing processing stages.
 */

type Phase =
  | { k: "idle" }
  | { k: "rejected"; message: string }
  | { k: "ready"; file: File; kind: string }
  | { k: "requesting" }
  | { k: "uploading"; sent: number; total: number }
  | { k: "queued" }
  | { k: "error"; message: string; detail?: string };

export function UploadModel({
  projects,
}: {
  projects: { slug: string; name: string; location: string }[];
}) {
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const statusId = useId();

  const inspect = useCallback(async (file: File) => {
    if (file.size > MODEL_LIMITS.maxBytes) {
      setPhase({ k: "rejected", message: "That model is larger than 256 MB." });
      return;
    }
    // Only the head is needed to identify the format.
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const v = validateModelBytes(head, file.size);
    if (!v.ok) {
      setPhase({ k: "rejected", message: v.message });
      return;
    }
    setPhase({ k: "ready", file, kind: v.kind });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void inspect(file);
    },
    [inspect],
  );

  const start = useCallback(async () => {
    if (phase.k !== "ready" || !slug) return;
    const { file } = phase;
    setPhase({ k: "requesting" });

    let intent: Response;
    try {
      intent = await fetch("/api/media/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "PROJECT",
          projectSlug: slug,
          kind: "MODEL",
          contentType: file.type || "model/gltf-binary",
          sizeBytes: file.size,
          fileName: file.name,
        }),
      });
    } catch {
      setPhase({ k: "error", message: "Could not reach the server. Check your connection and try again." });
      return;
    }

    const data = await intent.json().catch(() => null);

    if (intent.status === 401) {
      setPhase({ k: "error", message: "Please sign in again." });
      return;
    }
    if (intent.status === 402) {
      setPhase({
        k: "error",
        message: data?.error ?? "Immersive creation requires an active Media Studio plan.",
      });
      return;
    }
    if (!intent.ok || !data?.url) {
      /* The most common cause in a non-production environment is that object
         storage is not configured. Saying so beats a generic failure. */
      setPhase({
        k: "error",
        message: data?.error ?? "The upload could not be started.",
        detail:
          "If you are running this locally, object storage is probably not configured in this environment.",
      });
      return;
    }

    // Real progress, from the request itself.
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.url, true);
    if (data.headers) {
      for (const [h, val] of Object.entries(data.headers as Record<string, string>)) {
        xhr.setRequestHeader(h, val);
      }
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPhase({ k: "uploading", sent: e.loaded, total: e.total });
    };
    xhr.onerror = () =>
      setPhase({ k: "error", message: "The upload failed part-way through. Please try again." });
    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        setPhase({ k: "error", message: "Storage rejected the upload. Please try again." });
        return;
      }
      // Completion is what actually admits the asset to the pipeline.
      const done = await fetch(`/api/media/${data.mediaAssetId}/complete`, { method: "POST" }).catch(
        () => null,
      );
      if (!done || !done.ok) {
        setPhase({
          k: "error",
          message: "The file uploaded but could not be admitted for processing.",
        });
        return;
      }
      setPhase({ k: "queued" });
    };
    xhr.send(file);
  }, [phase, slug]);

  const busy = phase.k === "requesting" || phase.k === "uploading";

  return (
    <div>
      {/* Project */}
      <label htmlFor={`${inputId}-project`} className="av-label mb-2 block text-ink-muted">
        Project
      </label>
      <select
        id={`${inputId}-project`}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="w-full max-w-[460px] rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]"
      >
        {projects.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name} — {p.location}
          </option>
        ))}
      </select>

      {/* Drop target. Also a real file input, so it works by keyboard. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "mt-[var(--s-5)] border border-dashed p-[var(--s-8)] text-center transition-colors " +
          (dragging ? "border-burgundy bg-burgundy-wash" : "border-rule-firm bg-paper-raised")
        }
      >
        <UploadCloud className="mx-auto h-7 w-7 text-ink-muted" aria-hidden="true" />
        <p className="mt-3 text-[14px] text-ink">Drop a GLB or glTF here</p>
        <p className="av-meta mt-1 text-ink-disabled">
          GLB · glTF 2.0 · up to 256 MB — FBX and OBJ are not supported
        </p>

        <label
          htmlFor={inputId}
          className="av-label mt-[var(--s-5)] inline-block cursor-pointer rounded-xs border border-rule-firm bg-paper px-3 py-[8px] text-ink transition-colors hover:border-burgundy hover:text-burgundy focus-within:border-burgundy"
        >
          Choose a file
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_MODEL_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void inspect(f);
          }}
        />
      </div>

      {/* One live region for every state, so a screen reader hears each change. */}
      <div id={statusId} role="status" aria-live="polite" className="mt-[var(--s-5)]">
        {phase.k === "rejected" && (
          <p className="flex items-start gap-2 text-[14px] text-burgundy">
            <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
            {phase.message}
          </p>
        )}

        {phase.k === "ready" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-[14px] text-ink">
              <FileCheck2 className="h-4 w-4 text-gold-ink" aria-hidden="true" />
              {phase.file.name} · {(phase.file.size / 1_048_576).toFixed(1)} MB · {phase.kind}
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="av-label rounded-xs border border-burgundy bg-burgundy px-3 py-[8px] text-white transition-colors hover:bg-burgundy/90"
            >
              Upload
            </button>
          </div>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-[14px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {phase.k === "requesting"
              ? "Authorising the upload…"
              : `Uploading — ${Math.round((phase.sent / Math.max(phase.total, 1)) * 100)}%`}
          </p>
        )}

        {phase.k === "queued" && (
          <p className="text-[14px] text-ink">
            Uploaded and queued for processing. It stays private to your account, and you will be
            able to preview it here once processing finishes.
          </p>
        )}

        {phase.k === "error" && (
          <div className="text-[14px] text-burgundy">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
              {phase.message}
            </p>
            {phase.detail && <p className="mt-2 text-[13px] text-ink-muted">{phase.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
