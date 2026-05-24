export function SiteBackdrop({ video = true }: { video?: boolean }) {
  return (
    <>
      {video && (
        <video
          className="fixed inset-0 w-full h-full object-cover z-0"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-black/40" />
      <div className="bottom-blur-overlay fixed inset-0 z-[1] pointer-events-none" />
    </>
  );
}
