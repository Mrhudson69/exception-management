import { useState } from "react";
import { PageHeader, Icon } from "../components/ui";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "ingest", label: "Sending Errors" },
  { id: "fields", label: "Payload Fields" },
  { id: "examples", label: "Code Examples" },
  { id: "alerts", label: "Alerts & Escalations" },
  { id: "roles", label: "Roles" },
];

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 icon-btn opacity-0 group-hover:opacity-100"
      >
        <Icon name={copied ? "check" : "content_copy"} size={16} />
      </button>
      <pre className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 text-code-md font-mono text-on-surface-variant overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}

export default function Docs() {
  return (
    <div>
      <PageHeader eyebrow="Help" title="Documentation" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-gutter">
        <nav className="hidden lg:block">
          <div className="glass-panel rounded-xl p-2 sticky top-0">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block px-3 py-2 rounded-lg text-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors">{s.label}</a>
            ))}
          </div>
        </nav>

        <div className="lg:col-span-3 space-y-gutter">
          <section id="overview" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-2">Overview</h2>
            <p className="text-body-md text-on-surface-variant">
              OpsConsole is a centralized exception management platform. Every application sends its errors to a single
              endpoint — <code className="font-mono text-primary">POST /ingest</code>. The platform identifies the source
              application, auto-categorizes severity and type, stores the event in Elasticsearch, and evaluates alert
              thresholds, routing notifications to the responsible team.
            </p>
          </section>

          <section id="ingest" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-3">Sending Errors</h2>
            <p className="text-body-md text-on-surface-variant mb-3">Point any application at the ingest endpoint. Authenticate either with the application's <b>ingest key</b> (recommended) via the <code className="font-mono text-primary">X-Api-Key</code> header, or by sending the <code className="font-mono text-primary">app</code> slug/name in the body. Unknown apps are auto-registered so nothing is dropped.</p>
            <Code>{`POST /ingest
X-Api-Key: <application ingest key>
Content-Type: application/json

{
  "app": "payment-gateway-us",
  "type": "NullReferenceException",
  "message": "Object reference not set",
  "stack": "...",
  "severity": "critical",
  "environment": "production",
  "host": "prod-web-04",
  "userId": "user_123",
  "tags": { "region": "us-east-1" }
}`}</Code>
          </section>

          <section id="fields" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-3">Payload Fields</h2>
            <table className="w-full text-left">
              <thead><tr className="border-b border-outline-variant">
                <th className="py-2 text-label-caps text-on-surface-variant uppercase">Field</th>
                <th className="py-2 text-label-caps text-on-surface-variant uppercase">Required</th>
                <th className="py-2 text-label-caps text-on-surface-variant uppercase">Description</th>
              </tr></thead>
              <tbody className="text-body-sm">
                {[
                  ["message", "yes", "The error message."],
                  ["app / appSlug", "yes*", "App slug or name. *Optional if X-Api-Key is sent."],
                  ["type", "no", "Exception/error class. Defaults to \"Error\"."],
                  ["severity", "no", "info | warning | error | critical. Auto-inferred if omitted."],
                  ["stack", "no", "Stack trace text."],
                  ["environment", "no", "production | staging | development."],
                  ["host", "no", "Hostname / machine that produced the error."],
                  ["userId", "no", "Affected user/account identifier."],
                  ["tags", "no", "Arbitrary key/value metadata object."],
                ].map(([f, r, d]) => (
                  <tr key={f} className="border-b border-outline-variant/30">
                    <td className="py-2 font-mono text-primary">{f}</td>
                    <td className="py-2 text-on-surface-variant">{r}</td>
                    <td className="py-2 text-on-surface">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="examples" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-3">Code Examples</h2>
            <p className="text-body-sm text-on-surface-variant mb-2">Node.js</p>
            <Code>{`await fetch("https://your-host/ingest", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Api-Key": process.env.OPS_KEY },
  body: JSON.stringify({ type: err.name, message: err.message, stack: err.stack }),
});`}</Code>
            <p className="text-body-sm text-on-surface-variant mb-2 mt-4">cURL</p>
            <Code>{`curl -X POST https://your-host/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: <key>" \\
  -d '{"type":"TimeoutError","message":"DB timeout"}'`}</Code>
          </section>

          <section id="alerts" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-2">Alerts & Escalations</h2>
            <p className="text-body-md text-on-surface-variant">
              Define <b>Thresholds</b> (error count, error rate, or new error type over a time window). When breached,
              an alert is raised and routed to the application's <b>Notification Group</b>. <b>Escalation Policies</b> add
              ordered steps that notify additional groups if an alert stays unacknowledged. Configure channels (Slack,
              Teams, Email, Webhook) under <b>Settings</b>.
            </p>
          </section>

          <section id="roles" className="glass-panel rounded-xl p-6">
            <h2 className="text-title-sm text-on-surface mb-2">Roles</h2>
            <ul className="text-body-md text-on-surface-variant space-y-1 list-disc pl-5">
              <li><b className="text-error">Admin</b> — full access, including user management.</li>
              <li><b className="text-tertiary">Editor</b> — manage configuration; acknowledge/resolve alerts.</li>
              <li><b className="text-primary">Viewer</b> — read-only access to dashboards and logs.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
