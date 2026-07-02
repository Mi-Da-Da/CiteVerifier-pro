const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/></svg>\")";

const PRISMA_HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4";

export function SiteBackdrop({ video = true }: { video?: boolean }) {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-65"
        src={PRISMA_HERO_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />

      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          opacity: 0.7,
        }}
      />

      <div className="absolute inset-0 bg-noise opacity-[0.15]" />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(222,219,200,0.18), transparent 28%), radial-gradient(circle at 82% 18%, rgba(177,135,79,0.16), transparent 30%), linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.08) 38%, rgba(0,0,0,0.52) 100%)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
    </div>
  );
}
