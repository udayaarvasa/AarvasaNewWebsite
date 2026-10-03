import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Project, ProjectPanoramaTour } from "../../../src/lib/project-types";
import { projects, getProject } from "../../../src/lib/projects";
import { sanitizeViewerEvent, trackViewerEvent, VIEWER_EVENT_TYPE, type ViewerEvent } from "../../../src/lib/viewer/analytics";
import { projectViewerConfig } from "../../../src/lib/viewer/project-media";
import { projectTourConfig, tourMediaAssetIds } from "../../../src/lib/viewer/project-tour";
import { PUBLISHED_PANORAMA_SELECT, publishedPanoramaQuery, toPublishedPanoramas } from "../../../src/lib/viewer/published-panoramas";

const CDN = "https://cdn.media.test";
const SLUG = "demo-tower";
const ID_A = "cmpanoa0000001";
const ID_B = "cmpanob0000002";

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: "PUBLISHED",
  kind: "PANORAMA",
  subjectType: "PROJECT",
  projectSlug: SLUG,
  storageKey: `m/${id}/3f9a1c2b7d4e8f60`,
  entryFile: "panorama.jpg",
  provenance: "PHOTO_360",
  altText: `Reviewed panorama ${id}`,
  viewDefaults: { yawDeg: 30, pitchDeg: 0, fovDeg: 70 },
  ...extra,
});

const tourOf = (review: ProjectPanoramaTour["review"], images: ProjectPanoramaTour["scenes"][number]["image"][]): Pick<Project, "name" | "tour"> => ({
  name: "Demo Tower",
  tour: {
    label: "Demo Tower 360° tour",
    review,
    startSceneId: "s0",
    scenes: images.map((image, i) => ({
      id: `s${i}`,
      title: `Scene ${i}`,
      image,
      hotspots: images.length > 1 ? [{ id: "next", label: "Next", yawDeg: 90, pitchDeg: 0, type: "navigation" as const, targetSceneId: `s${(i + 1) % images.length}` }] : [],
    })),
  },
});

describe("publication gating: published panorama lookup", () => {
  it("queries only PUBLISHED panoramas of this project, by the ids the tour names", () => {
    const q = publishedPanoramaQuery(SLUG, [ID_A, ID_B]);
    assert.deepEqual(q.where, {
      id: { in: [ID_A, ID_B] },
      status: "PUBLISHED",
      kind: "PANORAMA",
      subjectType: "PROJECT",
      projectSlug: SLUG,
      // Engineering panoramas are excluded by the query, not filtered after it.
      provenance: { not: "INTERNAL_TEST" },
    });
  });

  it("never selects private columns", () => {
    const selected = Object.keys(PUBLISHED_PANORAMA_SELECT);
    for (const forbidden of ["sourceKey", "sourceChecksumSha256", "processingError", "failureCode", "reviewedById", "uploadedById", "rejectionReason", "processingLeaseExpiresAt"]) {
      assert.ok(!selected.includes(forbidden), forbidden);
    }
  });

  for (const status of ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "REJECTED", "FAILED", "ARCHIVED"]) {
    it(`drops a ${status} asset even if a query returned it`, () => {
      assert.equal(toPublishedPanoramas([row(ID_A, { status })], SLUG).size, 0);
    });
  }

  it("drops rows of another project, of another kind, or that break the storage contract", () => {
    const bad = [
      row(ID_A, { projectSlug: "other-project" }),
      row(ID_A, { kind: "MODEL", entryFile: "scene.glb" }),
      row(ID_A, { storageKey: `review/${ID_A}/3f9a1c2b7d4e8f60` }),
      row(ID_A, { storageKey: `m/${ID_B}/3f9a1c2b7d4e8f60` }),
      row(ID_A, { entryFile: "../../review/x.jpg" }),
      row(ID_A, { entryFile: "panorama.svg" }),
      row(ID_A, { altText: " " }),
      // A test grid is not a room in this building, whatever its status says.
      row(ID_A, { provenance: "INTERNAL_TEST" }),
      row(ID_A, { provenance: undefined }),
    ];
    assert.equal(toPublishedPanoramas(bad, SLUG).size, 0);
  });

  it("keeps a published panorama with public fields only", () => {
    const map = toPublishedPanoramas([row(ID_A, { sourceKey: `uploads/${ID_A}/u/source.jpg`, processingError: "boom" })], SLUG);
    assert.deepEqual(map.get(ID_A), { id: ID_A, entryKey: `m/${ID_A}/3f9a1c2b7d4e8f60/panorama.jpg`, altText: `Reviewed panorama ${ID_A}`, initialView: { yawDeg: 30, pitchDeg: 0, fovDeg: 70 } });
  });
});

