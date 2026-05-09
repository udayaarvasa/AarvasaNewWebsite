export type Property = {
  id: string;
  title: string;
  price: number;
  location: string;
  roi: number;
  type: "Villa" | "Apartment" | "Office" | "Land";
  images: string[];
  tags: string[];
  growth: string;
  risk: "Low" | "Moderate" | "Balanced";
  beds: number;
  baths: number;
  sqft: number;
  score: number;
  summary: string;
  coordinates: { lat: number; lng: number };
  roiSeries: { month: string; roi: number; market: number }[];
};

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

export const properties: Property[] = [
  {
    id: "goa-cliff-villas",
    title: "Aarvasa Cliff Villas",
    price: 48500000,
    location: "Assagao, Goa",
    roi: 18.4,
    type: "Villa",
    images: [
      image("photo-1613977257363-707ba9348227"),
      image("photo-1600607687920-4e2a09cf159d"),
      image("photo-1600566753190-17f0baa2a6c3"),
    ],
    tags: ["AI Recommended", "High Growth", "Rental Yield"],
    growth: "+31% demand YoY",
    risk: "Low",
    beds: 4,
    baths: 5,
    sqft: 5200,
    score: 96,
    summary:
      "Premium villa cluster in a short-term rental hotspot with high occupancy, limited inventory, and strong luxury travel demand.",
    coordinates: { lat: 15.5937, lng: 73.759 },
    roiSeries: [
      { month: "Jan", roi: 12.1, market: 8.6 },
      { month: "Feb", roi: 13.4, market: 8.9 },
      { month: "Mar", roi: 14.8, market: 9.2 },
      { month: "Apr", roi: 16.5, market: 9.6 },
      { month: "May", roi: 18.4, market: 10.1 },
    ],
  },
  {
    id: "gurugram-sky-residences",
    title: "Skyline Residences 72",
    price: 32500000,
    location: "Sector 72, Gurugram",
    roi: 15.7,
    type: "Apartment",
    images: [
      image("photo-1600585154340-be6161a56a0c"),
      image("photo-1600607688969-a5bfcd646154"),
      image("photo-1600607687644-c7171b42498b"),
    ],
    tags: ["AI Recommended", "Metro Corridor"],
    growth: "+24% price momentum",
    risk: "Balanced",
    beds: 3,
    baths: 3,
    sqft: 2450,
    score: 91,
    summary:
      "Grade-A residential tower near employment hubs, showing strong absorption and premium resale velocity.",
    coordinates: { lat: 28.4089, lng: 77.0426 },
    roiSeries: [
      { month: "Jan", roi: 10.4, market: 7.9 },
      { month: "Feb", roi: 11.8, market: 8.2 },
      { month: "Mar", roi: 13.2, market: 8.7 },
      { month: "Apr", roi: 14.9, market: 9.1 },
      { month: "May", roi: 15.7, market: 9.4 },
    ],
  },
  {
    id: "bangalore-tech-park",
    title: "Northstar Tech Park",
    price: 72000000,
    location: "Hebbal, Bengaluru",
    roi: 16.9,
    type: "Office",
    images: [
      image("photo-1497366754035-f200968a6e72"),
      image("photo-1497366811353-6870744d04b2"),
      image("photo-1524758631624-e2822e304c36"),
    ],
    tags: ["Institutional Grade", "High Growth"],
    growth: "+19% leasing spread",
    risk: "Moderate",
    beds: 0,
    baths: 8,
    sqft: 11800,
    score: 89,
    summary:
      "Commercial asset in a deep tenant market with durable office demand from AI, cloud, and GCC occupiers.",
    coordinates: { lat: 13.0358, lng: 77.597 },
    roiSeries: [
      { month: "Jan", roi: 11.6, market: 8.8 },
      { month: "Feb", roi: 12.7, market: 9.1 },
      { month: "Mar", roi: 14.3, market: 9.3 },
      { month: "Apr", roi: 15.8, market: 9.7 },
      { month: "May", roi: 16.9, market: 10.2 },
    ],
  },
  {
    id: "alibaug-waterfront-estate",
    title: "Kihim Waterfront Estate",
    price: 56000000,
    location: "Alibaug, Maharashtra",
    roi: 14.6,
    type: "Land",
    images: [
      image("photo-1500530855697-b586d89ba3ee"),
      image("photo-1564013799919-ab600027ffc6"),
      image("photo-1600047509807-ba8f99d2cdde"),
    ],
    tags: ["Scarce Inventory", "Lifestyle Demand"],
    growth: "+28% luxury inquiries",
    risk: "Balanced",
    beds: 0,
    baths: 0,
    sqft: 18000,
    score: 87,
    summary:
      "Waterfront land bank positioned for villa development, weekend home demand, and supply-constrained appreciation.",
    coordinates: { lat: 18.6414, lng: 72.8722 },
    roiSeries: [
      { month: "Jan", roi: 9.8, market: 7.5 },
      { month: "Feb", roi: 10.9, market: 7.9 },
      { month: "Mar", roi: 12.4, market: 8.4 },
      { month: "Apr", roi: 13.5, market: 8.8 },
      { month: "May", roi: 14.6, market: 9.2 },
    ],
  },
  {
    id: "mumbai-sea-link-home",
    title: "Sea Link Private Residences",
    price: 91000000,
    location: "Worli, Mumbai",
    roi: 12.8,
    type: "Apartment",
    images: [
      image("photo-1600607687939-ce8a6c25118c"),
      image("photo-1600566752355-35792bedcfea"),
      image("photo-1600607688066-890987f18a86"),
    ],
    tags: ["Ultra Prime", "Low Risk"],
    growth: "+11% prime resale",
    risk: "Low",
    beds: 4,
    baths: 5,
    sqft: 4100,
    score: 84,
    summary:
      "Trophy residence in a proven micro-market with resilient capital preservation and high-net-worth buyer depth.",
    coordinates: { lat: 19.0176, lng: 72.8177 },
    roiSeries: [
      { month: "Jan", roi: 8.2, market: 7.4 },
      { month: "Feb", roi: 9.1, market: 7.8 },
      { month: "Mar", roi: 10.7, market: 8.2 },
      { month: "Apr", roi: 11.9, market: 8.5 },
      { month: "May", roi: 12.8, market: 8.7 },
    ],
  },
  {
    id: "pune-hinjewadi-homes",
    title: "Hinjewadi Growth Homes",
    price: 18500000,
    location: "Hinjewadi, Pune",
    roi: 17.2,
    type: "Apartment",
    images: [
      image("photo-1560184897-ae75f418493e"),
      image("photo-1600210492486-724fe5c67fb0"),
      image("photo-1600607687920-4e2a09cf159d"),
    ],
    tags: ["AI Recommended", "Affordable Entry"],
    growth: "+33% rental search",
    risk: "Moderate",
    beds: 2,
    baths: 2,
    sqft: 1320,
    score: 90,
    summary:
      "Efficient apartment format near IT demand, balancing approachable ticket size with above-market rental yield.",
    coordinates: { lat: 18.5913, lng: 73.7389 },
    roiSeries: [
      { month: "Jan", roi: 11.2, market: 8.1 },
      { month: "Feb", roi: 12.6, market: 8.5 },
      { month: "Mar", roi: 14.9, market: 8.9 },
      { month: "Apr", roi: 16.1, market: 9.2 },
      { month: "May", roi: 17.2, market: 9.6 },
    ],
  },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getProperty(id: string) {
  return properties.find((property) => property.id === id);
}

export function getRecommendations(input?: {
  budget?: number;
  location?: string;
  type?: string;
  risk?: string;
}) {
  const budget = input?.budget ?? 50000000;
  return properties
    .map((property) => {
      const budgetFit = property.price <= budget ? 18 : Math.max(0, 18 - (property.price - budget) / 6000000);
      const locationFit = input?.location
        ? property.location.toLowerCase().includes(input.location.toLowerCase())
          ? 14
          : 4
        : 8;
      const typeFit = input?.type && input.type !== "Any" ? (property.type === input.type ? 12 : 2) : 7;
      const riskFit = input?.risk ? (property.risk === input.risk ? 10 : 4) : 7;

      return {
        ...property,
        matchScore: Math.min(99, Math.round(property.score * 0.5 + budgetFit + locationFit + typeFit + riskFit)),
        reason: `${property.roi}% projected ROI, ${property.growth.toLowerCase()}, and ${property.risk.toLowerCase()} risk profile.`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4);
}
