import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
};

function shieldTargets(w: number, h: number): { x: number; y: number }[] {
  const cx = w / 2;
  const cy = h * 0.42;
  const pts: { x: number; y: number }[] = [];
  // Hình khiên đơn giản — đỉnh, vai trái/phải, đáy
  const outline = [
    [cx, h * 0.12],
    [cx - w * 0.28, h * 0.28],
    [cx - w * 0.32, h * 0.55],
    [cx - w * 0.18, h * 0.82],
    [cx + w * 0.18, h * 0.82],
    [cx + w * 0.32, h * 0.55],
    [cx + w * 0.28, h * 0.28],
  ];
  const perEdge = 5;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    for (let j = 0; j < perEdge; j++) {
      const t = j / perEdge;
      pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
    }
  }
  return pts;
}

type ParticleShieldProps = {
  sectionRef: React.RefObject<HTMLElement | null>;
};

/** Hạt sáng hội tụ thành khiên — Canvas + tiến độ cuộn */
export function ParticleShield({ sectionRef }: ParticleShieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const particlesRef = useRef<Particle[] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let targets: { x: number; y: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      targets = shieldTargets(w, h);
      if (!particlesRef.current || particlesRef.current.length !== targets.length) {
        particlesRef.current = targets.map((t) => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          homeX: t.x,
          homeY: t.y,
        }));
      } else {
        particlesRef.current.forEach((p, i) => {
          p.homeX = targets[i % targets.length].x;
          p.homeY = targets[i % targets.length].y;
        });
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const st = reduce
      ? null
      : ScrollTrigger.create({
          trigger: section,
          start: 'top 75%',
          end: 'bottom 25%',
          scrub: 0.6,
          onUpdate: (self) => {
            progressRef.current = self.progress;
          },
        });

    let raf = 0;
    const tick = () => {
      const pList = particlesRef.current;
      if (!pList || !ctx || w < 10) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const p = reduce ? 1 : progressRef.current;
      ctx.clearRect(0, 0, w, h);

      for (const part of pList) {
        const tx = part.homeX;
        const ty = part.homeY;
        if (p < 0.85) {
          const wander = 1 - p / 0.85;
          part.x += part.vx * wander * 0.8;
          part.y += part.vy * wander * 0.8;
          if (part.x < 0 || part.x > w) part.vx *= -1;
          if (part.y < 0 || part.y > h) part.vy *= -1;
        }
        const cx = part.x + (tx - part.x) * p;
        const cy = part.y + (ty - part.y) * p;

        const alpha = 0.25 + p * 0.65;
        const r = 1.2 + p * 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${alpha})`;
        ctx.fill();
      }

      if (p > 0.55) {
        ctx.strokeStyle = `rgba(120, 170, 255, ${(p - 0.55) * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        targets.forEach((t, i) => {
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      st?.kill();
    };
  }, [sectionRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[min(50vh,420px)] w-full max-w-3xl"
      aria-hidden
    />
  );
}
