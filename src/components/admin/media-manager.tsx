"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Eye, FileUp, Loader2, RefreshCw, XCircle } from "lucide-react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MEDIA_FORMAT_SPECS, type MediaAssetFormat } from "../../../shared/media-asset"
import {
  AdminUploadError,
  apiErrorMessage,
  checkUploadFile,
  runAdminUpload,
  type UploadStage,
  type UploadTarget,
  type UploadTransport,
} from "@/lib/media/admin-upload-client"

/**
 * Admin immersive-media management (Phase 5): upload, processing status, review,
 * secure preview, approve/publish and reject. Files go straight from the browser to
 * S3 through a presigned URL; this component never sees credentials, bucket names
 * or storage keys, and every decision is made and re-checked server-side.
 */

type Status = "UPLOADED" | "PROCESSING" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "FAILED" | "ARCHIVED"

interface MediaItem {
  id: string
  subject: { type: "PROPERTY"; propertyId: string; title: string | null } | { type: "PROJECT"; projectSlug: string }
  kind: string
  format: string | null
  status: Status
  title: string | null
  altText: string | null
  source: { sizeBytes: number; mimeType: string }
  processed: {
    sizeBytes: number | null
    mimeType: string | null
    fileCount: number | null
    dimensions: { entry: { width: number; height: number } | null; poster: { width: number; height: number } | null } | null
    metrics: Record<string, unknown> | null
    hasPoster: boolean
  } | null
  processorVersion: string | null
  processingAttempts: number
  failure: { code: string; message: string; diagnostic: string | null } | null
  rejectionReason: string | null
  uploadedBy: { id: string; name: string | null; email: string | null } | null
  reviewedAt: string | null
  publishedAt: string | null
  createdAt: string
}

interface Subjects {
  properties: Array<{ id: string; title: string; city: string }>
  projects: Array<{ slug: string; name: string; published: boolean }>
}

interface Preview {
  entry: { url: string; mimeType: string | null; sizeBytes: number | null }
  poster: { url: string } | null
  expiresAt: string
}

const FORMAT_LABELS: Record<MediaAssetFormat, string> = {
  GLB: "3D model (.glb)",
  EQUIRECT_JPEG: "360° panorama (.jpg)",
  EQUIRECT_WEBP: "360° panorama (.webp)",
  SOG: "Gaussian splat bundle (.sog)",
  MP4: "Tour film (.mp4)",
}

const STATUS_STYLES: Record<Status, string> = {
  UPLOADED: "bg-gray-100 text-gray-600",
  PROCESSING: "bg-blue-100 text-blue-700",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
}

