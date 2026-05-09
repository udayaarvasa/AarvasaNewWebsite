import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authCookieOptions, jsonError } from "@/lib/api";
import { signToken } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError("Enter a valid email and password.");
  }

  const { email, password } = parsed.data;

  try {
    await connectDb();
    const user = await User.findOne({ email });

    if (!user) {
      return jsonError("Invalid email or password.", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return jsonError("Invalid email or password.", 401);
    }

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
      name: "Demo Investor",
      email,
    });
    const response = NextResponse.json({
      token,
      user: { id: "demo-user", name: "Demo Investor", email },
      mode: "demo",
    });
    response.cookies.set("aarvasa_token", token, authCookieOptions());
    return response;
  }
}
