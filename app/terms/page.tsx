import type { Metadata } from "next";
import { MUNICIPALITY } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of use" };

export default function Page() {
  const M = MUNICIPALITY.name;
  const P = MUNICIPALITY.province;
  return (
    <article className="legal mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Terms of use</h1>
      <div className="mt-6 space-y-4 text-slate-700 [&_a]:font-semibold [&_a]:text-teal-700 [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-slate-900 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {/* eslint-disable react/no-unescaped-entities */}
        
<p>By using MunFix for {M}, {P} you agree to these terms.</p>
<ul>
<li>Report real problems in good faith. Do not submit false, abusive, harassing or unlawful content, or personal information about others.</li>
<li>Only upload photos you have the right to share. Photos may be shown publicly once a report is verified.</li>
<li>City staff may verify, reject, merge or remove reports at their discretion. Submitting a report does not guarantee that work will be done or by when.</li>
<li>MunFix is not an emergency service. In an emergency, contact local emergency services directly.</li>
<li>Keep your login secure. Accounts that abuse the service may be deactivated.</li>
<li>The service is provided as is, without warranty. Terms may change; continued use means you accept the current version.</li>
</ul>
      </div>
    </article>
  );
}
