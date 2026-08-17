/**
 * Seeds the real REEF Luxury Developments inventory into Postgres.
 *
 * Idempotent: each project is upserted under a deterministic id (its slug), so
 * re-running updates rather than duplicating. Safe to run repeatedly.
 *
 *   DATABASE_URL='postgresql://...' node prisma/seed-reef.js
 *
 * Deliberately does NOT invent investment metrics. roi/aiScore/riskLevel are
 * left at their schema defaults — publishing made-up yield figures for real,
 * purchasable property would be a misrepresentation, not a placeholder.
 */
const { PrismaClient } = require("@prisma/client");
const projects = require("./reef-projects.json");

const prisma = new PrismaClient();

const aed = (n) => `AED ${n.toLocaleString("en-AE")}`;

function buildDescription(p) {
  const lines = [];
  lines.push(
    `${p.name} is an off-plan residential development by ${p.developer} in ${p.location}, Dubai, with completion expected ${p.completion}.`
  );
  if (p.totalUnits) {
    lines.push(
      `The tower comprises ${p.totalUnits} residences (${p.buildingConfig}).`
    );
  }
  lines.push("");
  lines.push("Current availability:");
  for (const t of p.unitTypes) {
    lines.push(
      `• ${t.label} — ${t.available} available, ${t.minSqft.toLocaleString()}–${t.maxSqft.toLocaleString()} sq.ft, from ${aed(t.fromPrice)}`
    );
  }
  lines.push("");
  lines.push(`Views: ${p.views.join(", ")}.`);
  if (p.nearby.length) {
    lines.push("");
    lines.push(
      `Nearby: ${p.nearby.map((n) => `${n.place} (${n.minutes} min)`).join(", ")}.`
    );
  }
  lines.push("");
  lines.push(
    `Pricing shown is the lowest of ${p.planLabels.length} published payment plans (${p.planLabels.join(", ")}) and is quoted in AED, the currency of the developer's contracts.`
  );
  return lines.join("\n");
}

async function main() {
  console.log("Seeding REEF inventory...");

  const developer = await prisma.user.upsert({
    where: { email: "developer@reefdevelopments.ae" },
    update: { name: "REEF Luxury Developments" },
    create: {
      name: "REEF Luxury Developments",
      email: "developer@reefdevelopments.ae",
      role: "BUILDER",
    },
  });

  for (const p of projects) {
    const data = {
      title: `${p.name} — ${p.location}`,
      description: buildDescription(p),
      price: p.fromPrice,
      location: p.location,
      city: p.city,
      state: "Dubai",
      country: p.country, // "UAE" — the UI derives AED from this
      propertyType: "APARTMENT",
      bedrooms: Math.min(...p.unitTypes.map((t) => t.bedrooms)),
      bathrooms: 0,
      area: p.minSqft,
      amenities: [...p.usps, ...p.views.map((v) => `${v} view`)],
      images: p.images,
      featured: p.images.length > 0,
      verified: true,
      status: "ACTIVE",
      ownerId: developer.id,
    };

    const saved = await prisma.property.upsert({
      where: { id: p.slug },
      update: data,
      create: { id: p.slug, ...data },
    });

    console.log(
      `  ${saved.id}  ${p.availableUnits} units  from ${aed(p.fromPrice)}  images:${p.images.length}`
    );
  }

  const total = await prisma.property.count();
  console.log(`Done. ${projects.length} Reef projects seeded; ${total} properties total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
