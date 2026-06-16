const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/></svg>\")";

export function SiteBackdrop({ video = true }: { video?: boolean }) {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#062f4f]">
      <style>
        {`
          @keyframes skyBackdropDrift {
            0% { transform: scale(1.08) translate3d(-1.6%, -0.8%, 0); }
            50% { transform: scale(1.13) translate3d(1.6%, 0.8%, 0); }
            100% { transform: scale(1.08) translate3d(-1.6%, -0.8%, 0); }
          }

          @keyframes skyCloudOverlayDrift {
            0% { transform: scale(1.16) translate3d(2.8%, -0.4%, 0); }
            50% { transform: scale(1.2) translate3d(-2.8%, 0.6%, 0); }
            100% { transform: scale(1.16) translate3d(2.8%, -0.4%, 0); }
          }
        `}
      </style>

      <div
        className="absolute inset-[-5%]"
        style={{
          backgroundImage: "url('/backgrounds/sky-clouds-clean.png')",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          animation: "skyBackdropDrift 42s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      <div
        className="absolute inset-[-10%]"
        style={{
          backgroundImage: "url('/backgrounds/sky-clouds-clean.png')",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          animation: "skyCloudOverlayDrift 56s ease-in-out infinite",
          filter: "blur(1.5px)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 16%, black 72%, transparent 100%)",
          mixBlendMode: "screen",
          opacity: 0.24,
          willChange: "transform",
        }}
      />

      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          opacity: 0.14,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,16,38,0.18) 0%, rgba(0,16,38,0.02) 38%, rgba(0,16,38,0.08) 66%, rgba(0,8,20,0.34) 100%)",
        }}
      />
    </div>
  );
}
