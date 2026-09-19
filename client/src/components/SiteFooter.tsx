import { footerSocialLinks } from "@/lib/footerLinks";

function SocialGlyph({ icon }: { icon: (typeof footerSocialLinks)[number]["icon"] }) {
  if (icon === "x") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2.25h3.68l-8.04 9.19L24 21.75h-7.41l-5.8-7.58-6.63 7.58H.48l8.6-9.83L0 2.25h7.6l5.25 6.94 6.05-6.94Zm-1.29 17.3h2.04L6.49 4.33H4.3L17.61 19.55Z" /></svg>;
  }

  if (icon === "linkedin") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.37 3.36a2.13 2.13 0 1 1-4.26 0 2.13 2.13 0 0 1 4.26 0ZM1.46 8.1h3.82v12.29H1.46V8.1Zm6.22 0h3.66v1.68h.05c.51-.97 1.76-2 3.62-2 3.88 0 4.6 2.55 4.6 5.87v6.74h-3.82v-5.97c0-1.42-.03-3.24-1.97-3.24-1.98 0-2.29 1.54-2.29 3.14v6.07H7.68V8.1Z" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.51v-1.85c-2.94.64-3.56-1.25-3.56-1.25-.48-1.22-1.18-1.55-1.18-1.55-.96-.66.07-.65.07-.65 1.07.08 1.63 1.09 1.63 1.09.94 1.62 2.48 1.15 3.08.88.1-.69.37-1.15.67-1.42-2.35-.27-4.82-1.17-4.82-5.23 0-1.16.42-2.11 1.09-2.85-.11-.27-.47-1.35.1-2.81 0 0 .89-.29 2.89 1.09A9.96 9.96 0 0 1 12 6.6c.9 0 1.8.12 2.64.36 2-1.38 2.88-1.09 2.88-1.09.58 1.46.22 2.54.11 2.81.68.74 1.09 1.69 1.09 2.85 0 4.07-2.48 4.95-4.84 5.21.38.33.72.97.72 1.96v2.79c0 .28.19.61.73.51A10.5 10.5 0 0 0 12 1.5Z" /></svg>;
}

export function SiteFooter({ inert }: { inert?: boolean }) {
  return (
    <footer className="site-footer" inert={inert}>
      <div className="footer-left">
        <p className="footer-observation"><em>Observation is a choice.</em></p>
        <nav className="footer-socials" aria-label="Mahesh Shantaram social links">
          {footerSocialLinks.map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
              <SocialGlyph icon={link.icon} />
            </a>
          ))}
        </nav>
      </div>
      <p className="footer-copyright">© 2026 <a href="https://thecontrarian.in/" target="_blank" rel="noreferrer">Mahesh Shantaram / thecontrarian.in</a></p>
    </footer>
  );
}
