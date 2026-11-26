import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import AuthShell from "@/components/AuthShell";
import { safeNext } from "@/lib/client";
import { enabledProviders, OAUTH_ERRORS } from "@/lib/oauth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSession()) redirect(safeNext(next));
  return (
    <AuthShell title="Create your account" description="It's free. You need an account to submit reports and get updates.">
      <AuthForm mode="register" next={next} providers={enabledProviders()} notice={error ? OAUTH_ERRORS[error] : undefined} />
    </AuthShell>
  );
}
