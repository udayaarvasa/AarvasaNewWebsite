"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { ResolvedTourScene } from "@/lib/immersive-tours";

/**
 * Immersive Tour: the developer's own films, cut into the spaces they show.
 *
 * Presented as a film with a chapter index — the way an architect would walk a
 * client through a building — rather than as a grid of clips. One frame, one
 * film at a time; choosing a space seeks to where that space is, and the index
 * follows the film as it plays.
 *
 * These are flat, portrait films. Nothing here offers to look around: a phone
 * clip covers what its camera pointed at and no more, and the interface does
 * not pretend otherwise.
 *
 * Nothing downloads until the visitor presses play or picks a space.
 */

type Phase = "idle" | "loading" | "playing" | "paused" | "error";

const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function ImmersiveTour({ scenes, projectName }: { scenes: readonly ResolvedTourScene[]; projectName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** The scene whose film is loaded, and where to seek once it is. */
  const [filmRef, setFilmRef] = useState(scenes[0]?.video.ref ?? "");
  const pendingSeek = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Sound on: nothing plays until the visitor asks it to, so there is no
  // autoplay to keep quiet.
  const [muted, setMuted] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const film = useMemo(() => scenes.find((s) => s.video.ref === filmRef)?.video ?? scenes[0]?.video, [scenes, filmRef]);
  const filmScenes = useMemo(() => scenes.filter((s) => s.video.ref === film?.ref), [scenes, film]);

  /* The chapter the film is in: the last space on this film whose start has
     passed. The index follows the film rather than the last click. */
  const active = useMemo(() => {
    let current: ResolvedTourScene | undefined = filmScenes[0];
    for (const s of filmScenes) if (s.startSeconds <= time + 0.05) current = s;
    return current;
  }, [filmScenes, time]);

  /* React sets `muted` on mount but does not reliably update the property after,
     so the toggle would silently do nothing. Set it directly. */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, filmRef]);

  useEffect(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    const webkit = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    setCanFullscreen(Boolean(frame?.requestFullscreen || webkit?.webkitEnterFullscreen));
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.preload === "none") video.preload = "auto";
      setPhase((p) => (p === "playing" ? p : "loading"));
      await video.play();
    } catch {
      // A rejected play() is usually an autoplay policy, not a broken film.
      setPhase((p) => (p === "error" ? p : "paused"));
    }
  }, []);

  const goTo = useCallback(
    (scene: ResolvedTourScene) => {
      const video = videoRef.current;
      if (!video) return;
      if (scene.video.ref !== film?.ref) {
        // A different film: load it, then seek once its metadata is in.
        pendingSeek.current = scene.startSeconds;
        setFilmRef(scene.video.ref);
        setTime(scene.startSeconds);
        setPhase("loading");
        return;
      }
      video.currentTime = scene.startSeconds;
      setTime(scene.startSeconds);
      void play();
    },
    [film, play],
  );

  // A new film was chosen: the <video> remounts on its src, so start it here.
  useEffect(() => {
    if (pendingSeek.current === null) return;
    const video = videoRef.current;
    if (!video) return;
    video.preload = "auto";
    video.load();
  }, [filmRef]);

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    if (pendingSeek.current !== null) {
      video.currentTime = pendingSeek.current;
      pendingSeek.current = null;
      void play();
    }
  };

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void play();
    else video.pause();
  };

  const fullscreen = () => {
    const frame = frameRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (frame?.requestFullscreen) void frame.requestFullscreen().catch(() => {});
    else video?.webkitEnterFullscreen?.();
  };

  if (!film) return null;
  const aspect = film.width / film.height;

  return (
    <div className="grid gap-[var(--s-6)] md:grid-cols-[minmax(0,auto)_minmax(0,1fr)] md:items-start">
      {/* The frame: sized from the film itself, so a portrait film is portrait. */}
      <figure className="mx-auto w-full max-w-[340px] md:mx-0 md:w-[300px]">
        <div
          ref={frameRef}
          className="relative w-full overflow-hidden border border-rule-firm bg-stage"
          style={{ aspectRatio: String(aspect) }}
        >
          <video
            key={film.ref}
            ref={videoRef}
            src={film.url}
            poster={film.posterUrl ?? undefined}
            preload="none"
            playsInline
            aria-label={`${projectName}: ${film.altText}`}
            className="absolute inset-0 h-full w-full object-cover"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlaying={() => setPhase("playing")}
            onPause={() => setPhase((p) => (p === "error" ? p : "paused"))}
            onWaiting={() => setPhase("loading")}
            onEnded={() => setPhase("paused")}
            onError={() => setPhase("error")}
            onClick={toggle}
          />

          {phase === "idle" && (
            <button
              type="button"
              onClick={() => void play()}
              className="absolute inset-0 flex items-center justify-center bg-black/25 text-paper transition-colors hover:bg-black/35"
              aria-label={`Play the ${projectName} tour`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-paper/70 bg-black/30">
                <Play className="ml-0.5 h-6 w-6" aria-hidden="true" />
              </span>
            </button>
          )}
          {phase === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-paper">
              <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            </div>
          )}
          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stage px-5 text-center text-stage-muted">
              <p className="text-[14px]">This film could not be played.</p>
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  videoRef.current?.load();
                }}
                className="av-label inline-flex items-center gap-1.5 border border-rule-firm/60 px-3 py-1.5 text-[11px] text-stage-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
              </button>
            </div>
          )}
        </div>

        {/* Controls, outside the frame so nothing sits over the architecture. */}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={phase === "playing" ? "Pause" : "Play"}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-rule-firm/60 text-stage-ink"
          >
            {phase === "playing" ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const video = videoRef.current;
              const t = Number(e.target.value);
              if (video) video.currentTime = t;
              setTime(t);
            }}
            disabled={!duration}
            aria-label="Seek"
            aria-valuetext={`${clock(time)} of ${clock(duration)}`}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-burgundy disabled:cursor-default disabled:opacity-40"
          />
          <span className="av-num shrink-0 text-[11px] text-stage-muted">
            {clock(time)} / {clock(duration)}
          </span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            /* A stable name with a pressed state, rather than a name that
               changes as well: "Unmute, not pressed" contradicts itself. */
            aria-label="Mute"
            aria-pressed={muted}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-rule-firm/60 text-stage-ink"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={fullscreen}
              aria-label="Full screen"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-rule-firm/60 text-stage-ink"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* What the film is, stated every time. Never softened. */}
        <figcaption className="mt-3 text-[12px] leading-relaxed text-stage-muted">
          <span className="av-label text-[10px] text-stage-ink">{film.provenanceLabel}</span>
          {film.provenanceNote && <span className="mt-1 block opacity-80">{film.provenanceNote}</span>}
        </figcaption>
      </figure>

      {/* The index of spaces. Numbered, because a tour has an order. */}
      <nav aria-label={`Spaces in the ${projectName} tour`}>
        <ol className="divide-y divide-rule-firm/30 border-y border-rule-firm/30">
          {scenes.map((scene) => {
            const isActive = scene.ref === active?.ref && scene.video.ref === film.ref && phase !== "idle";
            return (
              <li key={scene.ref}>
                <button
                  type="button"
                  onClick={() => goTo(scene)}
                  aria-current={isActive ? "true" : undefined}
                  className={[
                    "grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-[10px] text-left transition-colors",
                    isActive ? "text-stage-ink" : "text-stage-muted hover:text-stage-ink",
                  ].join(" ")}
                >
                  <span className={["av-num text-[12px]", isActive ? "text-gold" : ""].join(" ")}>
                    {String(scene.order).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-snug">{scene.title}</span>
                    {scene.description && (
                      <span className="mt-0.5 block text-[12px] leading-relaxed opacity-75">{scene.description}</span>
                    )}
                  </span>
                  <span className="av-label shrink-0 text-[10px] opacity-70">{scene.categoryLabel}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
