const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = "anshdubey47@gmail.com";

  // 1. Make user an ADMIN
  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`✅ ${user.name} (${email}) is now ADMIN`);

  // 2. Reassign all properties to this user
  const result = await prisma.property.updateMany({
    data: { ownerId: user.id },
  });
  console.log(`✅ ${result.count} properties reassigned to ${user.name}`);

  console.log("\n🎉 Done! Log out and log back in for the role change to take effect.");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
