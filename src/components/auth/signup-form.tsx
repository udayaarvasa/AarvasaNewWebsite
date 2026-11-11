"use client"

import { signIn } from "next-auth/react"
import Link from "next/link"
import { useState } from "react"

export function SignupForm() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function startSignup() {
    setPending(true)
    setError(false)
    try {
      await signIn("google", { redirectTo: "/dashboard" })
    } catch {
      setError(true)
      setPending(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-[#F2F1ED]">
      <h1 className="font-serif text-3xl">Create your account</h1>
      <p className="mt-3 text-sm text-[#F2F1ED]/80">Continue with Gmail or Google Workspace to verify your email.</p>
      <button type="button" disabled={pending} onClick={() => void startSignup()}
        className="mt-6 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-[#12070a] disabled:opacity-60">
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">Google sign-in could not start. Please try again.</p>}
      <p className="mt-5 text-sm text-[#F2F1ED]/80">Already have an account? <Link href="/login" className="text-[#D4AF37] underline">Sign in</Link></p>
    </div>
  )
}
