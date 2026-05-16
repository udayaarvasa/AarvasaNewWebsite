"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Building2, Heart, Loader2, Plus, Trash2, Edit, TrendingUp,
  LayoutDashboard, Sparkles, Star, BarChart3, UserCircle, Save, KeyRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DbPropertyCard } from "@/components/property/db-property-card"
import type { PropertyListing } from "@/types/property"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/properties"

type Tab = "overview" | "properties" | "favorites" | "account"

interface Stats {
  total: number
  active: number
  favorites: number
}

export function DashboardView({ userName, userRole }: { userName: string; userRole: string }) {
  const [tab, setTab] = useState<Tab>("overview")
  const [myProperties, setMyProperties] = useState<PropertyListing[]>([])
  const [favProperties, setFavProperties] = useState<PropertyListing[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, favorites: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [propsRes, favsRes] = await Promise.all([
          fetch("/api/user/properties"),
          fetch("/api/favorites"),
        ])
        const propsData = await propsRes.json()
        const favsData = await favsRes.json()
        if (propsData.success) {
          setMyProperties(propsData.data.properties)
          setStats(propsData.data.stats)
        }
        if (favsData.success) setFavProperties(favsData.data)
      } catch {
        console.error("Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setMyProperties((prev) => prev.filter((p) => p.id !== id))
        setStats((prev) => ({ ...prev, total: prev.total - 1, active: prev.active - 1 }))
        toast.success("Property deleted")
      } else {
        toast.error(data.error || "Delete failed")
      }
    } catch {
      toast.error("Something went wrong")
    }
  }

  const totalValue = myProperties.reduce((sum, p) => sum + p.price, 0)
  const avgRoi = myProperties.length
    ? myProperties.reduce((sum, p) => sum + p.roi, 0) / myProperties.length
    : 0

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "properties", label: "My Properties", icon: Building2 },
    { id: "favorites", label: "Saved", icon: Heart },
    { id: "account", label: "Account", icon: UserCircle },
  ]

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h1 className="heading-serif text-3xl text-[#50080E] sm:text-4xl">
              Welcome back, {userName}
            </h1>
            <p className="mt-1 text-sm text-[#72383D]/60">
              {userRole === "ADMIN" ? "Administrator" : userRole === "AGENT" ? "Verified Agent" : "Investor"} Dashboard
            </p>
          </div>
          <Button asChild variant="gold" size="sm" className="gap-2 rounded-lg">
            <Link href="/properties/create">
              <Plus className="h-4 w-4" /> List Property
            </Link>
          </Button>
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
            {tab === "overview" && (
              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-4">
                  {[
                    { label: "Total Listings", value: stats.total, icon: Building2 },
                    { label: "Active", value: stats.active, icon: TrendingUp },
                    { label: "Total Saves", value: stats.favorites, icon: Star },
                    { label: "Portfolio Value", value: formatCurrency(totalValue), icon: BarChart3 },
                  ].map((s) => (
                    <Card key={s.label} className="border-[#DCCDCE]/40 bg-white p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                          <s.icon className="h-5 w-5 text-[#D4AF37]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#72383D]/50">{s.label}</p>
                          <p className="text-xl font-bold text-[#50080E]">{s.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {myProperties.length > 0 ? (
                  <div>
                    <h2 className="mb-4 text-lg font-bold text-[#50080E]">Recent Listings</h2>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {myProperties.slice(0, 3).map((p) => (
                        <DbPropertyCard key={p.id} property={p} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <Card className="border-[#DCCDCE]/40 bg-white p-12 text-center">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-[#DCCDCE]" />
                    <h3 className="text-lg font-bold text-[#50080E]">No properties yet</h3>
                    <p className="mt-2 text-sm text-[#72383D]/50">
                      Start by creating your first listing.
                    </p>
                    <Button asChild variant="gold" size="sm" className="mt-4 gap-2 rounded-lg">
                      <Link href="/properties/create">
                        <Plus className="h-4 w-4" /> Create Listing
                      </Link>
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* ── MY PROPERTIES TAB ── */}
            {tab === "properties" && (
              <div>
                {myProperties.length === 0 ? (
                  <Card className="border-[#DCCDCE]/40 bg-white p-12 text-center">
                    <Building2 className="mx-auto mb-4 h-12 w-12 text-[#DCCDCE]" />
                    <h3 className="text-lg font-bold text-[#50080E]">No properties listed</h3>
                    <Button asChild variant="gold" size="sm" className="mt-4 gap-2 rounded-lg">
                      <Link href="/properties/create">
                        <Plus className="h-4 w-4" /> Create Listing
                      </Link>
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {myProperties.map((p) => (
                      <Card key={p.id} className="flex flex-col gap-4 border-[#DCCDCE]/40 bg-white p-5 sm:flex-row sm:items-center">
                        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={p.images[0] || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200&q=60"}
                            alt={p.title} fill className="object-cover" sizes="112px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/property/${p.id}`} className="font-bold text-[#50080E] hover:text-[#D4AF37] transition">
                            {p.title}
                          </Link>
                          <p className="text-xs text-[#72383D]/50">{p.location} · {p.city}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <span className="font-semibold text-[#50080E]">{formatCurrency(p.price)}</span>
                            {p.roi > 0 && <span className="text-emerald-600">{p.roi}% ROI</span>}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                            }`}>{p.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm" className="gap-1 rounded-lg text-xs">
                            <Link href={`/properties/edit/${p.id}`}><Edit className="h-3 w-3" /> Edit</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 rounded-lg border-red-200 text-xs text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(p.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FAVORITES TAB ── */}
            {tab === "favorites" && (
              <div>
                {favProperties.length === 0 ? (
                  <Card className="border-[#DCCDCE]/40 bg-white p-12 text-center">
                    <Heart className="mx-auto mb-4 h-12 w-12 text-[#DCCDCE]" />
                    <h3 className="text-lg font-bold text-[#50080E]">No saved properties</h3>
                    <p className="mt-2 text-sm text-[#72383D]/50">
                      Browse listings and save properties you're interested in.
                    </p>
                    <Button asChild variant="gold" size="sm" className="mt-4 gap-2 rounded-lg">
                      <Link href="/listings">
                        <Sparkles className="h-4 w-4" /> Explore Listings
                      </Link>
                    </Button>
                  </Card>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {favProperties.map((p) => (
                      <DbPropertyCard key={p.id} property={p} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ACCOUNT TAB ── */}
            {tab === "account" && (
              <AccountSettings userName={userName} userRole={userRole} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Account Settings Sub-component ────────────────────────────────────────────

const inputClass = "w-full rounded-xl border border-[#DCCDCE]/50 bg-white px-4 py-3 text-sm text-[#50080E] outline-none transition placeholder:text-[#72383D]/30 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/10"

function AccountSettings({ userName, userRole }: { userName: string; userRole: string }) {
  const [profile, setProfile] = useState({ name: userName, phone: "", bio: "" })
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" })
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile")
        const data = await res.json()
        if (data.success) {
          setProfile({
            name: data.data.name || "",
            phone: data.data.phone || "",
            bio: data.data.bio || "",
          })
        }
      } catch {
        // Fallback to passed-in userName
      } finally {
        setLoadingProfile(false)
      }
    }
    loadProfile()
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (data.success) toast.success("Profile updated")
      else toast.error(data.error || "Update failed")
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error("Fill in both password fields")
      return
    }
    if (passwords.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    setChangingPw(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Password changed")
        setPasswords({ currentPassword: "", newPassword: "" })
      } else {
        toast.error(data.error || "Failed")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setChangingPw(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Profile Details */}
      <Card className="border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-[#50080E]">
          <UserCircle className="h-5 w-5 text-[#D4AF37]" />
          Profile Details
        </h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#50080E]/80">Full Name</label>
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#50080E]/80">Phone</label>
            <input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className={inputClass}
              placeholder="+91 ..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[#50080E]/80">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className={inputClass + " resize-none"}
              placeholder="Tell us about yourself..."
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-[#72383D]/40">
            Role: <span className="font-semibold uppercase">{userRole}</span>
          </p>
          <Button
            variant="gold"
            size="sm"
            className="gap-2 rounded-lg"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 flex items-center gap-2 text-lg font-bold text-[#50080E]">
          <KeyRound className="h-5 w-5 text-[#D4AF37]" />
          Change Password
        </h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#50080E]/80">Current Password</label>
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#50080E]/80">New Password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className={inputClass}
              placeholder="Minimum 8 characters"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-lg"
            onClick={handleChangePassword}
            disabled={changingPw}
          >
            {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {changingPw ? "Changing..." : "Update Password"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