describe("publication gating: project tour mapping", () => {
  const dev = { nodeEnv: "development", cdnOrigin: CDN };
  const prod = { nodeEnv: "production", cdnOrigin: CDN };
  const published = toPublishedPanoramas([row(ID_A)], SLUG);

  it("builds viewer URLs from published keys and the build's CDN origin only", () => {
    const { tour } = projectTourConfig(tourOf("approved", [{ source: "published", mediaAssetId: ID_A }]), published, dev);
    assert.equal(tour?.scenes[0].imageUrl, `${CDN}/m/${ID_A}/3f9a1c2b7d4e8f60/panorama.jpg`);
    assert.equal(tour?.scenes[0].alt, `Reviewed panorama ${ID_A}`);
    assert.deepEqual(tour?.scenes[0].initialView, { yawDeg: 30, pitchDeg: 0, fovDeg: 70 });
    assert.equal(tour?.placeholder, false);
  });

  it("drops a scene whose asset is not published, and the hotspots leading to it", () => {
    const { tour, problems } = projectTourConfig(
      tourOf("approved", [{ source: "published", mediaAssetId: ID_A }, { source: "published", mediaAssetId: ID_B }]),
      published,
      dev,
    );
    assert.deepEqual(tour?.scenes.map((s) => s.id), ["s0"]);
    assert.deepEqual(tour?.scenes[0].hotspots, []);
    assert.ok(problems.some((p) => p.includes("not a published panorama")));
  });

  it("shows nothing when no scene is published", () => {
    assert.equal(projectTourConfig(tourOf("approved", [{ source: "published", mediaAssetId: ID_B }]), published, dev).tour, null);
  });

  it("never shows placeholder tours or test fixtures in production", () => {
    assert.equal(projectTourConfig(tourOf("placeholder", [{ source: "fixture", fixture: "test-room-a" }]), published, prod).tour, null);
    assert.equal(projectTourConfig(tourOf("approved", [{ source: "fixture", fixture: "test-room-a" }]), published, prod).tour, null);
  });

  it("shows nothing from the CDN in production until a production media origin exists", () => {
    assert.equal(projectTourConfig(tourOf("approved", [{ source: "published", mediaAssetId: ID_A }]), published, prod).tour, null);
  });

  it("serves labelled test fixtures in development, and refuses unknown fixtures", () => {
    const { tour } = projectTourConfig(tourOf("placeholder", [{ source: "fixture", fixture: "test-room-a" }, { source: "fixture", fixture: "../../etc/passwd" }]), published, dev);
    assert.deepEqual(tour?.scenes.map((s) => s.imageUrl), ["/labs/panoramas/test-room-a.jpg"]);
    assert.equal(tour?.placeholder, true);
    assert.match(tour?.label ?? "", /\(placeholder\)$/);
  });

  it("does nothing for projects without a tour", () => {
    assert.deepEqual(projectTourConfig({ name: "X" }, published, dev), { tour: null, problems: [] });
    assert.deepEqual(tourMediaAssetIds({}), []);
  });

  it("looks up each referenced asset id once", () => {
    const p = tourOf("approved", [{ source: "published", mediaAssetId: ID_A }, { source: "fixture", fixture: "test-room-b" }, { source: "published", mediaAssetId: ID_A }]);
    assert.deepEqual(tourMediaAssetIds(p), [ID_A]);
  });
});

