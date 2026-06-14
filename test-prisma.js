const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:Aarvasa2104@database-1.cqpc8oe8w8lz.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"
    }
  }
});

async function main() {
  console.log("Trying to query database...");
  const users = await prisma.user.findMany();
  console.log("Users:", users);
}

main()
  .catch(e => {
    console.error("PRISMA ERROR DETAILS:");
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
