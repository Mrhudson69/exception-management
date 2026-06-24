import { FormEvent, useState } from "react";
import { PageHeader, Icon } from "../components/ui";
import { useToast } from "../components/Toast";

export default function Support() {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject || !message) {
      toast.error("Add a subject and a message.");
      return;
    }
    // In a real deployment this would POST to a ticketing system / email.
    toast.success("Support request submitted. We'll get back to you shortly.");
    setSent(true);
    setSubject("");
    setMessage("");
  }

  const links = [
    { icon: "menu_book", title: "Documentation", desc: "Ingest API, fields, alerts & roles", to: "/docs" },
    { icon: "forum", title: "Community", desc: "Ask questions and share setups", href: "https://github.com" },
    { icon: "bug_report", title: "Report a bug", desc: "File an issue with details", href: "https://github.com" },
  ];

  return (
    <div>
      <PageHeader eyebrow="Help" title="Support" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2 glass-panel rounded-xl p-6">
          <h2 className="text-title-sm text-on-surface mb-1">Contact support</h2>
          <p className="text-body-sm text-on-surface-variant mb-5">Describe your issue and our team will follow up by email.</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-label-caps text-on-surface-variant uppercase">Subject</span>
              <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label-caps text-on-surface-variant uppercase">Message</span>
              <textarea className="field" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's happening? Include app names, timestamps, and what you expected." />
            </label>
            <button type="submit" className="btn-primary"><Icon name="send" size={16} /> Submit request</button>
            {sent && <p className="text-body-sm text-primary flex items-center gap-1.5"><Icon name="check_circle" size={16} /> Your request was recorded.</p>}
          </form>
        </div>

        <div className="space-y-gutter">
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-title-sm text-on-surface mb-3">Resources</h3>
            <div className="space-y-2">
              {links.map((l) => (
                <a key={l.title} href={l.href ?? l.to} target={l.href ? "_blank" : undefined} rel="noreferrer"
                   className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-highest transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center"><Icon name={l.icon} className="text-primary" /></div>
                  <div>
                    <div className="text-body-md text-on-surface">{l.title}</div>
                    <div className="text-body-sm text-on-surface-variant">{l.desc}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-title-sm text-on-surface mb-3">System status</h3>
            <div className="flex items-center gap-2 text-body-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-on-surface">All systems operational</span>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-2">Platform v2.4.0-stable</p>
          </div>
        </div>
      </div>
    </div>
  );
}
