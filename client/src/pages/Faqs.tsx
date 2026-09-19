import { useLayoutEffect, useRef, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

type FaqEntry = {
  id: string;
  index: string;
  rail: string;
  question: React.ReactNode;
  answer: React.ReactNode;
};

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "q1",
    index: "01",
    rail: "actually a compiler",
    question: <>Lexer, parser, AST, validator, IR, code generator — but the "target" is a PNG. Is <code>troid</code> actually a compiler, or is that just a flattering word for a renderer?</>,
    answer: <>It's a compiler by the only definition that has ever mattered: a disciplined translation from a source language, through validated intermediate representations, to a target — with every stage inspectable and every failure a compile error rather than a runtime surprise. The target being raster bytes instead of machine code is incidental; <code>troid</code> rejects malformed <code>.robby</code> scripts the same way <code>rustc</code> rejects malformed Rust, at the validator stage, before anything is lowered (<a href="https://github.com/thecont1/robby/blob/main/TECH-SPEC.md" target="_blank" rel="noreferrer"><code>TECH-SPEC.md</code></a>). The interesting question a real compiler person should ask next isn't "is this a compiler" but "what is its target's instruction set" — and the answer is: pixels, but only ones reachable through <code>median_cut</code>, <code>nearest_palette_index</code>, and a seeded shuffle. No opcode outside that set exists (<a href="https://github.com/thecont1/robby/blob/main/src/render.rs" target="_blank" rel="noreferrer"><code>src/render.rs</code></a>).</>,
  },
  {
    id: "q2",
    index: "02",
    rail: "constitutional rule",
    question: <>Why is "never understand the picture" written as a <em>constitutional rule</em> rather than just... not writing that feature?</>,
    answer: <>Because an omitted feature can be added back by accident; a constitutional rule has to be actively violated, and violations leave a trace. <code>robby</code>'s TECH-SPEC names three permitted ways to touch the obverse — raw bytes for hashing, an RGB matrix for flat statistics, structural metadata — and declares everything else, including "depicted-subject models," out of bounds (<a href="https://github.com/thecont1/robby/blob/main/TECH-SPEC.md" target="_blank" rel="noreferrer"><code>TECH-SPEC.md §4</code></a>). This is the same move a language spec makes when it defines undefined behavior explicitly instead of leaving gaps: the boundary is the feature, and the rejection tests that keep dead "cutout"/"place" syntax around as fixtures are there so that boundary can never quietly erode back open (<a href="https://github.com/thecont1/robby/blob/main/src/lib.rs" target="_blank" rel="noreferrer"><code>src/lib.rs</code></a>).</>,
  },
  {
    id: "q3",
    index: "03",
    rail: "a whole manifest",
    question: <>The compiler ships a whole manifest — hashes, seed, palette, artifact descriptors — next to the image. Isn't the picture the actual deliverable?</>,
    answer: <>The picture is the <em>claim</em>; the manifest is the <em>proof</em>. A compiler you can't audit is just a black box that happens to be popular, which is precisely the failure mode <code>robby</code> was built against — so instead of asking you to trust the render, it hands you <code>source_obverse_sha256</code>, <code>script_settings_sha256</code>, <code>derived_seed</code>, and <code>output_sha256</code> so the transformation can be independently re-run and checked byte-for-byte (<a href="https://github.com/thecont1/robby/blob/main/src/render.rs" target="_blank" rel="noreferrer"><code>src/render.rs</code></a>). This is translation validation in miniature: the compiler doesn't just produce an answer, it produces the evidence that the answer followed necessarily from the input.</>,
  },
  {
    id: "q4",
    index: "04",
    rail: "two names",
    question: <>Why does the project insist on two names — <code>robby</code> the repo, <code>troid</code> the engine — for what is, from the outside, one thing?</>,
    answer: <>Because "one thing" is exactly what stops being true the moment a project has a UI. <code>troid</code> is the correctness-critical kernel — lexer, parser, validator, IR, renderer, compiled once and shared bit-identically between native CLI and browser WASM — while <code>robby</code> is the "observation deck" wrapped around it, free to change its explainability panels, animations, and branding without ever touching the thing that has to be provably deterministic (<a href="https://github.com/thecont1/robby/blob/main/README.md" target="_blank" rel="noreferrer"><code>README.md</code></a>). It's the same separation LLVM draws from Clang, or a database engine draws from its GUI: the part that must be boring and correct is kept structurally apart from the part that's allowed to be interesting.</>,
  },
  {
    id: "q5",
    index: "05",
    rail: "a shuffle",
    question: <><code>palette_grid</code>'s shuffle "may look random." In what sense is a shuffle ever genuinely deterministic?</>,
    answer: <>In the sense that matters for a compiler: given the same inputs, it is bit-identical on every run, on every machine, forever — which is a stronger guarantee than most software ever makes, randomness included. The apparent disorder comes from a Fisher–Yates shuffle driven only by a SplitMix64 generator seeded from <code>sha256(source_bytes ∥ settings)</code>, so "random-looking" and "reproducible" aren't in tension — they're the entire point (<a href="https://github.com/thecont1/robby/blob/main/src/render.rs" target="_blank" rel="noreferrer"><code>src/render.rs</code></a>, <a href="https://github.com/thecont1/robby/blob/main/docs/ARCHITECTURE-DECISIONS.md" target="_blank" rel="noreferrer">ADR-003</a>). This is the exact discipline behind "reproducible builds": replace ambient nondeterminism (thread order, hash-map iteration, wall-clock time) with one explicit, hashed seed, and unpredictability stops being a threat to correctness.</>,
  },
  {
    id: "q6",
    index: "06",
    rail: "tie-breaks",
    question: <>The median-cut algorithm specifies tie-breaks nobody would think to ask for — widest channel first, then R, then G, then B, sorted, cut at exactly <code>len / 2</code>. Why so finicky about color clustering?</>,
    answer: <>Because "roughly the same palette" is a passing grade for a photo filter and a failing grade for a compiler. <code>troid</code> runs natively in Rust and inside a browser as WASM, and both must produce <em>identical</em> PNG bytes — so every place a naive spec would let floating-point rounding or iteration order silently diverge across platforms has been replaced with an explicit, integer-only rule (<a href="https://github.com/thecont1/robby/blob/main/docs/ARCHITECTURE-DECISIONS.md" target="_blank" rel="noreferrer">ADR-003</a>). This is the same instinct that makes language standards nail down evaluation order instead of leaving it "implementation-defined": ambiguity you don't resolve on paper is ambiguity your two backends will resolve differently at runtime.</>,
  },
  {
    id: "q7",
    index: "07",
    rail: "futures and pasts",
    question: <>The v1 parser explicitly refuses v2 syntax that isn't even implemented yet, and keeps rejection tests for commands (<code>cutout</code>, <code>place</code>) that used to exist and were removed. Why guard against futures and pasts you've already decided not to build?</>,
    answer: <>Because a grammar is a contract, and the most dangerous way to break a contract is silently. If <code>troid</code> v1 quietly accepted or half-parsed a future <code>{"object { }"}</code> recipe block, a script author would get a plausible-looking but wrong compile instead of a clean error — worse than rejection, because it hides the seam (<a href="https://github.com/thecont1/robby/blob/main/README.md" target="_blank" rel="noreferrer"><code>README.md</code></a>, <a href="https://github.com/thecont1/robby/blob/main/docs/ingredients-and-evidence.md" target="_blank" rel="noreferrer"><code>docs/ingredients-and-evidence.md</code></a>). Keeping fixtures for removed syntax is the same discipline as a language keeping deprecation errors instead of just deleting the deprecated feature and hoping nobody notices — the boundary itself becomes a tested, version-stamped fact (<a href="https://github.com/thecont1/robby/blob/main/src/lib.rs" target="_blank" rel="noreferrer"><code>src/lib.rs</code></a>).</>,
  },
  {
    id: "q8",
    index: "08",
    rail: "fresh on every flip",
    question: <>Robby refuses to ever save a "final" reverse image anywhere — gallery, database, cache — regenerating it fresh on every flip. Doesn't that throw away the whole point of compiling something once?</>,
    answer: <>Only if you conflate two things a good compiler design keeps separate: the pure function that derives an artifact, and the policy decision of whether to cache it. <code>robby</code> treats the reverse as a value that is always re-derivable from its source bytes and settings — never a source of truth in itself — which is why the durable inputs are only the <code>.robby</code> script and the original JPEG, and a persisted reverse PNG is explicitly forbidden (<a href="https://github.com/thecont1/robby/blob/main/TECH-SPEC.md" target="_blank" rel="noreferrer"><code>TECH-SPEC.md §6</code></a>). Caching would be a legitimate optimization layered on top; caching-as-the-definition-of-correctness is how systems quietly start trusting stale results, which is the exact trust failure this project is arguing against.</>,
  },
  {
    id: "q9",
    index: "09",
    rail: "seven categories",
    question: <>The evidence taxonomy — <code>observed</code>, <code>verified</code>, <code>measured</code>, <code>derived</code>, <code>declared</code>, <code>redacted</code>, <code>unavailable</code> — looks like a lot of bureaucracy just to describe a photo's metadata. Why seven categories instead of one "metadata" bucket?</>,
    answer: <>Because collapsing them is precisely the bug that lets people mistake an EXIF camera field anyone could fake (<code>observed</code>) for a cryptographically checked C2PA credential (<code>verified</code>) — one generic label erases a distinction that determines whether a claim can be trusted at all (<a href="https://github.com/thecont1/robby/blob/main/docs/EVIDENCE-TAXONOMY.md" target="_blank" rel="noreferrer"><code>docs/EVIDENCE-TAXONOMY.md</code></a>). This is a type system for provenance: just as a compiler's type system statically prevents you from treating an <code>int</code> as a <code>pointer</code>, this taxonomy statically prevents a UI from treating "the file claims this" as equivalent to "this was verified" — the failure mode it's designed to make structurally impossible is exactly the one that shows up in real-world misinformation about images.</>,
  },
  {
    id: "q10",
    index: "10",
    rail: "explainable",
    question: <>Change one pixel of the obverse, and the reverse changes completely and unrecognizably. For a compiler that markets itself as "explainable," isn't that the opposite of explainable?</>,
    answer: <>Explainable doesn't mean predictable — it means <em>traceable after the fact</em>, and those are different properties that this project deliberately trades against each other. The derived seed is <code>sha256(source_hash ∥ settings_hash)</code>, so it inherits a cryptographic hash's avalanche effect on purpose: you can never guess the reverse from the obverse, but you can always reconstruct, exactly, why this reverse and no other came from this obverse (<a href="https://github.com/thecont1/robby/blob/main/src/render.rs" target="_blank" rel="noreferrer"><code>src/render.rs</code></a>, <a href="https://github.com/thecont1/robby/blob/main/TECH-SPEC.md" target="_blank" rel="noreferrer"><code>TECH-SPEC.md §5</code></a>). It's the same reason a good compiler's optimizer is allowed to produce wildly different machine code for a one-line source change while still being fully explainable through its optimization log — determinism and legibility live in the process, not in the illusion that small causes should have small, guessable effects.</>,
  },
];

