import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { safeNext } from "@/lib/client";
import { enabledProviders, OAUTH_ERRORS } from "@/lib/oauth";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSession()) redirect(safeNext(next));
  return <AuthForm mode="login" next={next} providers={enabledProviders()} notice={error ? OAUTH_ERRORS[error] : undefined} />;
}
