import { z } from "zod";

export const mobileLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// ADMIN is deliberately absent: self-registration must never grant it.
export const selfAssignableRoleSchema = z.enum(["USER", "AGENT", "BUILDER"]);

export const mobileGoogleSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
  role: selfAssignableRoleSchema.default("USER"),
});

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type MobileLoginInput = z.input<typeof mobileLoginSchema>;
