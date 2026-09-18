import { ArrowLeft, Braces, Coins, FileText, GitBranch, Images, ScanSearch } from "lucide-react";
import { Link } from "wouter";
import { briefSummaries, type BriefKind } from "@/lib/briefContent";

function BriefHeader({ kind }: { kind: BriefKind }) {
  const brief = briefSummaries[kind];
  return <header className="brief-header"><Link href="/" className="brief-back"><ArrowLeft size={14} /> Back to <span className="product-name">robby</span></Link><span>{brief.source}</span></header>;
}

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className="brief-section"><span className="brief-index">{index}</span><div><h2>{title}</h2>{children}</div></section>;
}

export function HackathonBrief() {
  const brief = briefSummaries.hackathon;
  return <main className="brief-page"><BriefHeader kind="hackathon" /><section className="brief-hero"><div><p className="brief-eyebrow">SegFault 2026 · Explainable compilers</p><h1><span className="product-name">robby</span> / reverse–obverse image duality compiler</h1><p className="brief-question">What if a digital image could be a two-sided image-object, like a postcard or a coin?</p></div><aside className="brief-mark"><Braces size={28} /><span>TEXTUAL DSL → VALIDATED IR → TWO FACES</span></aside></section><section className="brief-body"><Section index="01" title="The proposition"><p><span className="product-name">robby</span> compiles a short source program into an inspectable, deterministic reverse for one immutable obverse photograph. The two faces remain mutually exclusive, like the faces of a coin.</p></Section><Section index="02" title="The constraint"><p>The obverse is an opaque byte sequence plus an RGB matrix. The compiler may hash bytes and calculate flat colour statistics, but it never identifies, classifies, or assigns meaning to depicted content.</p></Section><Section index="03" title="The system"><p>The Rust compiler parses and validates four explicit stages, lowers them to versioned JSON IR, and runs the registered seed-driven renderer only when the viewer requests a flip.</p><pre>{`base("night-street.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "night-street.jpg", reverse: "transient", manifest: "transient")`}</pre></Section><Section index="04" title="The outputs"><div className="brief-output-grid"><article><Images size={18} /><strong>Obverse</strong><span>The original JPEG, unchanged.</span></article><article><ScanSearch size={18} /><strong>Reverse</strong><span>A transient PNG generated afresh for this flip.</span></article><article><GitBranch size={18} /><strong>Manifest</strong><span>Source, settings, seed, module, swatches, and output hashes.</span></article></div></Section><Section index="05" title="The practical stack"><p>One Rust library supplies the native CLI, browser WASM compiler, and deterministic renderer. The server invokes that native core and returns PNG bytes directly with a no-store response.</p></Section></section></main>;
}

export function ImageObjectBrief() {
  const brief = briefSummaries["image-object"];
  return (
    <main className="brief-page">
      <BriefHeader kind="image-object" />
      <section className="brief-hero concept-hero">
        <div>
          <p className="brief-eyebrow">MFA concept note · 2023</p>
          <h1>{brief.title}</h1>
          <p className="brief-question">
            A digital image becomes an image-object when its reverse is another image:
            related, distinct, and mutually exclusive in visibility.
          </p>
          <p className="brief-question brief-question-followup">
            The compiler becomes a way to <em>reassemble a fictional world more representative
            of reality than dull reality itself</em> — and to make that reassembly legible.
          </p>
        </div>
        <aside className="brief-mark">
          <Coins size={28} />
          <span>
            OBVERSE ↔ REVERSE
            <br />
            TWO FACES · ONE OBJECT
          </span>
        </aside>
      </section>
      <section className="brief-body">
        <Section index="01" title="When the JPEG forgot the other side">
          <p>
            Photographic prints, coins, and currency notes have sides. A print’s obverse may
            carry the picture, while its reverse carries stamps, edition information, and
            captions. The two-sided print transforms into an object greater than the sum of
            its parts. When the physical print gave way to the JPEG as the <em>de facto</em>
            carrier of the image to the screen, along with it went the obverse-reverse duality
            that for long we took for granted.
          </p>
        </Section>
        <Section index="02" title="A reverse is another image">
          <p>
            To bring that duality back, a redefinition is in order: the reverse of a digital
            obverse is another image, related but different, and mutually exclusive in
            visibility. Seen in this way, it becomes possible to programmatically implement
            such a feature — and to give the relation a shape the JPEG never had.
          </p>
        </Section>
        <Section index="03" title="Surrendering control to a compiler">
          <p>
            Pictures come from the process, and that process has always been technical for
            photographers. <span className="product-name">robby</span> extends that lineage:
            the author writes a short recipe, the compiler reads it, validates it, lowers it
            to canonical IR, and renders a deterministic reverse. Just as an algorithmic photo
            editor once told me where to go and what I could expect to find there,
            <span className="product-name">robby</span> picks apart the source — not what it
            depicts, but what it materially is — so that I can reassemble a fictional world
            more representative of reality than dull reality itself.
          </p>
        </Section>
        <Section index="04" title="Partial truths, inspectable mechanics">
          <p>
            The work should evolve into a whole truth comprised of partial truths, which is
            what photography is good at delivering. The manifest names the computational
            choices without pretending that software can supply a neutral reading of the
            photograph. Its evidence is deliberately limited: source bytes, declared settings,
            seed, module, runtime, and output hashes. Nothing else is claimed.
          </p>
        </Section>
        <Section index="05" title="A platform where the medium is the message">
          <p>
            There did not exist a platform where the medium itself would serve as the perfect
            message. <span className="product-name">robby</span> proposes one. The compiler’s
            working mechanism — the eight stages of the Teppanyaki Counter, the palette
            split, the binding — is the visible surface of the tool. What the viewer sees is
            not a simulation of compilation; it is compilation.
          </p>
        </Section>
        <Section index="06" title="At the confluence">
          <p>
            <span className="product-name">robby</span> sits at the confluence of visual
            theory, media studies, ethical technology, and human rights — with photography at
            the core. A photograph can stay private if it needs to. Its reverse can travel.
          </p>
        </Section>
        <footer className="brief-footer">
          <FileText size={16} />
          <span>{brief.source}</span>
        </footer>
      </section>
    </main>
  );
}
