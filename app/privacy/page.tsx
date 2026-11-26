import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import { MUNICIPALITY } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  const M = MUNICIPALITY.name;
  const P = MUNICIPALITY.province;
  return (
    <article className="container-page container-narrow">
      <PageHeader eyebrow={`MunFix ${M}`} title="Privacy policy" />
      <div className="card prose-civic p-6 sm:p-8">
        {/* eslint-disable react/no-unescaped-entities */}
        
<p>MunFix is a community civic reporting platform for {M}, {P}. This policy explains what we collect and why.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Account details</strong>: your name and email address, and a password hash if you sign up with a password. If you sign in with Google or Facebook, we receive your name, email address and provider account ID. We never receive your provider password and do not post on your behalf.</li>
<li><strong>Reports</strong>: the title, description, category, map location, photos you upload and the status history of each report.</li>
<li><strong>Technical data</strong>: a session cookie that keeps you signed in, and short-lived records used to limit abuse (for example, login attempts per IP address).</li>
</ul>
<h2>How we use it</h2>
<p>To run the service: show reports on the public map, let you follow your own reports, email you about status changes or password resets if email is enabled, and let authorised city staff review and resolve reports. We do not sell your data and do not use advertising trackers.</p>
<h2>What is public</h2>
<p>A report is public as soon as you submit it: its title, description, photos, location and status timeline are visible to everyone. Moderators can hide reports, which removes them from public view. Your name and email are not shown publicly. Do not include personal information in report text or photos.</p>
<h2>Who can see your data</h2>
<p>Moderators and administrators can see who submitted a report. Field staff see published reports without reporter details.</p>
<h2>Retention and deletion</h2>
<p>You can delete your account at any time from <a href="/account">My account</a>; see <a href="/data-deletion">data deletion</a>. Published reports remain as public records without your name.</p>
<h2>Contact</h2>
<p>Questions about your data: contact the {M} municipal office or the site administrator.</p>
      </div>
    </article>
  );
}
