import { PrismaClient } from "@prisma/client"

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL
  
  if (dbUrl && dbUrl.startsWith("postgresql://") && !dbUrl.includes("sslmode=")) {
    const separator = dbUrl.includes("?") ? "&" : "?"
    dbUrl = `${dbUrl}${separator}sslmode=require`
    console.log("Prisma: Automatically appended sslmode=require to PostgreSQL DATABASE_URL")
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: ['error', 'warn'],
  })

  // Test connection to detect issues early in logs
  client.$connect()
    .then(() => {
      console.log("Prisma: Connected to PostgreSQL database successfully.")
    })
    .catch((err) => {
      console.error("Prisma: Failed to connect to database:", err)
    })

  return client
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma
