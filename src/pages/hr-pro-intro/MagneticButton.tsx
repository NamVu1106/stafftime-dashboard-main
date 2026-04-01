import { useRef, useEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';

type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'light' | 'outline' | 'apple';
};

/** Nút CTA hút nhẹ theo con trỏ — “magnetic” kiểu Apple showcase */
export function MagneticButton({ children, className, onClick, disabled, variant = 'light' }: MagneticButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const strength = 0.22;
    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const x = (e.clientX - cx) * strength;
      const y = (e.clientY - cy) * strength;
      gsap.to(inner, { x, y, duration: 0.35, ease: 'power2.out' });
    };
    const onLeave = () => {
      gsap.to(inner, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' });
    };
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, [disabled]);

  const base =
    variant === 'apple'
      ? 'rounded-full bg-[#0071e3] px-10 py-3.5 text-[17px] font-normal text-white shadow-none hover:bg-[#0077ed]'
      : variant === 'light'
        ? 'rounded-full bg-white px-10 py-4 text-sm font-semibold text-black shadow-[0_0_40px_-8px_rgba(255,255,255,0.35)] hover:bg-white/95'
        : 'rounded-full border border-white/30 bg-white/5 px-10 py-4 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/10';

  return (
    <div ref={wrapRef} className="inline-block cursor-pointer select-none">
      <div ref={innerRef} className="will-change-transform">
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={cn(base, 'transition-[transform,box-shadow] active:scale-[0.98]', className)}
        >
          {children}
        </button>
      </div>
    </div>
  );
}
