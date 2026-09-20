import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { briefSummaries } from "@/lib/briefContent";
import { Braces, Coins, ExternalLink, FileText, Sparkles } from "lucide-react";

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className={index ? "brief-section" : "brief-section brief-section-full"}>{index ? <span className="brief-index">{index}</span> : null}<div><h2>{title}</h2>{children}</div></section>;
}

const COUNTER_CELLS: { index: string; title: string; body: string }[] = [
  { index: "00", title: "Intake", body: "The source JPEG arrives as nothing but bytes. robby hashes the file exactly as found — that SHA-256 becomes the anchor every later stage must agree with." },
  { index: "01", title: "Observe", body: "Credential inspection on the untouched bytes: C2PA manifests, signatures, signer chains. Provenance is only ever observed — it never marks the pixels." },
  { index: "02", title: "Measure", body: "The Rust intake decodes the RGB matrix and records structural facts — dimensions, orientation, MIME, a pixel digest. Still no interpretation: no labels, no faces, no meaning." },
  { index: "03", title: "Split", body: "Median-cut clustering collapses the photograph's colour material into a flat palette of size k. The recipe's k is a statement of granularity, not taste." },
  { index: "04", title: "Declare", body: "The recipe is lexed, parsed, and validated into versioned JSON IR. What you wrote is what compiled — the declared IR is inspectable before anything renders." },
  { index: "05", title: "Bind", body: "Rust welds the intake manifest, the recipe, the evidence selection, and the compiler version into one canonical binding digest. Change anything upstream and the binding changes." },
  { index: "06", title: "Resolve", body: "Only on request does the deterministic renderer turn the IR into a reverse image — same source, same recipe, same seed, same pixels, every time." },
  { index: "07", title: "Marry", body: "Obverse and reverse are paired into the image-object: one record, two mutually exclusive faces. The reverse stays transient — regenerated per view, never stored." },
];

export function HackathonBrief() {
  return <main className="brief-page"><div className="page-fold"><SiteHeader /><section className="brief-hero"><div><p className="brief-eyebrow">SegFault 2026 · Explainable compilers</p><h1><span className="product-name">troid</span> / <em>the reverse–obverse image duality</em> compiler</h1><p className="brief-question">What if a digital image could be a two-sided image-object, like a postcard or a coin?</p></div><aside className="brief-mark"><Braces size={28} /><span>TEXTUAL DSL → VALIDATED IR → TWO FACES</span></aside></section><section className="brief-body"><div className="brief-intro"><p><span className="product-name">robby</span> compiles a short source program into an inspectable, deterministic reverse for one immutable obverse photograph. The two faces remain mutually exclusive, like the faces of a coin.</p><p>The obverse is an opaque byte sequence plus an RGB matrix. The compiler may hash bytes and calculate flat colour statistics, but it never identifies, classifies, or assigns meaning to depicted content.</p><figure className="brief-shot"><img src="/compiler/troid-as-compiler.png" alt="troid: a visual-domain compiler — the seven-stage pipeline from .robby source through lexer, parser, validator, lowerer and code generator to the ORIO image-object" /></figure></div><Section index="" title="The inputs"><p>Two things go in. The obverse: a JPEG the compiler treats as an opaque byte sequence plus an RGB matrix — it is hashed, measured, and credential-checked, but never interpreted. And the recipe: a few lines of plain text naming a base specimen, a palette size, a reverse mode, and the outputs. Nothing else — every knob the compiler offers is visible in the frame.</p><pre>{`base("night-street.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "night-street.jpg", reverse: "transient", manifest: "transient")`}</pre><figure className="brief-shot"><img src="/compiler/recipe-workbench.png" alt="The recipe workbench — six lines of robby source in the editor, with Validate recipe and Reset specimen source actions below" /></figure><a className="brief-manual-link" href="/manual">The full language reference lives in the Manual →</a></Section><Section index="" title="The processing pipeline"><p>Eight stations, one pass. The same cells you watch fill up in the Teppanyaki counter on the homepage — here is what each one actually does.</p></Section><div className="brief-cells">{COUNTER_CELLS.map(cell => <Section key={cell.index} index={cell.index} title={cell.title}><p>{cell.body}</p></Section>)}</div><Section index="" title="The outputs"><p>Three artefacts come out. The obverse: the original JPEG, byte for byte unchanged. The reverse: a transient PNG regenerated deterministically for each flip, never stored. And the manifest: the binding record of source, recipe, seed, module, swatches, and output hashes that makes the whole thing auditable.</p><figure className="brief-shot"><img src="/compiler/recipe-workbench.png" alt="The recipe workbench — the six-line robby source that produced this session's outputs" /></figure><a className="brief-manual-link" href="/manual">Field-by-field manifest details are in the Manual →</a></Section><Section index="" title="The stack"><p>One Rust library is the whole story: the same lexer, parser, validator, IR, palette engine, and seed-driven renderer power the native CLI, the browser WASM compiler, and the server. There is no second implementation to drift — the WASM bridge and the native binary are parity-tested against each other, so the pipeline you watch in the Teppanyaki counter is byte-for-byte the one that rendered the reverse.</p><p>The server invokes that native core and returns PNG bytes directly with a no-store response. Deterministic in, deterministic out — the compiler is the product, and every stage of it is on the counter.</p></Section></section></div><SiteFooter /></main>;
}

