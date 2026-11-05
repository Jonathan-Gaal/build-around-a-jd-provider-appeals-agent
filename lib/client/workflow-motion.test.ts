// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkflowHighlight, WorkflowNotice, WorkflowPanel, WorkflowReveal, WorkflowStatus } from "../../components/workflow-motion";

let reduced = true;
const changes = new EventTarget();
Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({
  get matches() { return reduced; }, media: "(prefers-reduced-motion: reduce)", onchange: null,
  addEventListener: (type: string, listener: EventListener) => changes.addEventListener(type, listener),
  removeEventListener: (type: string, listener: EventListener) => changes.removeEventListener(type, listener),
  addListener: (listener: EventListener) => changes.addEventListener("change", listener),
  removeListener: (listener: EventListener) => changes.removeEventListener("change", listener),
}) });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
let container: HTMLDivElement, root: Root;
beforeEach(() => { reduced = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(() => root.unmount()); container.remove(); });

describe("workflow feedback accessibility", () => {
  it("uses the real reduced-motion preference and updates when that preference changes", async () => {
    await act(() => root.render(h(WorkflowNotice, { eventKey: "pending", children: "Waiting for the server" })));
    expect(container.querySelector("[data-motion=reduced]")).not.toBeNull();
    expect(container.textContent).toBe("Waiting for the server");
    await act(() => { reduced = false; changes.dispatchEvent(new Event("change")); });
    expect(container.querySelector("[data-motion=standard]")).not.toBeNull();
    await act(() => { reduced = true; changes.dispatchEvent(new Event("change")); });
    expect(container.querySelector("[data-motion=reduced]")).not.toBeNull();
  });
  it("replaces an agent status immediately without retaining an old success or stealing focus", async () => {
    const render = (state: string) => h("div", {}, h("button", { id: "retry" }, "Retry"), h(WorkflowStatus, { label: "Quality", state, children: state }));
    await act(() => root.render(render("Complete")));
    const button = container.querySelector<HTMLButtonElement>("button")!; button.focus();
    await act(() => root.render(render("Failed")));
    expect(container.querySelector("[role=status]")?.textContent).toBe("Quality: Failed");
    expect(container.textContent).not.toContain("Complete");
    expect(document.activeElement).toBe(button);
    const node = container.querySelector("[data-state=Failed]");
    await act(() => root.render(render("Failed")));
    expect(container.querySelector("[data-state=Failed]")).toBe(node);
  });
  it("keeps the exact source quotation and reading controls intact across passage changes", async () => {
    const quote = "Exact synthetic source quote.";
    const render = (key: string) => h("div", {}, h("button", {}, "Passage 2"), h(WorkflowHighlight, { passageKey: key, children: quote }));
    await act(() => root.render(render("p1")));
    const button = container.querySelector<HTMLButtonElement>("button")!; button.focus();
    await act(() => root.render(render("p2")));
    expect(container.querySelector("mark")?.textContent).toBe(quote);
    expect(document.activeElement).toBe(button);
    expect(container.querySelector("mark")?.style.opacity).toBe("1");
  });
  it("retains a resolved issue and renders a critical invalidation banner immediately", async () => {
    await act(() => root.render(h("div", {}, h(WorkflowPanel, { name: "issue", state: "resolved", id: "i1", children: "Resolved with original source" }), h(WorkflowNotice, { name: "approval-invalidated", eventKey: "packet-v3", children: "Fresh clinician review required" }))));
    expect(container.querySelector("#i1")?.textContent).toContain("Resolved");
    expect(container.querySelector("[role=status]")?.textContent).toBe("Fresh clinician review required");
    expect(container.querySelector<HTMLElement>("[data-workflow-motion=approval-invalidated]")?.style.opacity).toBe("1");
  });
  it("reveals a receipt without changing a disabled approval button or its checked state", async () => {
    await act(() => root.render(h("div", {}, h("input", { type: "checkbox", checked: false, readOnly: true }), h("button", { disabled: true }, "Sign off unavailable"), h(WorkflowReveal, { name: "signoff-receipt", eventKey: "approval-id", children: "Exact packet hash" }))));
    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(container.querySelector("input")?.checked).toBe(false);
    expect(container.querySelector<HTMLElement>("[data-workflow-motion=signoff-receipt]")?.style.opacity).toBe("1");
  });
});
