import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgressSteps from "@/components/ProgressSteps";
import StatusBadge from "@/components/StatusBadge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import StatCard from "@/components/ui/StatCard";

const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el);

describe("StatCard", () => {
  it("shows a dash and says why when the value could not be loaded, never a zero", () => {
    const out = html(h(StatCard, { label: "Resolved", value: null }));
    expect(out).toContain("—");
    expect(out).toContain("Not available right now");
    expect(out).not.toMatch(/>0</);
  });
  it("shows a real zero as zero", () => {
    expect(html(h(StatCard, { label: "Resolved", value: 0 }))).toMatch(/>0</);
  });
});

describe("Alert", () => {
  it("errors interrupt (role=alert); other tones are polite; static notices are silent", () => {
    expect(html(h(Alert, { tone: "danger" }, "x"))).toContain('role="alert"');
    expect(html(h(Alert, { tone: "success" }, "x"))).toContain('role="status"');
    expect(html(h(Alert, { tone: "info", live: false }, "x"))).not.toContain("role=");
  });
});

describe("ProgressSteps", () => {
  it("marks the current step for assistive tech and says which steps are done", () => {
    const out = html(h(ProgressSteps, { status: "in_progress" }));
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
    expect(out).toContain("Published<span class=\"sr-only\"> (done)</span>");
    expect(out).toContain("In progress<span class=\"sr-only\"> (current step)</span>");
    expect(out).toContain("Resolved<span class=\"sr-only\"> (not yet)</span>");
  });
  it("puts reports under review at the first step", () => {
    expect(html(h(ProgressSteps, { status: "under_review" }))).toContain("Published<span class=\"sr-only\"> (current step)</span>");
  });
  it("renders nothing for statuses off the normal path", () => {
    expect(html(h(ProgressSteps, { status: "rejected" }))).toBe("");
    expect(html(h(ProgressSteps, { status: "hidden" }))).toBe("");
  });
});

describe("StatusBadge", () => {
  it("uses the accessible text colour and explains the status", () => {
    const out = html(h(StatusBadge, { status: "resolved" }));
    expect(out).toContain("Resolved");
    expect(out).toContain("--st:#166534");
    expect(out).toContain("--st-d:#86efac");
    expect(out).toContain("status-text");
    expect(out).toContain('title="Marked as fixed."');
  });
});

describe("FormField", () => {
  it("links the label and the hint to the control", () => {
    const out = html(h(FormField, { label: "Email", hint: "We never share it", children: h("input", { name: "email" }) }));
    const id = out.match(/<label for="([^"]+)"/)![1];
    const input = out.match(/<input[^>]*>/)![0];
    expect(input).toContain(`id="${id}"`);
    expect(input).toContain(`aria-describedby="${id}-hint"`);
    expect(out).toContain(`<p id="${id}-hint"`);
  });
  it("keeps an id the caller already set", () => {
    const out = html(h(FormField, { label: "Email", children: h("input", { id: "mine" }) }));
    expect(out).toContain('for="mine"');
    expect(out).toContain('id="mine"');
  });
});

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    const out = html(h(EmptyState, { title: "Nothing here", description: "Try later", action: h("a", { href: "/x" }, "Go") }));
    expect(out).toContain("Nothing here");
    expect(out).toContain("Try later");
    expect(out).toContain('href="/x"');
  });
});
