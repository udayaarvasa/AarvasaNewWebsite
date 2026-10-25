/**
 * Licensed stock photography for decorative slots.
 *
 * Until 25 Oct 2026 the home page, sign-in, contact, listings, services and
 * about pages decorated themselves with REEF developer renders. No permission
 * to republish those is on record (see IMAGERY_PERMISSION in projects.ts), so
 * they were withdrawn and these photographs, published on Unsplash under the
 * Unsplash License (free commercial use, no permission needed), took their
 * place.
 *
 * Every caption says "Stock photograph", and none names a project: a stock
 * view of Dubai must never read as a picture of a building Aarvasa lists.
 */

const UNSPLASH = "https://images.unsplash.com";

export type StockImage = { readonly src: string; readonly alt: string; readonly caption: string };

const stock = (id: string, alt: string, subject: string, width = 2000): StockImage => ({
  src: `${UNSPLASH}/${id}?auto=format&fit=crop&w=${width}&q=80`,
  alt,
  caption: `${subject} · Stock photograph`,
});

export const STOCK = {
  dubaiSunset: stock("photo-1512453979798-5ea266f8880c", "Dubai skyline at sunset", "Dubai"),
  dubaiDusk: stock("photo-1526495124232-a04e1849168c", "Dubai towers at dusk", "Dubai"),
  downtownDubai: stock("photo-1580674684081-7617fbf3d745", "Downtown Dubai under a bright sky", "Downtown Dubai"),
  burjPalms: stock("photo-1582672060674-bc2bd808a8b5", "A Dubai tower framed by palms", "Dubai"),
  towerDetail: stock("photo-1597659840241-37e2b9c2f55f", "Detail of a Dubai tower facade at dusk", "Dubai"),
  burjAlArab: stock("photo-1518684079-3c830dcef090", "Burj Al Arab from above", "Dubai"),
  glassTowers: stock("photo-1486406146926-c627a92ad1ab", "Glass towers seen from street level", "Architecture"),
  livingRoom: stock("photo-1600210492486-724fe5c67fb0", "A bright, furnished living room", "Interior"),
  openPlan: stock("photo-1600607687939-ce8a6c25118c", "An open-plan living area", "Interior"),
  staircase: stock("photo-1502005229762-cf1b2da7c5d6", "A light-filled staircase", "Interior"),
} as const;