describe("project page integration: no project carries test media", () => {
  /* The pilot assets — a placeholder massing model, a tour of generated test
     grids, a splat of coloured axis markers — were attached to REEF 996 so the
     viewer could be exercised on a real page. That made "Explore in 3D" appear
     on a Dubai tower with a test asset behind it, and a visitor clicking it has
     no reason to expect one however the control is captioned. They now live at
     /labs/viewer, which generates no params in production and is linked from
     nowhere. A project page shows immersive media only once a real asset has
     been published for it. */
  const every = projects;

  it("attaches no placeholder media to any project, in any environment", () => {
    for (const project of every) {
      for (const nodeEnv of ["development", "production"]) {
        const model = projectViewerConfig(project, nodeEnv);
        assert.equal(model?.placeholder ?? false, false, `${project.slug} (${nodeEnv}) must not show a placeholder model`);
        const { tour } = projectTourConfig(project, new Map(), { nodeEnv, cdnOrigin: CDN });
        assert.equal(tour?.placeholder ?? false, false, `${project.slug} (${nodeEnv}) must not show a placeholder tour`);
      }
    }
  });

  it("gives REEF 996 no immersive experience at all, because nothing real is published for it", () => {
    const reef = getProject("reef-996-dubai-production-city") as Project;
    assert.equal(projectViewerConfig(reef, "development"), null);
    assert.equal(projectTourConfig(reef, new Map(), { nodeEnv: "development", cdnOrigin: CDN }).tour, null);
    assert.equal(projectViewerConfig(reef, "production"), null);
    assert.equal(tourMediaAssetIds(reef).length, 0);
  });

  it("gives projects without immersive media neither experience", () => {
    const other = getProject("aaradhyam-pearl-badwai-bhopal") as Project;
    assert.equal(projectTourConfig(other, new Map(), { nodeEnv: "development", cdnOrigin: CDN }).tour, null);
  });
});

describe("viewer analytics", () => {
  it("keeps only allow-listed, id-like properties", () => {
    const e = sanitizeViewerEvent("hotspot_clicked", {
      project: "reef-996-dubai-production-city",
      sceneId: "room-a",
      hotspotId: "to-room-b",
      hotspotType: "navigation",
      url: "https://cdn.media.test/m/x/y/p.jpg",
      message: "Panorama failed to load (HTTP 403)",
      email: "someone@example.com",
      sourceKey: "uploads/x/y/source.jpg",
    });
    assert.deepEqual(e, { name: "hotspot_clicked", props: { project: "reef-996-dubai-production-city", sceneId: "room-a", hotspotId: "to-room-b", hotspotType: "navigation" } });
  });

  it("drops values that are not ids or known enum values", () => {
    const e = sanitizeViewerEvent("viewer_error", { project: "https://evil/x", sceneId: "Room A", errorKind: "Panorama failed", mode: "vr" });
    assert.deepEqual(e?.props, {});
  });

  it("refuses unknown event names", () => {
    assert.equal(sanitizeViewerEvent("xr_session_started", {}), null);
  });

  it("dispatches a first-party DOM event and nothing else", () => {
    const target = new EventTarget();
    const received: ViewerEvent[] = [];
    target.addEventListener(VIEWER_EVENT_TYPE, (e) => received.push((e as CustomEvent<ViewerEvent>).detail));
    const g = globalThis as unknown as { dispatchEvent?: (e: Event) => boolean };
    const original = g.dispatchEvent;
    g.dispatchEvent = target.dispatchEvent.bind(target);
    try {
      trackViewerEvent("panorama_navigation", { fromSceneId: "room-a", toSceneId: "room-b", via: "hotspot" });
    } finally {
      g.dispatchEvent = original;
    }
    assert.deepEqual(received, [{ name: "panorama_navigation", props: { fromSceneId: "room-a", toSceneId: "room-b", via: "hotspot" } }]);
  });
});
