"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion } from "framer-motion"
import { Loader2, Mail, Lock, User } from "lucide-react"
import toast from "react-hot-toast"
import Link from "next/link"

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type SignupFormValues = z.infer<typeof signupSchema>

export function SignupForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Something went wrong")
      }

      toast.success("Account created successfully! Please sign in.")
      router.push("/login")
    } catch (error: any) {
      toast.error(error.message || "An error occurred during signup")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto p-8 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"
    >
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-serif text-[#F2F1ED] mb-2">Create Account</h2>
        <p className="text-[#F2F1ED]/60 text-sm">Join Aarvasa's premium PropTech platform</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-medium text-[#F2F1ED]/80" htmlFor="name">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-[#F2F1ED]/40" />
            </div>
            <input
              id="name"
              type="text"
              {...register("name")}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-[#50080E]/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none text-[#F2F1ED] transition-all placeholder:text-[#F2F1ED]/30"
              placeholder="John Doe"
            />
          </div>
          {errors.name && (
            <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-[#F2F1ED]/80" htmlFor="email">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-[#F2F1ED]/40" />
            </div>
            <input
              id="email"
              type="email"
              {...register("email")}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-[#50080E]/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none text-[#F2F1ED] transition-all placeholder:text-[#F2F1ED]/30"
              placeholder="investor@example.com"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-[#F2F1ED]/80" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#F2F1ED]/40" />
            </div>
            <input
              id="password"
              type="password"
              {...register("password")}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-[#50080E]/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none text-[#F2F1ED] transition-all placeholder:text-[#F2F1ED]/30"
              placeholder="••••••••"
            />
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-[#F2F1ED]/80" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#F2F1ED]/40" />
            </div>
            <input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-3 bg-[#50080E]/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none text-[#F2F1ED] transition-all placeholder:text-[#F2F1ED]/30"
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#B69119] text-[#50080E] font-bold rounded-xl transition-all flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-[#F2F1ED]/60 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-[#D4AF37] font-medium hover:text-[#D4AF37]/80 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