export function ImageObjectBrief() {
  const brief = briefSummaries["image-object"];
  return (
    <main className="brief-page">
      <div className="page-fold">
      <SiteHeader />
      <section className="brief-hero concept-hero">
        <div>
          <p className="brief-eyebrow">MFA concept note · 2023</p>
          <h1>{brief.title}</h1>
          <p className="brief-question">
            A precis — paragraphs from the MFA PHT 805 project report that first
            articulated the reverse-obverse image duality.
          </p>
          <p className="brief-question brief-question-followup">
            The compiler becomes a way to <em>reassemble a fictional world more
            representative of reality than dull reality itself</em> — and to make
            that reassembly legible.
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
        <Section index="01" title="The medium as the message">
          <p>
            There did not exist a platform where the medium itself would serve as the perfect
            message. <span className="product-name">robby</span> proposes one. The compiler’s
            working mechanism — the eight stages of the Teppanyaki Counter, the palette
            split, the binding — is the visible surface of the tool. What the viewer sees is
            not a simulation of compilation; it is compilation.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, p. 8.</span>
          </p>
        </Section>

        <Section index="02" title="Partial truths, whole truths">
          <p>
            How does this evolving body of work sit within the realm of documentary? The work
            should evolve into a whole truth comprised of partial truths which is what
            photography is good at delivering. Partially true is how the city presents itself
            to me. What is it like for the most vulnerable class of workers to be out there in
            the crumbling ‘City Hostile’ so that the rest of us don’t? Also partially true is
            my truth — the one that I construct using photography’s rhetorical toolbox.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, p. 9.</span>
          </p>
        </Section>

        <Section index="03" title="Surrendering control to the compiler">
          <p>
            Just as the delivery company’s app was a form of surrendering control to an
            algorithmic photo editor that told me where to go and what I can expect to find
            there, I am now once again surrendering control to Adobe Sensei which picks apart
            my world and makes sense of it so that I can reassemble a new fictional world
            more representative of reality than dull reality itself.
          </p>
          <p>
            <span className="product-name">troid</span> &amp; <span className="product-name">robby</span> are the
            next iteration of that surrender — but with the surface of the compiler made
            visible, so the user can see the mechanism they have handed their photograph to.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, p. 18.</span>
          </p>
        </Section>

        <Section index="04" title="When the JPEG forgot the other side">
          <p>
            Remember the work of visual art before the age of digital distribution? It had
            sides. Take a currency note or a coin for example. You can pick it up and flip it
            around only to find another artwork. In the case of a photographic print, usually
            only one side is used for value whereas the reverse may be used for practical
            reasons like placing the agency’s or gallery’s stamp, the photographer’s sign and
            seal, edition information and some caption details. The two-sided print then
            transforms into an object greater than the sum of its parts.
          </p>
          <p>
            When the physical print gave way to the JPEG as the <em>de facto</em> carrier of
            the image to the screen, along with it went the obverse-reverse duality that for
            long we took for granted. For a digital image to graduate to an image-object, it
            is necessary to bring back that relationship and infuse it with creative
            possibilities.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, p. 20.</span>
          </p>
        </Section>

        <Section index="05" title="A redefinition of the reverse">
          <p>
            But first, what is the reverse of a digital obverse? To answer that, a
            redefinition is in order: the reverse of an image is another image, related but
            different, and mutually exclusive in visibility. Seen in this way, it is possible
            to programmatically implement such a feature.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, pp. 20–21.</span>
          </p>
        </Section>

        <Section index="06" title="At the confluence">
          <p>
            With this latest turn, I intend to arrive at work that sits at the confluence of
            visual theory, media studies, ethical technology and human rights while keeping
            photography at the core of it all.
          </p>
          <p>
            <span className="brief-source">Source: 2023 MFA PHT 805 Project Report, p. 16.</span>
          </p>
        </Section>

        <footer className="brief-footer">
          <FileText size={16} />
          <span>{brief.source}</span>
          <a
            className="brief-sway-link"
            href="https://sway.cloud.microsoft/m4okFOpHUOMNhkgh"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} /> Read the full essay on Microsoft Sway
          </a>
        </footer>
      </section>
      </div>
      <SiteFooter />
    </main>
  );
}

