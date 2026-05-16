const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const img = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

async function main() {
  console.log("🌱 Seeding database...");

  // Create demo users
  const password = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@aarvasa.com" },
    update: {},
    create: {
      name: "Aarvasa Admin",
      email: "admin@aarvasa.com",
      password,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@aarvasa.com" },
    update: {},
    create: {
      name: "Priya Sharma",
      email: "agent@aarvasa.com",
      password,
      role: "AGENT",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@aarvasa.com" },
    update: {},
    create: {
      name: "Rahul Mehta",
      email: "user@aarvasa.com",
      password,
      role: "USER",
    },
  });

  console.log("✅ Users created");

  // Create properties
  const propertyData = [
    {
      title: "Aarvasa Cliff Villas",
      description:
        "Premium villa cluster in a short-term rental hotspot with high occupancy, limited inventory, and strong luxury travel demand. Located in the heart of Assagao, Goa, these villas offer breathtaking cliff-side views and world-class amenities.",
      price: 48500000,
      location: "Assagao, North Goa",
      city: "Goa",
      state: "Goa",
      propertyType: "VILLA",
      bedrooms: 4,
      bathrooms: 5,
      area: 5200,
      roi: 18.4,
      amenities: ["Swimming Pool", "Garden", "Security", "Smart Home", "Terrace", "Parking"],
      images: [
        img("photo-1613977257363-707ba9348227"),
        img("photo-1600607687920-4e2a09cf159d"),
        img("photo-1600566753190-17f0baa2a6c3"),
      ],
      featured: true,
      verified: true,
      riskLevel: "LOW",
      aiScore: 96,
      ownerId: agent.id,
    },
    {
      title: "Skyline Residences 72",
      description:
        "Grade-A residential tower near employment hubs, showing strong absorption and premium resale velocity. These luxury apartments in Sector 72, Gurugram offer proximity to major IT corridors and metro connectivity.",
      price: 32500000,
      location: "Sector 72, Gurugram",
      city: "Gurugram",
      state: "Haryana",
      propertyType: "APARTMENT",
      bedrooms: 3,
      bathrooms: 3,
      area: 2450,
      roi: 15.7,
      amenities: ["Gym", "Parking", "Club House", "Power Backup", "Elevator", "Security"],
      images: [
        img("photo-1600585154340-be6161a56a0c"),
        img("photo-1600607688969-a5bfcd646154"),
        img("photo-1600607687644-c7171b42498b"),
      ],
      featured: true,
      verified: true,
      riskLevel: "BALANCED",
      aiScore: 91,
      ownerId: agent.id,
    },
    {
      title: "Northstar Tech Park",
      description:
        "Commercial asset in a deep tenant market with durable office demand from AI, cloud, and GCC occupiers. Strategically located in Hebbal, Bengaluru's premier tech corridor.",
      price: 72000000,
      location: "Hebbal, Bengaluru",
      city: "Bengaluru",
      state: "Karnataka",
      propertyType: "OFFICE",
      bedrooms: 0,
      bathrooms: 8,
      area: 11800,
      roi: 16.9,
      amenities: ["Parking", "Power Backup", "Elevator", "Security", "Club House"],
      images: [
        img("photo-1497366754035-f200968a6e72"),
        img("photo-1497366811353-6870744d04b2"),
        img("photo-1524758631624-e2822e304c36"),
      ],
      featured: false,
      verified: true,
      riskLevel: "MODERATE",
      aiScore: 89,
      ownerId: admin.id,
    },
    {
      title: "Kihim Waterfront Estate",
      description:
        "Waterfront land bank positioned for villa development, weekend home demand, and supply-constrained appreciation. Premium beachfront location in Alibaug with direct sea access.",
      price: 56000000,
      location: "Kihim Beach, Alibaug",
      city: "Mumbai",
      state: "Maharashtra",
      propertyType: "LAND",
      bedrooms: 0,
      bathrooms: 0,
      area: 18000,
      roi: 14.6,
      amenities: ["Garden", "Security"],
      images: [
        img("photo-1500530855697-b586d89ba3ee"),
        img("photo-1564013799919-ab600027ffc6"),
        img("photo-1600047509807-ba8f99d2cdde"),
      ],
      featured: true,
      verified: false,
      riskLevel: "BALANCED",
      aiScore: 87,
      ownerId: admin.id,
    },
    {
      title: "Sea Link Private Residences",
      description:
        "Trophy residence in a proven micro-market with resilient capital preservation and high-net-worth buyer depth. Iconic Worli sea-link views from every unit.",
      price: 91000000,
      location: "Worli Sea Face, Mumbai",
      city: "Mumbai",
      state: "Maharashtra",
      propertyType: "APARTMENT",
      bedrooms: 4,
      bathrooms: 5,
      area: 4100,
      roi: 12.8,
      amenities: ["Swimming Pool", "Gym", "Parking", "Club House", "Smart Home", "Balcony", "Elevator", "Security"],
      images: [
        img("photo-1600607687939-ce8a6c25118c"),
        img("photo-1600566752355-35792bedcfea"),
        img("photo-1600607688066-890987f18a86"),
      ],
      featured: true,
      verified: true,
      riskLevel: "LOW",
      aiScore: 84,
      ownerId: agent.id,
    },
    {
      title: "Hinjewadi Growth Homes",
      description:
        "Efficient apartment format near IT demand, balancing approachable ticket size with above-market rental yield. Ideal for first-time investors seeking strong cash-flow properties.",
      price: 18500000,
      location: "Phase 3, Hinjewadi",
      city: "Pune",
      state: "Maharashtra",
      propertyType: "APARTMENT",
      bedrooms: 2,
      bathrooms: 2,
      area: 1320,
      roi: 17.2,
      amenities: ["Gym", "Parking", "Power Backup", "Elevator", "Security"],
      images: [
        img("photo-1560184897-ae75f418493e"),
        img("photo-1600210492486-724fe5c67fb0"),
        img("photo-1600607687920-4e2a09cf159d"),
      ],
      featured: false,
      verified: true,
      riskLevel: "MODERATE",
      aiScore: 90,
      ownerId: user.id,
    },
  ];

  for (const data of propertyData) {
    await prisma.property.create({ data });
  }

  console.log(`✅ ${propertyData.length} properties created`);
  console.log("\n📋 Demo accounts:");
  console.log("  Admin:  admin@aarvasa.com / Password123!");
  console.log("  Agent:  agent@aarvasa.com / Password123!");
  console.log("  User:   user@aarvasa.com  / Password123!");
  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
