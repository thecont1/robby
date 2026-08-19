/**
 * ROBBY VISUAL SYSTEM — Contact-sheet archaeology.
 * The manual reads like an indexed conservation note: an extendable current
 * language record, with every entry grounded in the Rust validator contract.
 */

import { languageReference, minimalExample } from "@/lib/languageReference";
import { ArrowLeft, BookOpen, Download, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function Manual() {
  return (
    <main className="manual-page">
      <header className="site-header manual-header">
        <Link className="brand-lockup" href="/">
          <img src="/icons/robby-registration-mark_658aceee.png" alt="robby split registration disc" />
          <span>robby<span className="brand-suffix">/ v1</span></span>
        </Link>
        <div className="header-center"><BookOpen size={14} /><span className="header-kicker">Language reference · v0.1</span></div>
        <div className="header-actions">
          <a className="source-download" href="https://github.com/thecont1/robby/archive/refs/heads/dev/ananya.zip" target="_blank" rel="noreferrer"><Download size={13} strokeWidth={2.5} /> DOWNLOAD RUST SOURCE</a>
          <Link className="manual-back" href="/"><ArrowLeft size={13} /> RETURN TO GALLERY</Link>
        </div>
      </header>

      <section className="manual-hero">
        <p className="eyebrow"><span className="product-name">robby</span> language reference · v0.1</p>
        <h1>Small language.<br /><em>Two-sided evidence.</em></h1>
        <div className="manual-intro-copy">
          <p><strong className="product-name">robby</strong> is a small visual-composition language. A script names an obverse image, declares its transformations, and requires an inverse that can be read as evidence rather than decoration.</p>
          <p>This reference reflects the current Rust validator. It is a living index: add a command in Rust, then add its entry here.</p>
        </div>
      </section>

      <section className="manual-example" aria-labelledby="minimal-example-title">
        <div><span className="mono-label">Minimal end-to-end script</span><h2 id="minimal-example-title">A palette audit from one source image.</h2></div>
        <pre><code>{minimalExample}</code></pre>
      </section>

      <section className="manual-index" aria-label="robby command reference">
        <div className="manual-index-rail"><span className="mono-label">Command index</span><ol>{languageReference.map((command, index) => <li key={command.name}><a href={`#${command.name}`}>{String(index + 1).padStart(2, "0")} · {command.name}</a></li>)}</ol></div>
        <div className="manual-commands">
          {languageReference.map((command, index) => (
            <article className="manual-command" id={command.name} key={command.name}>
              <div className="manual-command-mark"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
              <div className="manual-command-body">
                <div className="manual-command-title"><h2>{command.name}</h2><span>{command.notes ?? "current v0.1 command"}</span></div>
                <p className="manual-description">{command.description}</p>
                <pre className="syntax-signature"><code>{command.syntax}</code></pre>
                <div className="parameter-table-wrap"><table><thead><tr><th>Parameter</th><th>Type / values</th><th>Required</th><th>Rule</th></tr></thead><tbody>{command.parameters.map((parameter) => <tr key={parameter.name}><td><code>{parameter.name}</code></td><td>{parameter.type}</td><td>{parameter.required ? "yes" : "optional"}</td><td>{parameter.detail}</td></tr>)}</tbody></table></div>
                <div className="manual-real-example"><span className="mono-label">Real specimen example</span><pre><code>{command.example}</code></pre></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="manual-footer"><span>Source of truth: Rust validator and IR lowerer.</span><a href="https://github.com/thecont1/robby/tree/dev/ananya" target="_blank" rel="noreferrer">Inspect Rust source <ExternalLink size={12} /></a></footer>
    </main>
  );
}
