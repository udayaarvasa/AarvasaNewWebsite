import { PANORAMA_FIXTURES, panoramaFixtureUrl } from "@/lib/viewer/panorama-fixtures";
import type { PanoramaTour } from "@/lib/viewer/tour";

/**
 * TEST-360: the engineering bench for the 360° tour.
 *
 * Built from the generated fixture panoramas (src/lib/viewer/panorama-fixtures.ts),
 * which are abstract compass grids served only by /labs/panoramas and only
 * outside production. Nothing here depicts a real place, and `placeholder` is
 * true, so the viewer states that on screen.
 *
 * This tour lives in the lab rather than on a project page on purpose. A tour of
 * test grids attached to REEF 996 was reachable from that project's page, and a
 * visitor clicking "360°" on a Dubai tower has no reason to expect a test grid
 * behind it however the control is captioned.
 *
 * What it is for: proving orientation (yaw 0 sits at the image centre, so the
 * "0° FRONT" label must face the camera on load, and a hotspot at yaw 90 must
 * land on the 90° line), mouse and touch drag, field-of-view zoom, fullscreen,
 * keyboard look, scene switching and hotspot navigation, on desktop and on a
 * phone-width viewport.
 */
export const TEST_360_TOUR: PanoramaTour = {
  label: "TEST-360 — generated panoramas, not a real place",
  placeholder: true,
  startSceneId: "test-room-a",
  scenes: [
    {
      id: "test-room-a",
      title: PANORAMA_FIXTURES["test-room-a"].name,
      floor: "Test level 1",
      imageUrl: panoramaFixtureUrl("test-room-a"),
      alt: "Generated 360° test grid labelled Test room A, with compass headings every 30 degrees. Not a photograph of any property.",
      // Facing the image centre, so a horizontal flip or a yaw offset is visible
      // on load without touching anything.
      initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 },
      hotspots: [
        { id: "a-to-b", label: "Go to Test room B", yawDeg: 90, pitchDeg: -10, type: "navigation", targetSceneId: "test-room-b" },
        { id: "a-to-c", label: "Go to Test room C", yawDeg: -90, pitchDeg: -10, type: "navigation", targetSceneId: "test-room-c" },
        {
          id: "a-orientation",
          label: "Orientation check",
          yawDeg: 0,
          pitchDeg: 20,
          type: "info",
          description:
            "This hotspot sits at yaw 0, pitch 20. It must appear above the 0° FRONT label. If it is to the side, the panorama's yaw is offset; if it is below, the vertical axis is flipped.",
        },
      ],
    },
    {
      id: "test-room-b",
      title: PANORAMA_FIXTURES["test-room-b"].name,
      floor: "Test level 1",
      imageUrl: panoramaFixtureUrl("test-room-b"),
      alt: "Generated 360° test grid labelled Test room B, with compass headings every 30 degrees. Not a photograph of any property.",
      // Deliberately not zero: returning here must restore this view, not room A's.
      initialView: { yawDeg: 90, pitchDeg: 0, fovDeg: 75 },
      hotspots: [
        { id: "b-to-a", label: "Back to Test room A", yawDeg: -90, pitchDeg: -10, type: "navigation", targetSceneId: "test-room-a" },
        { id: "b-to-c", label: "Go to Test room C", yawDeg: 180, pitchDeg: -10, type: "navigation", targetSceneId: "test-room-c" },
      ],
    },
    {
      id: "test-room-c",
      title: PANORAMA_FIXTURES["test-room-c"].name,
      floor: "Test level 2",
      imageUrl: panoramaFixtureUrl("test-room-c"),
      alt: "Generated 360° test grid labelled Test room C, with compass headings every 30 degrees. Not a photograph of any property.",
      initialView: { yawDeg: -45, pitchDeg: 10, fovDeg: 90 },
      hotspots: [
        { id: "c-to-a", label: "Back to Test room A", yawDeg: 0, pitchDeg: -10, type: "navigation", targetSceneId: "test-room-a" },
        {
          id: "c-floor",
          label: "Floor grouping",
          yawDeg: 120,
          pitchDeg: 0,
          type: "info",
          description: "This room is on Test level 2, so the room selector must group it separately from A and B.",
        },
      ],
    },
  ],
};
