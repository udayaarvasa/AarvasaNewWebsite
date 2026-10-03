"use client";

import { useCallback, useId, useRef, useState } from "react";
import { UploadCloud, FileCheck2, AlertTriangle, Loader2 } from "lucide-react";
import {
  ACCEPTED_MODEL_EXTENSIONS,
  MODEL_LIMITS,
  validateModelBytes,
} from "@/lib/media/model-validation";
import {
  ACCEPTED_PANORAMA_EXTENSIONS,
  PANORAMA_LIMITS,
  validatePanoramaBytes,
} from "@/lib/media/panorama-validation";
import { PROVENANCE_BY_KIND, PROVENANCE_LABEL, type MediaProvenance } from "@/lib/media/provenance";

/** Base64 SHA-256 of the whole file, which the upload intent signs so S3 will
 *  accept only these exact bytes. */
async function sha256Base64(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/**
 * Upload an immersive asset you already have — a 3D model, or a 360° panorama.
 *
 * One component for both, because they differ only in which validator runs and
 * which format is declared: the intent, the signed PUT, the progress and the
 * completion call are identical, and a second copy of that machinery would be a
 * second place for the completion contract to drift.
 *
 * The file is checked here by reading its first bytes, so someone who picks an
 * FBX renamed to .glb — or an ordinary holiday photograph instead of an
 * equirectangular panorama — is told immediately rather than after a long
 * upload. That check is a courtesy, not a control: the same validators run
 * server-side on the bytes that actually arrive, because everything in this
 * component is attacker-controlled.
 *
 * Provenance is asked for rather than guessed. Nothing in the bytes separates a
 * render from a photograph, or a model of this building from a test cube, and
 * what the public is told must not be an inference.
 *
 * Every state shown is real. There is no simulated percentage: the bar reflects
 * XMLHttpRequest's own upload progress, and once bytes are sent the UI says the
 * asset is queued rather than inventing processing stages.
 */

type Kind = "MODEL" | "PANORAMA";

type Phase =
  | { k: "idle" }
  | { k: "rejected"; message: string }
  | { k: "ready"; file: File; note: string; format: string }
  | { k: "requesting" }
  | { k: "uploading"; sent: number; total: number }
  | { k: "queued" }
  | { k: "error"; message: string; detail?: string };

const KINDS: { value: Kind; label: string; hint: string; accept: readonly string[] }[] = [
  {
    value: "MODEL",
    label: "3D model",
    hint: "GLB · GLTF 2.0 · up to 256 MB — FBX and OBJ are not supported",
    accept: ACCEPTED_MODEL_EXTENSIONS,
  },
  {
    value: "PANORAMA",
    label: "360° panorama",
    hint: `JPEG or WebP · equirectangular, exactly 2:1 · ${PANORAMA_LIMITS.minWidth}–${PANORAMA_LIMITS.maxWidth} px wide`,
    accept: ACCEPTED_PANORAMA_EXTENSIONS,
  },
];

const bytes = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function UploadImmersive({
  projects,
}: {
  projects: { slug: string; name: string; location: string }[];
}) {
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");
  const [kind, setKind] = useState<Kind>("MODEL");
  const [provenance, setProvenance] = useState<MediaProvenance>("OFFICIAL_MODEL");
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const statusId = useId();

  const spec = KINDS.find((k) => k.value === kind) ?? KINDS[0];
  const provenanceOptions = PROVENANCE_BY_KIND[kind];

  /** Changing the kind invalidates both the picked file and the provenance. */
  const changeKind = useCallback((next: Kind) => {
    setKind(next);
    setProvenance(PROVENANCE_BY_KIND[next][0]);
    setPhase({ k: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const inspect = useCallback(
    async (file: File) => {
      const max = kind === "MODEL" ? MODEL_LIMITS.maxBytes : PANORAMA_LIMITS.maxBytes;
      if (file.size > max) {
        setPhase({ k: "rejected", message: `That file is larger than ${bytes(max)}.` });
        return;
      }
      // Only the head is needed: format, and for a panorama its dimensions, all
      // live in the container header.
      const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());

      if (kind === "MODEL") {
        const v = validateModelBytes(head, file.size);
        if (!v.ok) {
          setPhase({ k: "rejected", message: v.message });
          return;
        }
        setPhase({ k: "ready", file, note: v.kind, format: "GLB" });
        return;
      }

      const v = validatePanoramaBytes(head, file.size);
      if (!v.ok) {
        setPhase({ k: "rejected", message: v.message });
        return;
      }
      setPhase({
        k: "ready",
        file,
        note: `${v.width} × ${v.height} equirectangular`,
        format: v.kind === "jpeg" ? "EQUIRECT_JPEG" : "EQUIRECT_WEBP",
      });
    },
    [kind],
  );

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
    const { file, format } = phase;
    setPhase({ k: "requesting" });

    let intent: Response;
    try {
      intent = await fetch("/api/media/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "PROJECT",
          projectSlug: slug,
          kind,
          expectedFormat: format,
          filename: file.name,
          sourceSizeBytes: file.size,
          sourceMimeType: file.type || (kind === "MODEL" ? "model/gltf-binary" : "image/jpeg"),
          provenance,
          // S3 signs this and rejects any other bytes, so the object that lands
          // is provably the file that was inspected here.
          sha256: await sha256Base64(file),
        }),
      });
    } catch {
      setPhase({ k: "error", message: "Could not reach the server. Check your connection and try again." });
      return;
    }

    const payload = await intent.json().catch(() => null);
    /* The intent responds { success, data: { mediaAssetId, upload: {...} } }.
       Reading it flat silently produced an undefined URL. */
    const data = payload?.data ?? null;

    if (intent.status === 401) {
      setPhase({ k: "error", message: "Please sign in again." });
      return;
    }
    if (intent.status === 402) {
      setPhase({
        k: "error",
        message: payload?.error ?? "Immersive creation requires an active Media Studio plan.",
      });
      return;
    }
    if (!intent.ok || !data?.upload?.url) {
      /* The most common cause in a non-production environment is that object
         storage is not configured. Saying so beats a generic failure. */
      setPhase({
        k: "error",
        message: typeof payload?.error === "string" ? payload.error : "The upload could not be started.",
        detail:
          "If you are running this locally, object storage is probably not configured in this environment.",
      });
      return;
    }

    // Real progress, from the request itself.
    const xhr = new XMLHttpRequest();
    xhr.open(data.upload.method ?? "PUT", data.upload.url, true);
    for (const [h, val] of Object.entries(
      (data.upload.headers ?? {}) as Record<string, string>,
    )) {
      xhr.setRequestHeader(h, val);
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
      /* Completion is what actually admits the asset to the pipeline.

         The endpoint requires an application/json body — it answers 415 to
         anything else — so the header and the empty object are both part of the
         contract, not decoration. Sending a bare POST left the asset sitting at
         UPLOADED with its bytes already in the ingest bucket and nothing queued. */
      const done = await fetch(`/api/media/${data.mediaAssetId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => null);
      if (!done || !done.ok) {
        /* Say which step failed. The bytes are in storage either way, so
           "upload failed" would send someone back to re-pick the same file. */
        const reason = await done?.json().catch(() => null);
        setPhase({
          k: "error",
          message: "The file uploaded but could not be admitted for processing.",
          detail: typeof reason?.error === "string" ? reason.error : undefined,
        });
        return;
      }
      setPhase({ k: "queued" });
    };
    xhr.send(file);
  }, [phase, slug, kind, provenance]);

  const busy = phase.k === "requesting" || phase.k === "uploading";
  const field =
    "w-full max-w-[460px] rounded-xs border border-rule-firm bg-paper px-3 py-[10px] text-[14px] outline-none focus:border-burgundy focus:shadow-[0_0_0_3px_var(--burgundy-wash)]";

  return (
    <div>
      {/* What kind of asset */}
      <fieldset className="mb-[var(--s-6)]">
        <legend className="av-label mb-2 block text-ink-muted">What are you uploading</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => changeKind(k.value)}
              disabled={busy}
              aria-pressed={kind === k.value}
              className={`av-label rounded-xs border px-3 py-[8px] transition-colors disabled:opacity-50 ${
                kind === k.value
                  ? "border-burgundy bg-burgundy-wash text-burgundy"
                  : "border-rule-firm bg-paper text-ink hover:border-burgundy"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Project */}
      <label htmlFor={`${inputId}-project`} className="av-label mb-2 block text-ink-muted">
        Project
      </label>
      <select
        id={`${inputId}-project`}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        disabled={busy}
        className={field}
      >
        {projects.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name} — {p.location}
          </option>
        ))}
      </select>

      {/* Provenance */}
      <label htmlFor={`${inputId}-provenance`} className="av-label mb-2 mt-[var(--s-5)] block text-ink-muted">
        What this asset is
      </label>
      <select
        id={`${inputId}-provenance`}
        value={provenance}
        onChange={(e) => setProvenance(e.target.value as MediaProvenance)}
        disabled={busy}
        className={field}
      >
        {provenanceOptions.map((p) => (
          <option key={p} value={p}>
            {PROVENANCE_LABEL[p]}
          </option>
        ))}
      </select>
      <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-ink-muted">
        Shown to visitors beside the asset. A reviewer confirms it before anything is
        published, and internal test material is never shown publicly.
      </p>

      {/* File */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-[var(--s-6)] flex flex-col items-center justify-center border border-dashed px-[var(--s-6)] py-[var(--s-10)] text-center transition-colors ${
          dragging ? "border-burgundy bg-burgundy-wash" : "border-rule-firm bg-paper-raised"
        }`}
      >
        <UploadCloud className="h-6 w-6 text-ink-disabled" aria-hidden="true" />
        <p className="mt-3 text-[15px]">Drop {kind === "MODEL" ? "a model" : "a panorama"} here</p>
        <p className="av-meta mt-2 text-ink-disabled">{spec.hint}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={spec.accept.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void inspect(file);
          }}
        />
        <label
          htmlFor={inputId}
          className="av-label mt-[var(--s-5)] cursor-pointer rounded-xs border border-rule-firm bg-paper px-3 py-[8px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
        >
          Choose a file
        </label>
      </div>

      {/* Status. One live region, so a screen reader hears every transition. */}
      <div id={statusId} aria-live="polite" className="mt-[var(--s-5)]">
        {phase.k === "rejected" && (
          <p className="flex items-start gap-2 text-[14px] text-burgundy">
            <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{phase.message}</span>
          </p>
        )}

        {phase.k === "ready" && (
          <div>
            <p className="flex items-center gap-2 text-[14px]">
              <FileCheck2 className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              <span>
                {phase.file.name} · {bytes(phase.file.size)} · {phase.note}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="av-label mt-[var(--s-4)] rounded-xs border border-burgundy bg-burgundy px-4 py-[9px] text-paper transition-opacity hover:opacity-90"
            >
              Upload
            </button>
          </div>
        )}

        {phase.k === "requesting" && (
          <p className="flex items-center gap-2 text-[14px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Authorising the upload…
          </p>
        )}

        {phase.k === "uploading" && (
          <div>
            <p className="text-[14px] text-ink-muted">
              Uploading… {Math.round((phase.sent / Math.max(phase.total, 1)) * 100)}%
            </p>
            <div className="mt-2 h-[3px] w-full max-w-[460px] bg-rule">
              <div
                className="h-full bg-burgundy transition-[width]"
                style={{ width: `${(phase.sent / Math.max(phase.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase.k === "queued" && (
          <p className="max-w-[56ch] text-[14px] leading-relaxed">
            Uploaded and queued for processing. It stays private to your account, and you
            will be able to preview it here once processing finishes.
          </p>
        )}

        {phase.k === "error" && (
          <div className="max-w-[56ch]">
            <p className="flex items-start gap-2 text-[14px] text-burgundy">
              <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{phase.message}</span>
            </p>
            {phase.detail && <p className="mt-2 text-[13px] text-ink-muted">{phase.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
