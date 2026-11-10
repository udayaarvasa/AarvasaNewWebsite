import type { ProjectCuratedImage, ProjectImagery } from "./project-types";

// Source URLs and review notes: docs/aaradhyam-imagery.md.
// Prime uses project-specific brochure renders. Pearl uses explicitly labelled
// city photography until a photograph of the Badwai development is available.
const prime = (id: string, alt: string, caption: string): ProjectCuratedImage => ({
  id, dir: "/images/aaradhyam/prime", ratios: ["16x9", "3x2", "4x5", "1x1"],
  alt, caption, origin: "render",
});
const entrance = prime("prime-entrance-brochure", "Architectural render of Aaradhyam Prime's gated entrance, with the project name on the stone wall.", "Entrance · Developer render");
const streetscape = prime("prime-streetscape-brochure", "Architectural render of Aaradhyam Prime's contemporary residences along a landscaped internal street.", "Landscaped streetscape · Developer render");
const residences = prime("prime-residences-brochure", "Architectural render showing the proposed Aaradhyam Prime residential facades and planted frontage.", "Residences · Developer render");

const facade = prime("prime-facade-brochure", "Brochure render of a proposed Aaradhyam Prime residence with planted balconies and a private entrance.", "Residence elevation · Developer render");
const clubhouse = prime("prime-clubhouse-brochure", "Brochure render of the proposed Aaradhyam Prime clubhouse with a glazed facade and landscaped frontage.", "Clubhouse · Developer render");

export const AARADHYAM_PRIME_IMAGERY: ProjectImagery = {
  hero: entrance, gallery: [entrance, streetscape, residences, facade, clubhouse],
  cards: [streetscape], details: [residences], banners: [entrance],
};

const lake: ProjectCuratedImage = {
  id: "bhopal-lake", dir: "/images/aaradhyam/bhopal", ratios: ["16x9", "3x2", "4x5", "1x1"],
  alt: "Aerial photograph of Upper Lake in Bhopal, shown as city context rather than a view of Aaradhyam Pearl.",
  caption: "Upper Lake, Bhopal — city context, not the Pearl site or a view from the development. Photo: Bilal Nibraas / Wikimedia Commons, CC BY-SA 4.0; cropped.",
  origin: "area",
};
const airport: ProjectCuratedImage = {
  id: "bhopal-airport", dir: "/images/aaradhyam/bhopal", ratios: ["16x9", "3x2", "4x5", "1x1"],
  alt: "Raja Bhoj Airport terminal in Bhopal, shown as a city landmark rather than Aaradhyam Pearl's site.",
  caption: "Raja Bhoj Airport, Bhopal — city context; no travel time or proximity is implied. Photo: Doctorchickencolslw / Wikimedia Commons, CC BY-SA 4.0; cropped.",
  origin: "area",
};

export const AARADHYAM_PEARL_IMAGERY: ProjectImagery = {
  hero: lake, gallery: [lake, airport], cards: [lake], details: [], banners: [lake],
  attribution: [
    { text: "Upper Lake · Bilal Nibraas", href: "https://commons.wikimedia.org/wiki/File:Aerial_view_of_Upper_Lake,_Bhopal.jpg" },
    { text: "Airport · Doctorchickencolslw", href: "https://commons.wikimedia.org/wiki/File:Bhopal_airport_view_from_apron.jpg" },
    { text: "Cropped photographs · CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" },
  ],
};
