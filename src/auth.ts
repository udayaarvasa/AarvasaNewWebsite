import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./lib/prisma"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { isCompromisedPassword } from "@/lib/compromised-passwords"
import bcrypt from "bcryptjs"
// Removed Prisma type imports for local build compatibility

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV !== "production",
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
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
        // A publicly exposed password never authenticates, whatever is stored.
        if (isCompromisedPassword(credentials.password as string)) {
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
    /**
     * Wallet sign-in — DISABLED.
     *
     * The message this provider verifies is composed entirely on the client,
     * including its nonce, and the server keeps no record of having issued it.
     * A valid (message, signature, address) triple therefore authenticates for
     * ever and can be replayed, and because the caller chooses the message
     * text, a signature a wallet produced for some other site would be accepted
     * here too. Making it safe needs a server-issued, single-use, expiring
     * nonce — that is building out the blockchain layer, which is explicitly
     * not yet in scope, so the path is taken out of service instead of left
     * live and weak. The sign-in buttons are removed to match.
     *
     * To re-enable for development of that layer, set
     * AARVASA_ENABLE_WALLET_AUTH=1 — and implement the nonce store first.
     */
    ...(process.env.AARVASA_ENABLE_WALLET_AUTH === "1" ? [CredentialsProvider({
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
    })] : []),
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

