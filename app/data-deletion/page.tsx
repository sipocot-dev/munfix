import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import { MUNICIPALITY } from "@/lib/config";

export const metadata: Metadata = { title: "Data deletion" };

export default function Page() {
  const M = MUNICIPALITY.name;
  const P = MUNICIPALITY.province;
  return (
    <article className="container-page container-narrow">
      <PageHeader eyebrow={`MunFix ${M}`} title="Data deletion" />
      <div className="card prose-civic p-6 sm:p-8">
        {/* eslint-disable react/no-unescaped-entities */}
        
<p>You control your MunFix data.</p>
<h2>Delete it yourself</h2>
<ol>
<li>Log in (with email, Google or Facebook).</li>
<li>Open <a href="/account">My account</a> and choose <strong>Delete my account</strong>.</li>
<li>Type DELETE to confirm.</li>
</ol>
<p>Your name, email and sign-in connections are removed immediately and you are signed out everywhere. Reports still awaiting review are withdrawn. Reports already published remain as public records without any link to you.</p>
<h2>Can&apos;t log in?</h2>
<p>Contact the site administrator from the same email address you registered with and ask for deletion; we will process it manually.</p>
<h2>Facebook and Google</h2>
<p>Deleting your account here removes the data we hold. To also remove MunFix from your Facebook or Google account, remove the app in that provider&apos;s security settings.</p>
      </div>
    </article>
  );
}
