import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-28">
      <AuthForm mode="signup" />
    </main>
  );
}