const FILTERS: Array<{ id: Status | "ALL"; label: string }> = [
  { id: "PENDING_REVIEW", label: "Awaiting review" },
  { id: "PROCESSING", label: "Processing" },
  { id: "FAILED", label: "Failed" },
  { id: "PUBLISHED", label: "Published" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
]

const STAGE_LABELS: Record<UploadStage, string> = {
  hashing: "Checking file…",
  authorizing: "Authorising upload…",
  uploading: "Uploading to storage…",
  completing: "Verifying upload…",
  done: "Uploaded. Processing…",
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—"
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} kB`
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/** Browser implementations of the upload ports: same-origin JSON, XHR for upload progress. */
const browserTransport: UploadTransport = {
  async fetchJson(url, init) {
    const res = await fetch(url, { method: init.method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) })
    return { status: res.status, body: await readJson(res) }
  },
  put(url, headers, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", url)
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
      xhr.upload.onprogress = (e) => onProgress(e.loaded, e.total)
      xhr.onload = () => resolve({ status: xhr.status })
      xhr.onerror = () => reject(new AdminUploadError("The upload was interrupted. Please try again.", "uploading"))
      xhr.send(file as unknown as Blob)
    })
  },
  digestSha256: (data) => crypto.subtle.digest("SHA-256", data),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

function subjectLabel(item: MediaItem, subjects: Subjects | null) {
  if (item.subject.type === "PROPERTY") return item.subject.title ?? "Property"
  const slug = item.subject.projectSlug
  return subjects?.projects.find((p) => p.slug === slug)?.name ?? slug
}

export function MediaManager() {
  const [subjects, setSubjects] = useState<Subjects | null>(null)
  const [filter, setFilter] = useState<Status | "ALL">("PENDING_REVIEW")
  const [reloadToken, setReloadToken] = useState(0)
  const [list, setList] = useState<{ filter: Status | "ALL"; token: number; items: MediaItem[]; error: string | null } | null>(null)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const loadList = useCallback(() => setReloadToken((t) => t + 1), [])
  const listLoading = !list || list.filter !== filter || list.token !== reloadToken
  const items = list?.items ?? []
  const listError = listLoading ? null : list?.error ?? null

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let next: { items: MediaItem[]; error: string | null }
      try {
        const res = await fetch(`/api/admin/media?limit=100${filter === "ALL" ? "" : `&status=${filter}`}`, { cache: "no-store" })
        const body = (await readJson(res)) as { success?: boolean; data?: MediaItem[] } | null
        next = res.ok && body?.success ? { items: body.data ?? [], error: null } : { items: [], error: apiErrorMessage(body, "Could not load media.") }
      } catch {
        next = { items: [], error: "Could not load media." }
      }
      if (!cancelled) setList({ filter, token: reloadToken, ...next })
    })()
    return () => {
      cancelled = true
    }
  }, [filter, reloadToken])

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/media/subjects", { cache: "no-store" })
      const body = (await readJson(res)) as { success?: boolean; data?: Subjects } | null
      if (res.ok && body?.success && body.data) setSubjects(body.data)
      else toast.error("Could not load properties and projects")
    })()
  }, [])

  const refreshItem = useCallback(async (id: string): Promise<MediaItem | null> => {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(id)}`, { cache: "no-store" })
    const body = (await readJson(res)) as { success?: boolean; data?: MediaItem } | null
    if (!res.ok || !body?.success || !body.data) return null
    setList((prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === id ? body.data! : i)) } : prev))
    setSelected((prev) => (prev?.id === id ? body.data! : prev))
    return body.data
  }, [])

  return (
    <div className="space-y-8">
      <UploadPanel subjects={subjects} onUploaded={(id) => { loadList(); void refreshItem(id) }} refreshItem={refreshItem} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl border border-[#DCCDCE]/40 bg-white p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === f.id ? "bg-[#50080E] text-white" : "text-[#72383D]/60 hover:bg-[#F5F4F1] hover:text-[#50080E]"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadList}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Card className="overflow-hidden border-[#DCCDCE]/40 bg-white">
            {listLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /></div>
            ) : listError ? (
              <div className="flex flex-col items-center gap-3 py-12 text-sm text-red-700">
                <p>{listError}</p>
                <Button variant="outline" size="sm" onClick={loadList}>Try again</Button>
              </div>
            ) : items.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#72383D]/60">No media in this list.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#DCCDCE]/30 bg-[#F5F4F1]">
                    <tr>
                      {["Media", "Attached to", "Status", "Size", "Uploaded"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCCDCE]/20">
                    {items.map((item) => (
                      <tr key={item.id} onClick={() => setSelected(item)} className={`cursor-pointer transition hover:bg-[#F5F4F1]/60 ${selected?.id === item.id ? "bg-[#F5F4F1]" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#50080E] line-clamp-1">{item.title ?? item.format ?? item.kind}</p>
                          <p className="text-xs text-[#72383D]/50">{item.kind}{item.format ? ` · ${item.format}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-[#72383D]">{subjectLabel(item, subjects)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[item.status]}`}>{item.status.replace("_", " ")}</span></td>
                        <td className="px-4 py-3 text-[#72383D]/70">{formatBytes(item.processed?.sizeBytes ?? item.source.sizeBytes)}</td>
                        <td className="px-4 py-3 text-xs text-[#72383D]/60">{new Date(item.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selected ? (
            <ReviewPanel key={selected.id} item={selected} subjects={subjects} onChanged={async () => { await refreshItem(selected.id); loadList() }} />
          ) : (
            <Card className="flex items-center justify-center border-[#DCCDCE]/40 bg-white p-8 text-sm text-[#72383D]/60">Select media to see details.</Card>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadPanel({ subjects, onUploaded, refreshItem }: { subjects: Subjects | null; onUploaded: (id: string) => void; refreshItem: (id: string) => Promise<MediaItem | null> }) {
  const [subjectType, setSubjectType] = useState<"PROPERTY" | "PROJECT">("PROPERTY")
  const [subjectId, setSubjectId] = useState("")
  const [format, setFormat] = useState<MediaAssetFormat>("GLB")
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [altText, setAltText] = useState("")
  const [stage, setStage] = useState<UploadStage | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<{ id: string; status: string; message: string | null } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = stage !== null && stage !== "done"
  const fileProblem = file ? checkUploadFile(format, file) : null
  const accept = MEDIA_FORMAT_SPECS[format].filenameExtensions.map((e) => `.${e}`).join(",")

  // Follow the new asset until processing settles (or ten minutes pass).
  useEffect(() => {
    if (!tracking || !["UPLOADED", "PROCESSING"].includes(tracking.status)) return
    let cancelled = false
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > 10 * 60_000) return clearInterval(timer)
      const item = await refreshItem(tracking.id)
      if (!cancelled && item) setTracking({ id: item.id, status: item.status, message: item.failure?.message ?? null })
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [tracking, refreshItem])

  const submit = async () => {
    setError(null)
    if (!subjectId) return setError(`Choose a ${subjectType === "PROPERTY" ? "property" : "project"}.`)
    if (!file) return setError("Choose a file.")
    if (fileProblem) return setError(fileProblem)
    const target: UploadTarget = subjectType === "PROPERTY" ? { subjectType, propertyId: subjectId } : { subjectType, projectSlug: subjectId }
    try {
      const result = await runAdminUpload({ target, format, file, title, altText }, browserTransport, (s, p) => {
        setStage(s)
        if (p !== undefined) setProgress(p)
      })
      toast.success("Uploaded and verified. Processing has started.")
      setTracking({ id: result.mediaAssetId, status: result.status, message: null })
      setFile(null)
      if (fileInput.current) fileInput.current.value = ""
      onUploaded(result.mediaAssetId)
    } catch (e) {
      setStage(null)
      setError(e instanceof AdminUploadError ? e.message : "The upload failed. Please try again.")
    }
  }

  const field = "w-full rounded-xl border border-[#DCCDCE]/60 bg-white px-3 py-2.5 text-sm text-[#50080E] focus:border-[#D4AF37] focus:outline-none"
  return (
    <Card className="border-[#DCCDCE]/40 bg-white p-6">
      <div className="flex items-center gap-2">
        <FileUp className="h-5 w-5 text-[#D4AF37]" />
        <h2 className="text-lg font-bold text-[#50080E]">Upload immersive media</h2>
      </div>
      <p className="mt-1 text-xs text-[#72383D]/60">Files upload directly to private storage, are verified and processed, and stay unpublished until approved below.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-[#72383D]">
          Attach to
          <div className="flex gap-2">
            <select className={field} value={subjectType} disabled={busy} onChange={(e) => { setSubjectType(e.target.value as "PROPERTY" | "PROJECT"); setSubjectId("") }}>
              <option value="PROPERTY">Property</option>
              <option value="PROJECT">Project</option>
            </select>
            <select className={field} value={subjectId} disabled={busy || !subjects} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">{subjects ? "Choose…" : "Loading…"}</option>
              {subjectType === "PROPERTY"
                ? subjects?.properties.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.city}</option>)
                : subjects?.projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.published ? "" : " (unpublished)"}</option>)}
            </select>
          </div>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[#72383D]">
          Media type
          <select className={field} value={format} disabled={busy} onChange={(e) => { setFormat(e.target.value as MediaAssetFormat); setFile(null); if (fileInput.current) fileInput.current.value = "" }}>
            {(Object.keys(FORMAT_LABELS) as MediaAssetFormat[]).map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[#72383D]">
          File
          <input ref={fileInput} type="file" accept={accept} disabled={busy} className={field} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {fileProblem && <span className="block font-normal text-red-700">{fileProblem}</span>}
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[#72383D]">
          Title (optional)
          <input className={field} value={title} maxLength={150} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-[#72383D] md:col-span-2">
          Alt text (required before publishing)
          <input className={field} value={altText} maxLength={500} disabled={busy} onChange={(e) => setAltText(e.target.value)} placeholder="Describe what the model or panorama shows" />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" /> {error}</p>
      )}
      {stage && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-semibold text-[#72383D]">{STAGE_LABELS[stage]}{stage === "uploading" ? ` ${Math.round(progress * 100)}%` : ""}</p>
          <div className="h-2 overflow-hidden rounded-full bg-[#F5F4F1]">
            <div className="h-full bg-[#D4AF37] transition-all" style={{ width: `${stage === "uploading" ? Math.round(progress * 100) : stage === "done" || stage === "completing" ? 100 : 5}%` }} />
          </div>
        </div>
      )}
      {tracking && (
        <p className="mt-3 text-xs text-[#72383D]">
          Latest upload: <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[tracking.status as Status] ?? STATUS_STYLES.UPLOADED}`}>{tracking.status.replace("_", " ")}</span>
          {tracking.message ? ` — ${tracking.message}` : tracking.status === "PENDING_REVIEW" ? " — ready for review below." : ""}
        </p>
      )}

      <div className="mt-5">
        <Button onClick={() => void submit()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload
        </Button>
      </div>
    </Card>
  )
}

function ReviewPanel({ item, subjects, onChanged }: { item: MediaItem; subjects: Subjects | null; onChanged: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [altText, setAltText] = useState(item.altText ?? "")
  const [reason, setReason] = useState("")
  const [acting, setActing] = useState<"approve" | "reject" | null>(null)
  const warnings = typeof item.processed?.metrics?.["validation.warnings"] === "string" ? String(item.processed.metrics["validation.warnings"]).split(",") : []

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(item.id)}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return { ok: res.ok, body: await readJson(res) }
  }

  const loadPreview = async () => {
    setPreviewLoading(true)
    const res = await post("preview", {})
    setPreviewLoading(false)
    if (res.ok) setPreview((res.body as { data: Preview }).data)
    else toast.error(apiErrorMessage(res.body, "Preview is not available."))
  }

  const decide = async (action: "approve" | "reject") => {
    setActing(action)
    const res = await post(action, action === "approve" ? (altText.trim() ? { altText: altText.trim() } : {}) : { reason: reason.trim() })
    setActing(null)
    if (res.ok) toast.success(action === "approve" ? "Published" : "Rejected")
    else toast.error(apiErrorMessage(res.body, "Something went wrong."))
    await onChanged()
  }

  const row = (label: string, value: string | null | undefined) => (
    <div className="flex justify-between gap-4 py-1.5 text-xs"><span className="text-[#72383D]/60">{label}</span><span className="text-right font-medium text-[#50080E]">{value || "—"}</span></div>
  )
  const dims = item.processed?.dimensions?.entry
  return (
    <Card className="space-y-4 border-[#DCCDCE]/40 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#50080E]">{item.title ?? item.format ?? item.kind}</h3>
          <p className="text-xs text-[#72383D]/60">{subjectLabel(item, subjects)}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[item.status]}`}>{item.status.replace("_", " ")}</span>
      </div>

      <div className="divide-y divide-[#DCCDCE]/20">
        {row("Type", `${item.kind}${item.format ? ` · ${item.format}` : ""}`)}
        {row("Size", formatBytes(item.processed?.sizeBytes ?? item.source.sizeBytes))}
        {row("Dimensions", dims ? `${dims.width} × ${dims.height}` : null)}
        {row("Files", item.processed?.fileCount ? `${item.processed.fileCount}${item.processed.hasPoster ? " (with poster)" : ""}` : null)}
        {row("Uploaded", `${new Date(item.createdAt).toLocaleString()}${item.uploadedBy ? ` by ${item.uploadedBy.name ?? item.uploadedBy.email ?? "unknown"}` : ""}`)}
        {row("Processor", item.processorVersion)}
        {row("Processing attempts", String(item.processingAttempts))}
        {item.reviewedAt && row("Reviewed", new Date(item.reviewedAt).toLocaleString())}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">Validation warnings</p>
          <p>{warnings.join(", ")}</p>
        </div>
      )}
      {item.failure && (
        <div className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">{item.failure.message}</p>
          <p className="text-red-700/80">Code: {item.failure.code}</p>
          {item.failure.diagnostic && <details><summary className="cursor-pointer">Internal diagnostic (admins only)</summary><p className="mt-1 break-words">{item.failure.diagnostic}</p></details>}
        </div>
      )}
      {item.rejectionReason && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Rejected: {item.rejectionReason}</p>}

      {item.status === "PENDING_REVIEW" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => void loadPreview()} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Secure preview
            </Button>
            {preview && (
              <div className="space-y-2 rounded-lg border border-[#DCCDCE]/40 p-3">
                {preview.poster && (
                  // Short-lived presigned URL to a private review copy; next/image would proxy and cache it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.poster.url} alt="Poster preview" className="w-full rounded-md" referrerPolicy="no-referrer" />
                )}
                <a href={preview.entry.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-xs font-semibold text-[#50080E] underline">
                  Open processed file ({formatBytes(preview.entry.sizeBytes)})
                </a>
                <p className="text-[10px] text-[#72383D]/50">Private link, expires {new Date(preview.expiresAt).toLocaleTimeString()}.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-semibold text-[#72383D]">
              Alt text
              <input className="w-full rounded-xl border border-[#DCCDCE]/60 px-3 py-2 text-sm" maxLength={500} value={altText} onChange={(e) => setAltText(e.target.value)} />
            </label>
            <Button size="sm" onClick={() => void decide("approve")} disabled={acting !== null || !altText.trim()}>
              {acting === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve and publish
            </Button>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-xs font-semibold text-[#72383D]">
              Rejection reason
              <textarea className="w-full rounded-xl border border-[#DCCDCE]/60 px-3 py-2 text-sm" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <Button variant="outline" size="sm" onClick={() => void decide("reject")} disabled={acting !== null || reason.trim().length < 3}>
              {acting === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Reject
            </Button>
          </div>
        </div>
      )}
      {item.status === "PUBLISHED" && (
        <Button variant="outline" size="sm" onClick={() => void decide("approve")} disabled={acting !== null}>
          <RefreshCw className="h-3.5 w-3.5" /> Re-run publication
        </Button>
      )}
    </Card>
  )
}
