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
import { signIn } from "next-auth/react"

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

  async function handleWalletLogin() {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Please install a Web3 wallet (like MetaMask)")
      return
    }

    setIsLoading(true)
    try {
      const ethereum = (window as any).ethereum
      const accounts = await ethereum.request({ method: "eth_requestAccounts" })
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found")
      }
      const address = accounts[0]
      
      const nonce = Math.random().toString(36).substring(2)
      const message = `Sign in to Aarvasa with your wallet.\nNonce: ${nonce}`

      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address]
      })

      const result = await signIn("wallet", {
        message,
        signature,
        address,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Wallet authentication failed")
        return
      }

      toast.success("Successfully logged in with wallet!")
      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to sign in with wallet")
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

      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-transparent text-[#F2F1ED]/40">Or continue with</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button 
            type="button"
            onClick={() => signIn("google")}
            disabled={isLoading}
            className="flex justify-center items-center gap-2.5 py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-[#F2F1ED] text-sm font-medium">Google</span>
          </button>
          <button 
            type="button"
            onClick={handleWalletLogin}
            disabled={isLoading}
            className="flex justify-center items-center gap-2.5 py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="h-5 w-5 text-[#F7931A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
            </svg>
            <span className="text-[#F2F1ED] text-sm font-medium">Web3 Wallet</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
