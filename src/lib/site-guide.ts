export type GuideHint = { label: string; text: string; link?: { href: string; label: string } };

export const GUIDE_HINTS = {
  list: {
    label: "List my property",
    text: "Sign in, then add your property details and photos. Aarvasa reviews your submission before it appears in public listings.",
    link: { href: "/properties/create", label: "Open the listing form" },
  },
  details: {
    label: "What details do I need?",
    text: "Add a title, a description, the property type, the asking price in rupees, and the area in square feet.",
    link: { href: "#listing-details", label: "Go to property details" },
  },
  location: {
    label: "How do I enter the location?",
    text: "Enter the address or locality, city and state in the Location section.",
    link: { href: "#listing-location", label: "Go to location" },
  },
  photos: {
    label: "How do I add photos?",
    text: "Choose or drag in up to six photos, each up to 5 MB. Use JPG, PNG or WebP and wait for the previews to appear.",
    link: { href: "#listing-photos", label: "Go to property images" },
  },
  submit: {
    label: "What happens after I submit?",
    text: "Select Submit for review. You can check the pending listing under My Properties in your dashboard.",
    link: { href: "#listing-submit", label: "Go to submit" },
  },
  track: {
    label: "Check my listing status",
    text: "Open your dashboard and select My Properties to see the status of your listing.",
    link: { href: "/dashboard", label: "Open dashboard" },
  },
  browse: {
    label: "Find properties",
    text: "Open Properties to browse listings by city, property type and budget.",
    link: { href: "/listings", label: "Browse properties" },
  },
  filter: {
    label: "How do I use filters?",
    text: "Use the filters under All listings to narrow results by city, property type or budget.",
    link: { href: "#listing-filters", label: "Go to filters" },
  },
  compare: {
    label: "Compare properties",
    text: "Select Compare on up to three property cards, then open Compare from the shortlist.",
    link: { href: "/listings", label: "Find properties to compare" },
  },
  enquire: {
    label: "Enquire about this project",
    text: "Select Enquire or Request details to open the contact form. Then select Compose this enquiry to open your email app.",
  },
  advisor: {
    label: "Ask about a listed project",
    text: "Open the Advisor for questions about specifications, payment plans, handover dates or developer filings.",
    link: { href: "/ai-chat", label: "Open Advisor" },
  },
  contact: {
    label: "Contact Aarvasa",
    text: "Open Contact for Aarvasa’s email address and phone number.",
    link: { href: "/contact", label: "Open contact page" },
  },
} satisfies Record<string, GuideHint>;

export type GuideHintId = keyof typeof GUIDE_HINTS;

const GENERAL_HINTS: GuideHintId[] = ["list", "browse", "compare", "advisor", "track", "contact"];

export const GUIDE_CONTEXTS = {
  general: GENERAL_HINTS,
  listings: ["filter", "compare", ...GENERAL_HINTS.filter((id) => id !== "compare")],
  project: ["enquire", "advisor", "compare", "list", "browse", "track", "contact"],
  listingForm: ["details", "location", "photos", "submit", "track", "contact"],
  dashboard: ["track", "list", "browse", "compare", "advisor", "contact"],
} satisfies Record<string, GuideHintId[]>;

export function getGuideContext(pathname: string): keyof typeof GUIDE_CONTEXTS | null {
  if (pathname === "/properties/create") return "listingForm";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/listings") return "listings";
  if (pathname.startsWith("/projects/")) return "project";
  if (["/", "/compare", "/ai-chat", "/contact", "/about", "/services", "/reef", "/login", "/signup"].includes(pathname)) {
    return "general";
  }
  return null;
}
