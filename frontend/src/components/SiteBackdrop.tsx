import { useEffect, useRef } from "react";

export function SiteBackdrop({ video = true }: { video?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!video) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    // ── 论文片段（飘落粒子）
    const TITLES = [
      "Attention Is All You Need",
      "BERT: Pre-training of Deep",
      "ImageNet Classification",
      "Generative Adversarial Nets",
      "Deep Residual Learning",
      "Neural Machine Translation",
      "GPT-4 Technical Report",
      "LLaMA: Open Foundation",
      "Retrieval-Augmented Generation",
      "Chain-of-Thought Prompting",
      "A formal analysis of TLS 1.3",
      "doi:10.1145/3292500",
      "arXiv:2302.13971",
      "arXiv:1706.03762",
      "IEEE Trans. on Neural Networks",
      "Nature 588, 60–65 (2020)",
      "CVPR 2023 · Best Paper",
      "NeurIPS 2022 · Spotlight",
    ];

    // ── 代码/文字流粒子
    const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&αβγδεζ∑∫∂∇≈≠∞∈∉⊕⊗".split("");

    type Flake = {
      x: number; y: number; speed: number; opacity: number;
      text: string; size: number; isCode: boolean;
      dx: number; angle: number; angleSpeed: number;
    };

    const COUNT = Math.min(60, Math.floor(W / 22));
    const flakes: Flake[] = [];

    const makeFlake = (startY?: number): Flake => {
      const isCode = Math.random() < 0.55;
      return {
        x: Math.random() * W,
        y: startY !== undefined ? startY : Math.random() * H,
        speed: 0.35 + Math.random() * 0.7,
        opacity: 0.06 + Math.random() * 0.22,
        text: isCode
          ? CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
          : TITLES[Math.floor(Math.random() * TITLES.length)],
        size: isCode ? 11 + Math.random() * 6 : 10 + Math.random() * 4,
        isCode,
        dx: (Math.random() - 0.5) * 0.25,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: (Math.random() - 0.5) * 0.004,
      };
    };

    for (let i = 0; i < COUNT; i++) flakes.push(makeFlake());

    // ── 节点连线（引用网络）
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    const NODE_COUNT = Math.min(28, Math.floor(W / 55));
    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1.5 + Math.random() * 2,
    }));

    const LINK_DIST = Math.min(W, H) * 0.22;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // background
      ctx.fillStyle = "#070710";
      ctx.fillRect(0, 0, W, H);

      // ── 节点连线
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(140,120,255,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // dot
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(160,140,255,0.35)";
        ctx.fill();
        // update
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
      }

      // ── 飘落粒子
      for (const f of flakes) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.globalAlpha = f.opacity;
        if (f.isCode) {
          ctx.font = `${f.size}px 'Courier New', monospace`;
          ctx.fillStyle = "#7cf5c8";
        } else {
          ctx.font = `${f.size}px 'Georgia', serif`;
          ctx.fillStyle = "#c8b8ff";
        }
        ctx.fillText(f.text, 0, 0);
        ctx.restore();

        f.y += f.speed;
        f.x += f.dx;
        f.angle += f.angleSpeed;

        // 代码字符随机变化
        if (f.isCode && Math.random() < 0.012) {
          f.text = CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }

        if (f.y > H + 30) {
          const nf = makeFlake(-20);
          Object.assign(f, nf);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, [video]);

  return (
    <>
      {video && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-full h-full z-0"
          style={{ display: "block" }}
        />
      )}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-black/30" />
      <div className="bottom-blur-overlay fixed inset-0 z-[1] pointer-events-none" />
    </>
  );
}
