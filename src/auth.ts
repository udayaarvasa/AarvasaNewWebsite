import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
// Removed Prisma type imports for local build compatibility

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  debug: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          }
        });

        if (!user || !user?.password) {
          throw new Error("Invalid credentials");
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    }),
    CredentialsProvider({
      id: "wallet",
      name: "wallet",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
        address: { label: "Address", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature || !credentials?.address) {
          throw new Error("Invalid wallet credentials");
        }

        const address = credentials.address as string;
        const signature = credentials.signature as string;
        const message = credentials.message as string;

        try {
          const { verifyMessage } = await import("viem");
          const isValid = await verifyMessage({
            address: address as `0x${string}`,
            message: message,
            signature: signature as `0x${string}`
          });

          if (!isValid) {
            throw new Error("Invalid signature");
          }

          let user = await prisma.user.findUnique({
            where: {
              email: `${address.toLowerCase()}@wallet.aarvasa`
            }
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                name: `Wallet ${address.substring(0, 6)}...`,
                email: `${address.toLowerCase()}@wallet.aarvasa`,
                role: "USER"
              }
            });
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error) {
          console.error("Wallet authentication failed:", error);
          throw new Error("Wallet authentication failed");
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session?.user) {
        session.user.role = token.role as any;
        session.user.id = token.id as string;
      }
      return session;
    }
  }
})

