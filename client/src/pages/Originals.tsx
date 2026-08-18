import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileCheck2, LockKeyhole, Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { Link } from "wouter";

type UploadResult = {
  asset: {
    originalFilename: string;
    byteLength: number;
    sha256: string;
    credentialState: string;
  } | undefined;
  duplicate: boolean;
};

async function sha256For(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
}

export default function Originals() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: false });
  const originals = trpc.originals.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selected, setSelected] = useState<File | null>(null);
  const [localHash, setLocalHash] = useState("");
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelected(null);
    setLocalHash("");
    setStatus("");
    if (!file) return;
    if (file.type !== "image/jpeg" || !/\.jpe?g$/i.test(file.name)) {
      setStatus("robby v1 accepts original JPEG files only. Nothing was uploaded.");
      return;
    }
    setSelected(file);
    setLocalHash(await sha256For(file));
  };

  const upload = async () => {
    if (!selected) return;
    setIsUploading(true);
    setStatus("Storing the selected byte stream without image processing…");
    try {
      const response = await fetch("/api/originals", {
        method: "POST",
        headers: {
          "Content-Type": selected.type,
          "X-Robby-Original-Filename": encodeURIComponent(selected.name),
        },
        credentials: "include",
        body: selected,
      });
      const result = (await response.json()) as UploadResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setStatus(result.duplicate ? "The identical original is already stored; no second object was created." : "Stored unchanged. Add a compiler provenance audit before treating its C2PA state as verified.");
      await originals.refetch();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="originals-page min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20211e] sm:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="manual-link inline-flex"><ArrowLeft size={14} /> BACK TO GALLERY</Link>
        <p className="eyebrow mt-12">Originals vault / immutable intake</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-6xl">Preserve the image<br /><em>before</em> the compiler sees it.</h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#4d4d46]"><span className="product-name">robby</span> stores the selected JPEG byte stream directly. It does not crop, resize, re-encode, strip metadata, or rename the filename. Storage is content-addressed by SHA-256; the original basename is retained.</p>

        {!loading && !isAuthenticated ? (
          <section className="mt-10 border border-[#20211e] bg-[#fffdf8] p-6">
            <div className="flex items-start gap-3"><LockKeyhole className="mt-1 text-[#e3442f]" /><div><h2 className="font-serif text-2xl">Sign in to load an original</h2><p className="mt-2 text-sm leading-6">Authenticated intake keeps the immutable provenance record associated with its uploader.</p><button className="source-download mt-5" onClick={startLogin}>SIGN IN</button></div></div>
          </section>
        ) : (
          <>
            <section className="mt-10 border border-[#20211e] bg-[#fffdf8] p-6 sm:p-8">
              <label className="mono-label" htmlFor="original-file">Select original JPEG</label>
              <input id="original-file" className="mt-3 block w-full text-sm" type="file" accept="image/jpeg,.jpg,.jpeg" onChange={selectFile} />
              {selected && <div className="mt-5 rounded border border-[#c9c3b9] bg-[#f5f0e8] p-4 text-sm"><p><strong>{selected.name}</strong> · {selected.size.toLocaleString()} bytes</p><p className="mono mt-2 break-all text-[11px]">SHA-256 {localHash}</p><button className="source-download mt-4" onClick={upload} disabled={isUploading}>{isUploading ? "STORING RAW BYTES" : <><Upload size={13} /> STORE UNCHANGED ORIGINAL</>}</button></div>}
              {status && <p className="mt-4 text-sm leading-6" role="status">{status}</p>}
            </section>

            <section className="mt-8 border-t border-[#20211e] pt-6">
              <div className="flex items-center gap-2"><FileCheck2 size={16} /><h2 className="font-serif text-2xl">Stored originals</h2></div>
              <div className="mt-4 space-y-3">
                {originals.data?.map(asset => <article key={asset.id} className="border border-[#c9c3b9] bg-[#fffdf8] p-4 text-sm"><p><strong>{asset.originalFilename}</strong> · {asset.byteLength.toLocaleString()} bytes · {asset.credentialState.toUpperCase()}</p><p className="mono mt-2 break-all text-[11px]">SHA-256 {asset.sha256}</p></article>)}
                {originals.isSuccess && originals.data.length === 0 && <p className="text-sm">No immutable originals have been recorded yet.</p>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
