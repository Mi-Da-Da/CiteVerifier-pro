/**
 * SiteBackdrop —— 黑底 + 背景视频 + SVG 噪点叠层
 *
 * - 全屏 fixed 容器，铺满视口
 * - 背景视频 autoPlay/loop/muted/playsInline，object-cover 充满
 * - 上方叠一层 fractal noise 噪点（mix-blend-overlay）+ 顶/底渐变
 *   营造电影感暗调质感
 */
const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/></svg>\")";

export function SiteBackdrop({ video = true }: { video?: boolean }) {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
      {/* 背景视频 */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
      />

      {/* 噪点叠层 */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          opacity: 0.7,
        }}
      />

      {/* 顶/底渐变，提高前景文字可读性 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
