"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Building2, Heart, Loader2, MessageSquare, Shield, ShieldCheck,
  Star, Trash2, TrendingUp, Users, BarChart3, CheckCircle2, XCircle,
  Sparkles, ChevronDown, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import toast from "react-hot-toast"

type Tab = "overview" | "users" | "properties" | "inquiries"

interface AdminStats {
  totalUsers: number
  totalProperties: number
  activeProperties: number
  totalInquiries: number
  totalFavorites: number
  verifiedProperties: number
  featuredProperties: number
  portfolioValue: number
  usersByRole: Record<string, number>
  recentProperties: any[]
  recentUsers: any[]
}

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  createdAt: string
  _count: { properties: number; favorites: number; inquiries: number }
}

interface AdminProperty {
  id: string
  title: string
  price: number
  city: string
  propertyType: string
  status: string
  verified: boolean
  featured: boolean
  createdAt: string
  owner: { id: string; name: string | null; email: string | null; role: string }
  _count: { favorites: number; inquiries: number }
}

function formatCurrency(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  return `₹${amount.toLocaleString("en-IN")}`
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("overview")
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [statsRes, usersRes, propsRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/users"),
          fetch("/api/admin/properties"),
        ])
        const statsData = await statsRes.json()
        const usersData = await usersRes.json()
        const propsData = await propsRes.json()

        if (statsData.success) setStats(statsData.data)
        if (usersData.success) setUsers(usersData.data)
        if (propsData.success) setProperties(propsData.data)
      } catch {
        toast.error("Failed to load admin data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
        toast.success("Role updated")
      } else {
        toast.error(data.error || "Failed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const handleToggleVerify = async (propertyId: string, verified: boolean) => {
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified }),
      })
      const data = await res.json()
      if (data.success) {
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, verified } : p))
        )
        toast.success(verified ? "Property verified" : "Verification removed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const handleToggleFeatured = async (propertyId: string, featured: boolean) => {
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured }),
      })
      const data = await res.json()
      if (data.success) {
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, featured } : p))
        )
        toast.success(featured ? "Property featured" : "Feature removed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm("Are you sure you want to permanently remove this property?")) return
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setProperties((prev) => prev.filter((p) => p.id !== propertyId))
        toast.success("Property removed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Delete this user and all their data? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        toast.success("User deleted")
      } else {
        toast.error(data.error || "Failed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "properties", label: "Properties", icon: Building2 },
    { id: "inquiries", label: "Inquiries", icon: MessageSquare },
  ]

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "bg-purple-100 text-purple-700",
      AGENT: "bg-blue-100 text-blue-700",
      BUILDER: "bg-amber-100 text-amber-700",
      USER: "bg-gray-100 text-gray-600",
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colors[role] || colors.USER}`}>
        {role}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#50080E]">
            <Shield className="h-6 w-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="heading-serif text-3xl text-[#50080E] sm:text-4xl">Admin Panel</h1>
            <p className="text-sm text-[#72383D]/60">Platform moderation & management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-xl border border-[#DCCDCE]/40 bg-white p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-[#50080E] text-white shadow"
                  : "text-[#72383D]/60 hover:bg-[#F5F4F1] hover:text-[#50080E]"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : (
          <div className="mt-8">
            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && stats && (
              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
                    { label: "Properties", value: stats.totalProperties, icon: Building2, color: "text-emerald-600" },
                    { label: "Inquiries", value: stats.totalInquiries, icon: MessageSquare, color: "text-purple-600" },
                    { label: "Portfolio Value", value: formatCurrency(stats.portfolioValue), icon: TrendingUp, color: "text-[#D4AF37]" },
                  ].map((s) => (
                    <Card key={s.label} className="border-[#DCCDCE]/40 bg-white p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F4F1]">
                          <s.icon className={`h-5 w-5 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-xs text-[#72383D]/50">{s.label}</p>
                          <p className="text-xl font-bold text-[#50080E]">{s.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Active", value: stats.activeProperties, icon: CheckCircle2, color: "text-emerald-600" },
                    { label: "Verified", value: stats.verifiedProperties, icon: ShieldCheck, color: "text-blue-600" },
                    { label: "Featured", value: stats.featuredProperties, icon: Sparkles, color: "text-[#D4AF37]" },
                    { label: "Total Saves", value: stats.totalFavorites, icon: Heart, color: "text-red-500" },
                  ].map((s) => (
                    <Card key={s.label} className="border-[#DCCDCE]/40 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-xs text-[#72383D]/50">{s.label}</span>
                        <span className="ml-auto text-lg font-bold text-[#50080E]">{s.value}</span>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* User role breakdown */}
                <Card className="border-[#DCCDCE]/40 bg-white p-6">
                  <h3 className="mb-4 text-lg font-bold text-[#50080E]">Users by Role</h3>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {["USER", "AGENT", "BUILDER", "ADMIN"].map((role) => (
                      <div key={role} className="rounded-xl bg-[#F5F4F1] p-4 text-center">
                        <p className="text-2xl font-bold text-[#50080E]">{stats.usersByRole[role] || 0}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-[#72383D]/50">{role}s</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Recent activity */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-[#DCCDCE]/40 bg-white p-6">
                    <h3 className="mb-4 text-lg font-bold text-[#50080E]">Recent Properties</h3>
                    <div className="space-y-3">
                      {stats.recentProperties.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#DCCDCE]/20 p-3">
                          <div>
                            <p className="text-sm font-semibold text-[#50080E]">{p.title}</p>
                            <p className="text-xs text-[#72383D]/50">{p.city} · {formatCurrency(p.price)}</p>
                          </div>
                          <p className="text-[10px] text-[#72383D]/40">{new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="border-[#DCCDCE]/40 bg-white p-6">
                    <h3 className="mb-4 text-lg font-bold text-[#50080E]">Recent Users</h3>
                    <div className="space-y-3">
                      {stats.recentUsers.map((u: any) => (
                        <div key={u.id} className="flex items-center justify-between rounded-xl border border-[#DCCDCE]/20 p-3">
                          <div>
                            <p className="text-sm font-semibold text-[#50080E]">{u.name || "—"}</p>
                            <p className="text-xs text-[#72383D]/50">{u.email}</p>
                          </div>
                          {roleBadge(u.role)}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ── USERS TAB ── */}
            {tab === "users" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#72383D]/60">{users.length} users total</p>
                </div>
                <Card className="overflow-hidden border-[#DCCDCE]/40 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#DCCDCE]/30 bg-[#F5F4F1]">
                        <tr>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">User</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Role</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Properties</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Joined</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCCDCE]/20">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-[#F5F4F1]/50 transition">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#902941] text-xs font-bold text-white">
                                  {user.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div>
                                  <p className="font-semibold text-[#50080E]">{user.name || "—"}</p>
                                  <p className="text-xs text-[#72383D]/50">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                className="rounded-lg border border-[#DCCDCE]/40 bg-white px-2 py-1 text-xs font-medium text-[#50080E] outline-none focus:border-[#D4AF37]/50"
                              >
                                {["USER", "AGENT", "BUILDER", "ADMIN"].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4 text-sm text-[#50080E]">{user._count.properties}</td>
                            <td className="px-5 py-4 text-xs text-[#72383D]/50">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 rounded-lg border-red-200 text-xs text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── PROPERTIES TAB ── */}
            {tab === "properties" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#72383D]/60">{properties.length} properties total</p>
                </div>
                <Card className="overflow-hidden border-[#DCCDCE]/40 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#DCCDCE]/30 bg-[#F5F4F1]">
                        <tr>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Property</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Owner</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Price</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Status</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Verified</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Featured</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCCDCE]/20">
                        {properties.map((p) => (
                          <tr key={p.id} className="hover:bg-[#F5F4F1]/50 transition">
                            <td className="px-5 py-4">
                              <div>
                                <p className="font-semibold text-[#50080E] line-clamp-1">{p.title}</p>
                                <p className="text-xs text-[#72383D]/50">{p.city} · {p.propertyType}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-xs text-[#50080E]">{p.owner.name || "—"}</p>
                              {roleBadge(p.owner.role)}
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-[#50080E]">
                              {formatCurrency(p.price)}
                            </td>
                            <td className="px-5 py-4">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : p.status === "SOLD"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => handleToggleVerify(p.id, !p.verified)}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                                  p.verified
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                              >
                                {p.verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                {p.verified ? "Yes" : "No"}
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => handleToggleFeatured(p.id, !p.featured)}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                                  p.featured
                                    ? "bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                              >
                                <Star className={`h-3 w-3 ${p.featured ? "fill-current" : ""}`} />
                                {p.featured ? "Yes" : "No"}
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 rounded-lg border-red-200 text-xs text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteProperty(p.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ── INQUIRIES TAB (placeholder for future) ── */}
            {tab === "inquiries" && (
              <Card className="border-[#DCCDCE]/40 bg-white p-12 text-center">
                <MessageSquare className="mx-auto mb-4 h-12 w-12 text-[#DCCDCE]" />
                <h3 className="text-lg font-bold text-[#50080E]">Inquiry Management</h3>
                <p className="mt-2 text-sm text-[#72383D]/50">
                  View and respond to property inquiries. Coming in Phase 3 with email integration.
                </p>
                <p className="mt-4 text-3xl font-bold text-[#D4AF37]">
                  {stats?.totalInquiries || 0}
                </p>
                <p className="text-xs text-[#72383D]/50">total inquiries received</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
