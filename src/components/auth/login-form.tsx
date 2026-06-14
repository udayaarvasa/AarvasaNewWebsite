"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { motion } from "framer-motion"
import { Loader2, Mail, Lock } from "lucide-react"
import toast from "react-hot-toast"
import Link from "next/link"

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Invalid email or password")
        return
      }

      toast.success("Successfully logged in!")
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      toast.error("An error occurred during login")
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
        <h2 className="text-3xl font-serif text-[#F2F1ED] mb-2">Welcome Back</h2>
        <p className="text-[#F2F1ED]/60 text-sm">Sign in to your Aarvasa account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" className="rounded border-white/10 bg-white/5 text-[#D4AF37] focus:ring-[#D4AF37]" />
            <span className="text-[#F2F1ED]/60 hover:text-[#F2F1ED] transition-colors">Remember me</span>
          </label>
          <Link href="#" className="text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-gradient-to-r from-[#D4AF37] to-[#C5A028] hover:from-[#C5A028] hover:to-[#B69119] text-[#50080E] font-bold rounded-xl transition-all flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-[#F2F1ED]/60 text-sm">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#D4AF37] font-medium hover:text-[#D4AF37]/80 transition-colors">
            Create account
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
            className="flex justify-center items-center py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="text-[#F2F1ED] text-sm font-medium">Google</span>
          </button>
          <button 
            type="button"
            onClick={handleWalletLogin}
            disabled={isLoading}
            className="flex justify-center items-center py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="text-[#F2F1ED] text-sm font-medium">Wallet</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
