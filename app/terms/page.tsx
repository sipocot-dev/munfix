import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import { MUNICIPALITY } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of use" };

export default function Page() {
  const M = MUNICIPALITY.name;
  const P = MUNICIPALITY.province;
  return (
    <article className="container-page container-narrow">
      <PageHeader eyebrow={`MunFix ${M}`} title="Terms of use" />
      <div className="card prose-civic p-6 sm:p-8">
        {/* eslint-disable react/no-unescaped-entities */}
        
<p>By using MunFix for {M}, {P} you agree to these terms.</p>
<ul>
<li>Report real problems in good faith. Do not submit false, abusive, harassing or unlawful content, or personal information about others.</li>
<li>Only upload photos you have the right to share. Reports, including their photos, are public as soon as you submit them.</li>
<li>Moderators may hide, reject, merge or remove reports at their discretion. Submitting a report does not guarantee that work will be done or by when.</li>
<li>MunFix is not an emergency service. In an emergency, contact local emergency services directly.</li>
<li>Keep your login secure. Accounts that abuse the service may be deactivated.</li>
<li>The service is provided as is, without warranty. Terms may change; continued use means you accept the current version.</li>
</ul>
      </div>
    </article>
  );
}