export default function Faqs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const pageRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const hero = heroRef.current;
    if (!page || !hero) return;

    const syncRailOffset = () =>
      page.style.setProperty("--faqs-hero-h", `${hero.offsetHeight}px`);
    const resizeObserver = new ResizeObserver(syncRailOffset);
    resizeObserver.observe(hero);
    syncRailOffset();

    page.classList.add("faqs-scrolly");

    const wide = window.matchMedia("(min-width:791px)");
    let lockUntil = 0;
    const step = (dir: number) => {
      const now = performance.now();
      if (now < lockUntil) return;
      lockUntil = now + 720;
      setActiveIndex((i) =>
        Math.min(FAQ_ENTRIES.length - 1, Math.max(0, i + dir)),
      );
    };

    let wheelAcc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!wide.matches) return;
      e.preventDefault();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) > 48) {
        step(Math.sign(wheelAcc));
        wheelAcc = 0;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!wide.matches) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(FAQ_ENTRIES.length - 1);
      }
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (wide.matches) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!wide.matches) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      if (Math.abs(dy) > 48) step(Math.sign(dy));
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      resizeObserver.disconnect();
      page.classList.remove("faqs-scrolly");
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <main className="faqs-page" ref={pageRef}>
      <div className="page-fold">
        <SiteHeader />

        <section className="faqs-hero" ref={heroRef}>
          <div className="faqs-hero-inner">
            <div>
              <p className="eyebrow"><span className="product-name">troid</span> / <span className="product-name">robby</span> · the not-so-faq</p>
              <h1>Not-So-<em>FAQs</em></h1>
            </div>
            <div className="faqs-intro-copy">
              <p><em>Ten questions about <code>troid</code> / <code>robby</code> that sound simple and aren't. Answered briefly on purpose — the point is to leave you thinking, not to close the topic.</em></p>
            </div>
          </div>
        </section>

        <section className="faqs-index" aria-label="Not-so-frequently asked questions">
          <div className="faqs-index-rail">
            <span className="mono-label">Question index</span>
            <ol>{FAQ_ENTRIES.map((entry, index) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  aria-current={index === activeIndex ? "location" : undefined}
                  className={index === activeIndex ? "is-active" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveIndex(index);
                  }}
                >{entry.index} · {entry.rail}</a>
              </li>
            ))}</ol>
          </div>
          <div className="faqs-entries">
            {FAQ_ENTRIES.map((entry, index) => (
              <article
                className={index === activeIndex ? "faq-entry in-view" : "faq-entry"}
                id={entry.id}
                key={entry.id}
                aria-hidden={index !== activeIndex || undefined}
              >
                <div className="faq-entry-mark"><span>{entry.index}</span><i /></div>
                <div className="faq-entry-body">
                  <h2>{entry.question}</h2>
                  <p className="faq-answer">{entry.answer}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