export function AboutBrief() {
  const brief = briefSummaries.about;
  return (
    <main className="brief-page">
      <div className="page-fold">
      <SiteHeader />
      <section className="brief-hero">
        <div>
          <p className="brief-eyebrow">About · SegFault 2026 · Explainable compilers</p>
          <h1>I built <span className="product-name">troid</span> &amp; <span className="product-name">robby</span>.</h1>
          <p className="brief-question">
            <span className="product-name">segfault</span> is a two-day hackathon where teams build, then
            present a working compiler whose inner workings are visible — not hidden behind
            a glossy UI.
          </p>
          <p className="brief-question brief-question-followup">
            SegFault is not a beauty contest. It asks: <em>can a compiler be a beautiful
            instrument, and can its visible workings become part of the object it
            produces?</em>
          </p>
        </div>
        <aside className="brief-mark">
          <Sparkles size={28} />
          <span>
            SEGFAULT 2026
            <br />
            EXPLAINABLE COMPILERS
            <br />
            WORKING · INSPECTABLE
          </span>
        </aside>
      </section>

      <section className="brief-body">
        <Section index="01" title="The Reverse-Obverse Image Duality">
          <p>
            The Reverse-Obverse Image Duality (<span className="product-name">troid</span>) is an
            explainable compiler that turns a digital photograph into an Obverse-Reverse Image
            Object, or <em>orio cookie</em> — a two-sided proprietary image format viewed like a
            coin or a postcard: an untouched obverse and a deterministically generated reverse,
            mutually exclusive to the sight.
          </p>
          <p>
            <span className="product-name">robby</span> makes <span className="product-name">troid</span>'s
            underlying mechanism visible. A user picks a photograph, writes a recipe, and
            deliberately compiles an orio. The live Teppanyaki Counter exposes the pipeline: source
            intake, metadata and C2PA inspection, pixel and palette measurement, recipe
            validation, IR generation, deterministic binding, reverse rendering, and pairing.
          </p>
        </Section>

        <Section index="02" title="A real compiler stack">
          <p>
            It is a real compiler stack — a Rust lexer, parser, validator, IR, palette engine,
            renderer, and a WASM-connected browser interface. It separates authored from
            canonicalised instructions, source identity from pixel identity, C2PA presence from
            validation and signer trust, and private evidence from share-safe output.
          </p>
        </Section>

        <Section index="03" title="The original image stays sacred">
          <p>
            The original image stays sacred and immutable — <span className="product-name">robby</span> never
            alters, recompresses, or overwrites the obverse or its embedded credentials. The
            reverse is an emerging artwork and observability record, built from opaque image
            identity, colour material, explicit recipe settings, and bounded evidence — not from
            semantic recognition of the photograph's content.
          </p>
        </Section>

        <Section index="04" title="The proposition">
          <p>
            <strong>The proposition: compilers can be beautiful instruments whose visible
            workings become part of the object they create.</strong>
          </p>
        </Section>

        <figure className="brief-figure">
          <img src="/about/robby-studio.jpg" alt="robby studio — obverse photograph on the left, live Teppanyaki Counter on the right showing every visible stage of an orio compilation." />
          <figcaption>MS201306-BipashaAashish0192.jpg · obverse · Teppanyaki Counter resolved · K = 8</figcaption>
        </figure>
      </section>

      <footer className="brief-footer">
        <FileText size={16} />
        <span>{brief.source}</span>
      </footer>
      </div>
      <SiteFooter />
    </main>
  );
}
