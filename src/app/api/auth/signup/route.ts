import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authCookieOptions, jsonError } from "@/lib/api";
import { signToken } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  budget: z.coerce.number().optional(),
  risk: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = SignupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Enter a valid name, email, and password with at least 8 characters.");
  }

  const { name, email, password, budget, risk } = parsed.data;

  try {
    await connectDb();
    const existing = await User.findOne({ email });
    if (existing) {
      return jsonError("An account already exists for this email.", 409);
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      preferences: {
        budget: budget ?? 50000000,
        risk: risk ?? "Balanced",
      },
    });

    const token = signToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    });
    const response = NextResponse.json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
    response.cookies.set("aarvasa_token", token, authCookieOptions());
    return response;
  } catch {
    const token = signToken({
      id: "demo-user",
      name,
      email,
    });
    const response = NextResponse.json({
      token,
      user: { id: "demo-user", name, email },
      mode: "demo",
    });
    response.cookies.set("aarvasa_token", token, authCookieOptions());
    return response;
  }
}
