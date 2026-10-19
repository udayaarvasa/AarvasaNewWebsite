/**
 * Search-facing copy for each project page: the <title>, meta description and
 * the short introduction shown under "Overview".
 *
 * Written per project rather than templated, so no two pages read alike, and
 * built only from facts already on the project record (or, where stated, the
 * developer's own page/release recorded in research/sources). Nothing here
 * may state a figure the record does not carry; tests check the numbers.
 *
 * Titles stay under ~60 characters where possible and lead with the project
 * and its location, which is how people search for an off-plan building.
 */
export type ProjectSeo = {
  readonly title: string;
  readonly description: string;
  readonly intro: readonly string[];
};

export const PROJECT_SEO: Readonly<Record<string, ProjectSeo>> = {
  "reef-996-dubai-production-city": {
    title: "REEF 996 Apartments, Dubai Production City",
    description:
      "REEF 996 in Dubai Production City (IMPZ): 505 residences, studios to 3-bedroom, 452–1,901 sq.ft, from AED 679,467. Completion Q3 2028. Sunken-balcony tower by REEF Luxury Developments.",
    intro: [
      "REEF 996 is a 505-residence tower in Dubai Production City, the district formerly known as IMPZ. It is configured as 1B + G + 3P + 20 — one basement, ground, three podium levels and twenty residential floors — with studios and one-, two- and three-bedroom apartments from 452 to 1,901 sq.ft.",
      "Like every REEF building it is designed around the developer's outdoor-cooled sunken balcony. Completion is scheduled for Q3 2028.",
    ],
  },
  "reef-997-dubai-islands": {
    title: "REEF 997 Apartments on Dubai Islands",
    description:
      "REEF 997 on Dubai Islands: 1-, 2- and 3-bedroom apartments of 1,061–2,536 sq.ft from AED 2,699,042, completing March 2028. Outdoor-cooled sunken balconies by REEF Luxury Developments.",
    intro: [
      "REEF 997 is the developer's island address, on Dubai Islands off Deira — the reclaimed islands formerly called Deira Islands. It has no studios: its one-, two- and three-bedroom apartments run from 1,061 to 2,536 sq.ft, with park and pool views.",
      "Completion is scheduled for March 2028.",
    ],
  },
  "reef-998-dlrc": {
    title: "REEF 998 Apartments in DLRC, Dubailand",
    description:
      "REEF 998 in Dubai Land Residence Complex: studio to 3-bedroom apartments, 477–1,397 sq.ft, from AED 742,070, completing June 2028. Explore the tower in 3D in its neighbourhood.",
    intro: [
      "REEF 998 is in Dubai Land Residence Complex (DLRC), the Dubailand community between Sheikh Mohammed Bin Zayed Road and Al Ain Road. It offers studios and one-, two- and three-bedroom apartments from 477 to 1,397 sq.ft.",
      "It is also the REEF building you can explore here as an Aarvasa 3D reconstruction, shown at an approximate position in Google's 3D view of the area. Completion is scheduled for June 2028.",
    ],
  },
  "reef-999-al-furjan": {
    title: "REEF 999 Apartments & Sky Villas, Al Furjan",
    description:
      "REEF 999 in Al Furjan: 142 residences — 1- to 3-bedroom apartments and 4-bedroom sky villas, 792–3,695 sq.ft — from AED 1,158,334. Completion Q2 2027.",
    intro: [
      "REEF 999 is a 142-residence development in Al Furjan, near the Expo 2020 site and five minutes from Al Furjan Metro Station by the developer's estimate. It offers one-, two- and three-bedroom apartments and four-bedroom sky villas of up to 3,695 sq.ft, over its own retail mall.",
      "The developer describes it as the first building with outdoor-cooled winter gardens, alongside REEF's sunken balconies. Completion is scheduled for Q2 2027.",
    ],
  },
  "reef-1000-dlrc": {
    title: "REEF 1000 Studios & Duplexes in DLRC, Dubailand",
    description:
      "REEF 1000 in Dubai Land Residence Complex: 125 residences — studios, 1- and 2-bedroom apartments and 2-bedroom duplexes, 437–1,905 sq.ft. Completion Q4 2026; prices on request.",
    intro: [
      "REEF 1000 is the earliest-completing of the five REEF buildings: 125 residences over ground-floor retail in Dubai Land Residence Complex, the community of nearly 14 million sq.ft off Sheikh Mohammed Bin Zayed Road (E311) and Al Ain Road (E66).",
      "It offers studios, one- and two-bedroom apartments and two-bedroom duplexes from 437 to 1,905 sq.ft, with a running track, cricket pitch and outdoor gym among its amenities. Completion is scheduled for Q4 2026. The developer has not published prices, so Aarvasa quotes them on enquiry.",
    ],
  },
  "aaradhyam-pearl-badwai-bhopal": {
    title: "Aaradhyam Pearl Residential Plots, Badwai, Bhopal",
    description:
      "Aaradhyam Pearl, Badwai Road (NH-12), Bhopal: 65 residential plots of 22×35 and 22×40 ft at ₹3,500/sq.ft, from ₹26.95 lakh, in a T&CP-approved gated colony.",
    intro: [
      "Aaradhyam Pearl is a gated colony of 65 residential plots at Village Badwai on the NH-12 Karond bypass, north Bhopal. Plots come in two sizes — 22 × 35 ft (770 sq.ft) and 22 × 40 ft (880 sq.ft) — at ₹3,500 per sq.ft.",
      "The layout is approved by the Town & Country Planning Department and Nagar Nigam Bhopal, with 9 m roads, street lighting and dedicated shop plots.",
    ],
  },
  "aaradhyam-prime-jatkhedi-bhopal": {
    title: "Aaradhyam Prime Plots, Jatkhedi, Hoshangabad Road, Bhopal",
    description:
      "Aaradhyam Prime at Gram Jatkhedi, Hoshangabad Road, Bhopal: a gated layout of 37 residential and commercial plots at ₹5,200–5,500 per sq.ft, beside Stellar High International School.",
    intro: [
      "Aaradhyam Prime is a 37-plot gated layout at Gram Jatkhedi on Hoshangabad Road, south Bhopal, beside Stellar High International School — a different site from Aaradhyam Pearl at Badwai.",
      "Plots 1–11 are ₹5,500 per sq.ft and plots 12–21 are ₹5,200; plots 28–37 are allocated under the LIG and EWS schemes. Plot dimensions have not been published, so prices are quoted per sq.ft.",
    ],
  },
};
