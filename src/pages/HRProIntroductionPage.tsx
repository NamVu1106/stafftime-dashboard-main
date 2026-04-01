import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/hooks/useI18n';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowLeft,
  ScanFace,
  Fingerprint,
  Radio,
  Monitor,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MagneticButton } from '@/pages/hr-pro-intro/MagneticButton';
import { ParticleShield } from '@/pages/hr-pro-intro/ParticleShield';
import { cn } from '@/lib/utils';

gsap.registerPlugin(ScrollTrigger);

function DashboardMock({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/95 to-black/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          {t('hrProIntro.mockBadge')}
        </span>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-amber-500/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-lg font-semibold tracking-tight text-white">
          {t('hrProIntro.mockTitle')}
        </div>
        <div className="h-2 w-3/4 rounded-full bg-white/10" />
        <div className="h-2 w-1/2 rounded-full bg-white/5" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[72, 94, 88].map((n, i) => (
            <div key={i} className="rounded-lg bg-white/5 p-2 text-center">
              <div className="text-lg font-bold text-emerald-400">{n}%</div>
              <div className="text-[9px] text-zinc-500">KPI</div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[10px] text-zinc-500">{t('hrProIntro.mockSub')}</p>
    </div>
  );
}

export default function HRProIntroductionPage() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroVeilRef = useRef<HTMLDivElement>(null);
  const heroBezelRef = useRef<HTMLDivElement>(null);
  const heroDashRef = useRef<HTMLDivElement>(null);
  const heroLineRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLElement>(null);
  const orbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreGlowRef = useRef<HTMLDivElement>(null);
  const perfRef = useRef<HTMLElement>(null);
  const perfNumRef = useRef<HTMLSpanElement>(null);
  const xdrRef = useRef<HTMLElement>(null);
  const xdrWidgetsRef = useRef<HTMLDivElement[]>([]);
  const connectRef = useRef<HTMLElement>(null);
  const bioRef = useRef<HTMLElement>(null);
  const lineupRef = useRef<HTMLElement>(null);
  const lineupDevicesRef = useRef<HTMLDivElement[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const h = () => setReduced(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set(
          [
            heroVeilRef.current,
            heroBezelRef.current,
            heroDashRef.current,
            heroLineRef.current,
            coreGlowRef.current,
            ...orbRefs.current,
            perfNumRef.current,
            ...xdrWidgetsRef.current,
            ...lineupDevicesRef.current,
          ].filter(Boolean),
          { clearProps: 'all' }
        );
        return;
      }

      /* —— Màn 1: Hero — veil, bezel, tilt dashboard —— */
      if (heroRef.current && heroVeilRef.current && heroDashRef.current) {
        gsap.set(heroVeilRef.current, { opacity: 1 });
        gsap.set(heroBezelRef.current, { opacity: 0, scale: 0.98 });
        gsap.set(heroDashRef.current, {
          opacity: 0,
          y: 120,
          rotateX: 28,
          rotateY: -12,
          scale: 0.82,
          transformPerspective: 1400,
          transformOrigin: '50% 80%',
        });
        if (heroLineRef.current) gsap.set(heroLineRef.current, { opacity: 0, y: 24 });

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: '+=130%',
            scrub: 1.1,
            pin: true,
            anticipatePin: 1,
          },
        });
        heroTl
          .to(heroVeilRef.current, { opacity: 0, duration: 0.35 }, 0)
          .to(heroBezelRef.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.05)
          .to(
            heroDashRef.current,
            { opacity: 1, y: 0, rotateX: 8, rotateY: -4, scale: 1, duration: 0.55 },
            0.12
          )
          .to(heroDashRef.current, { rotateX: 4, rotateY: -2, duration: 0.25 }, 0.5);
        if (heroLineRef.current) {
          heroTl.to(heroLineRef.current, { opacity: 1, y: 0, duration: 0.35 }, 0.35);
        }
      }

      /* —— Màn 2: Y-Core — 3 orbs → merge —— */
      if (coreRef.current && coreGlowRef.current) {
        const orbs = orbRefs.current.filter(Boolean);
        orbs.forEach((el, i) => {
          const spread = (i - 1) * 140;
          gsap.set(el, { x: spread, y: 0, scale: 1, opacity: 1, rotation: 0 });
        });
        gsap.set(coreGlowRef.current, { scale: 0.4, opacity: 0.3 });

        const coreTl = gsap.timeline({
          scrollTrigger: {
            trigger: coreRef.current,
            start: 'top top',
            end: '+=120%',
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });
        coreTl
          .to(
            orbs,
            {
              x: 0,
              y: (i) => (i === 0 ? -20 : i === 2 ? 20 : 0),
              rotation: 360,
              scale: 0.85,
              stagger: 0.05,
              duration: 0.5,
            },
            0
          )
          .to(orbs, { scale: 0.2, opacity: 0, duration: 0.25 }, 0.45)
          .to(coreGlowRef.current, { scale: 1.15, opacity: 1, duration: 0.35 }, 0.4);
      }

      /* —— Màn 3: Performance — counter —— */
      if (perfRef.current && perfNumRef.current) {
        const counter = { v: 0 };
        ScrollTrigger.create({
          trigger: perfRef.current,
          start: 'top 55%',
          end: 'bottom 45%',
          scrub: 0.5,
          onUpdate(self) {
            const target = 10000;
            counter.v = Math.floor(self.progress * target);
            const loc = language === 'ko' ? 'ko-KR' : 'vi-VN';
            perfNumRef.current!.textContent = counter.v.toLocaleString(loc) + '+';
          },
        });
        gsap.from(perfRef.current.querySelectorAll('.perf-reveal'), {
          opacity: 0,
          y: 40,
          stagger: 0.08,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: perfRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
        });
      }

      /* —— Màn 4: XDR — parallax widgets —— */
      if (xdrRef.current) {
        const widgets = xdrWidgetsRef.current.filter(Boolean);
        widgets.forEach((w, i) => {
          const depth = 0.15 + i * 0.12;
          ScrollTrigger.create({
            trigger: xdrRef.current!,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            onUpdate(self) {
              const y = (self.progress - 0.5) * 80 * depth;
              gsap.set(w, { y });
            },
          });
        });
        gsap.from(xdrRef.current.querySelectorAll('.xdr-fade'), {
          opacity: 0,
          y: 30,
          stagger: 0.06,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: { trigger: xdrRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
        });
      }

      /* —— Màn 5: Connectivity —— */
      if (connectRef.current) {
        gsap.from(connectRef.current.querySelectorAll('.conn-item'), {
          opacity: 0,
          scale: 0.85,
          y: 24,
          stagger: 0.12,
          duration: 0.65,
          ease: 'back.out(1.4)',
          scrollTrigger: { trigger: connectRef.current, start: 'top 68%', toggleActions: 'play none none reverse' },
        });
      }

      /* —— Màn 6: Bio —— */
      if (bioRef.current) {
        gsap.from(bioRef.current.querySelectorAll('.bio-fade'), {
          opacity: 0,
          y: 28,
          stagger: 0.08,
          duration: 0.75,
          ease: 'power2.out',
          scrollTrigger: { trigger: bioRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
        });
      }

      /* —— Màn 7: Lineup —— */
      if (lineupRef.current) {
        const devs = lineupDevicesRef.current.filter(Boolean);
        devs.forEach((d, i) => {
          const fromX = i === 0 ? -120 : i === 1 ? 0 : 120;
          gsap.fromTo(
            d,
            { x: fromX, opacity: 0, scale: 0.92 },
            {
              x: 0,
              opacity: 1,
              scale: 1,
              duration: 1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: lineupRef.current!,
                start: 'top 60%',
                toggleActions: 'play none none reverse',
              },
              delay: i * 0.12,
            }
          );
        });
        ScrollTrigger.create({
          trigger: lineupRef.current,
          start: 'top 50%',
          end: 'center center',
          scrub: true,
          onUpdate(self) {
            const glow = 20 + self.progress * 40;
            const a = 0.15 + self.progress * 0.2;
            devs.forEach((d) => {
              (d as HTMLElement).style.boxShadow = `0 0 ${glow}px rgba(16,185,129,${a})`;
            });
          },
        });
      }
    }, root);
    return () => ctx.revert();
  }, [reduced, language]);

  const scrollToCore = () => {
    coreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={rootRef}
      className="hr-pro-apple relative min-h-screen overflow-x-hidden bg-black text-zinc-100 selection:bg-emerald-500/30"
    >
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-1/4 top-0 h-[70vh] w-[70vw] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
        <div className="absolute -right-1/4 bottom-0 h-[60vh] w-[60vw] rounded-full bg-cyan-500/[0.05] blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-zinc-400 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('hrProIntro.backAria')}</span>
          </Button>
          <span className="text-sm font-medium tracking-tight text-white/90">
            {t('hrProIntro.navCenter')}
          </span>
          <MagneticButton
            variant="outline"
            className="border-white/15 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10"
            onClick={() => navigate('/')}
          >
            {t('hrProIntro.ctaStart')}
          </MagneticButton>
        </div>
      </header>

      <main className="relative z-10 pt-12">
        {/* —— Màn 1: Hero —— */}
        <section
          ref={heroRef}
          className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-24 sm:px-8"
        >
          <div
            ref={heroVeilRef}
            className="pointer-events-none absolute inset-0 z-20 bg-black"
            aria-hidden
          />
          <div
            ref={heroBezelRef}
            className="pointer-events-none absolute inset-[8%] z-[19] rounded-[2rem] border border-white/[0.12] opacity-0 shadow-[inset_0_0_60px_rgba(255,255,255,0.04)] sm:inset-[10%]"
            aria-hidden
          />

          <div className="relative z-10 mx-auto w-full max-w-[1440px]">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-left">
                <h1 className="hr-metallic-text text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                  {t('hrProIntro.s1_line1')}
                </h1>
                <p className="mt-4 text-lg text-zinc-400 sm:text-xl">{t('hrProIntro.s1_line2')}</p>
                <div ref={heroLineRef} className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                  <MagneticButton
                    className="rounded-full bg-white px-8 py-4 text-base font-semibold text-black hover:bg-zinc-200"
                    onClick={scrollToCore}
                  >
                    {t('hrProIntro.s1_cta')}
                  </MagneticButton>
                </div>
              </div>

              <div
                className="relative flex justify-center lg:justify-end"
                style={{ perspective: '1400px' }}
              >
                <div ref={heroDashRef} className="w-full max-w-md will-change-transform">
                  <DashboardMock />
                </div>
              </div>
            </div>
          </div>

          <p className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-xs text-zinc-600">
            {t('hrProIntro.scrollCue')}
          </p>
        </section>

        {/* —— Màn 2: Y-Core —— */}
        <section
          ref={coreRef}
          id="hr-core"
          className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-24 sm:px-8"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
          <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
              {t('hrProIntro.secCore')}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t('hrProIntro.s2_h1')}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">
              {t('hrProIntro.s2_p1')}
            </p>
          </div>

          <div className="relative z-10 mt-20 flex h-64 w-full max-w-xl items-center justify-center">
            <div
              ref={coreGlowRef}
              className="absolute h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/50 to-cyan-500/30 blur-3xl"
              aria-hidden
            />
            {[
              { key: 'orbProfile', labelKey: 'hrProIntro.orbProfile' as const },
              { key: 'orbTime', labelKey: 'hrProIntro.orbTime' as const },
              { key: 'orbPay', labelKey: 'hrProIntro.orbPay' as const },
            ].map((item, i) => (
              <div
                key={item.key}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  ref={(el) => {
                    orbRefs.current[i] = el;
                  }}
                  className="flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-medium text-white shadow-lg backdrop-blur-md will-change-transform"
                >
                  {t(item.labelKey)}
                </div>
              </div>
            ))}
            <div className="pointer-events-none absolute text-xs font-semibold uppercase tracking-widest text-emerald-300/80">
              {t('hrProIntro.coreEngine')}
            </div>
          </div>
        </section>

        {/* —— Màn 3: Performance —— */}
        <section
          ref={perfRef}
          className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-24 sm:px-8"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
          <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
            <p className="perf-reveal mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
              {t('hrProIntro.secPerf')}
            </p>
            <div className="perf-reveal mb-2">
              <span
                ref={perfNumRef}
                className="block bg-gradient-to-b from-white via-emerald-200 to-emerald-600 bg-clip-text text-7xl font-bold tabular-nums tracking-tighter text-transparent sm:text-8xl md:text-9xl"
              >
                0+
              </span>
              <p className="mt-2 text-sm text-zinc-500">{t('hrProIntro.s3_statSub')}</p>
            </div>
            <h2 className="perf-reveal mt-10 text-3xl font-semibold text-white sm:text-4xl md:text-5xl">
              {t('hrProIntro.s3_h1')}
            </h2>
            <p className="perf-reveal mt-2 text-xl text-emerald-400/90 sm:text-2xl">{t('hrProIntro.s3_h2')}</p>
            <p className="perf-reveal mx-auto mt-6 max-w-2xl text-base text-zinc-400">
              {t('hrProIntro.s3_p1')}
            </p>
          </div>
        </section>

        {/* —— Màn 4: XDR pearl —— */}
        <section
          ref={xdrRef}
          className="relative min-h-[100dvh] overflow-hidden bg-[#f5f5f7] px-4 py-24 text-zinc-900 sm:px-8"
        >
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <p className="xdr-fade mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
              {t('hrProIntro.secXdr')}
            </p>
            <h2 className="xdr-fade text-3xl font-semibold tracking-tight sm:text-4xl">{t('hrProIntro.s4_h1')}</h2>
            <p className="xdr-fade mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-600">
              {t('hrProIntro.s4_p1')}
            </p>
          </div>

          <div className="relative mx-auto mt-16 h-[420px] w-full max-w-4xl">
            <div
              ref={(el) => {
                if (el) xdrWidgetsRef.current[0] = el;
              }}
              className="absolute left-[5%] top-8 w-56 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xl will-change-transform"
            >
              <div className="h-3 w-20 rounded bg-zinc-200" />
              <div className="mt-3 h-24 rounded-lg bg-gradient-to-br from-emerald-100 to-cyan-100" />
            </div>
            <div
              ref={(el) => {
                if (el) xdrWidgetsRef.current[1] = el;
              }}
              className="absolute left-1/2 top-24 w-64 -translate-x-1/2 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xl will-change-transform"
            >
              <div className="flex gap-2">
                <div className="h-16 flex-1 rounded-lg bg-zinc-100" />
                <div className="h-16 flex-1 rounded-lg bg-emerald-100" />
              </div>
            </div>
            <div
              ref={(el) => {
                if (el) xdrWidgetsRef.current[2] = el;
              }}
              className="absolute bottom-12 right-[8%] w-52 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xl will-change-transform"
            >
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-zinc-200" />
                <div className="h-2 w-4/5 rounded bg-zinc-100" />
                <div className="h-2 w-3/5 rounded bg-zinc-100" />
              </div>
            </div>
          </div>
        </section>

        {/* —— Màn 5: Connectivity —— */}
        <section
          ref={connectRef}
          className="relative flex min-h-[85dvh] flex-col items-center justify-center px-4 py-24 sm:px-8"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#f5f5f7] to-black" />
          <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
              {t('hrProIntro.secConnect')}
            </p>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t('hrProIntro.s5_h1')}</h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400">{t('hrProIntro.s5_p1')}</p>
          </div>
          <div className="relative z-10 mt-14 flex flex-wrap items-center justify-center gap-10 sm:gap-16">
            {[
              { Icon: ScanFace, label: 'hrProIntro.connectFace' as const },
              { Icon: Fingerprint, label: 'hrProIntro.connectFinger' as const },
              { Icon: Radio, label: 'hrProIntro.connectDevice' as const },
            ].map(({ Icon, label }) => (
              <div key={label} className="conn-item flex flex-col items-center gap-3">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
                  <Icon className="h-9 w-9 text-emerald-400" strokeWidth={1.25} />
                  <span className="absolute -right-1 -top-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                </div>
                <span className="max-w-[120px] text-center text-xs text-zinc-500">{t(label)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* —— Màn 6: Biometric —— */}
        <section ref={bioRef} className="relative flex min-h-[100dvh] flex-col px-4 py-24 sm:px-8">
          <div className="absolute inset-0 bg-black" />
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
            <div className="bio-fade max-w-xl flex-1 text-center lg:text-left">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/80">
                {t('hrProIntro.secBio')}
              </p>
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">{t('hrProIntro.s6_h1')}</h2>
              <p className="mt-5 text-base leading-relaxed text-zinc-400">{t('hrProIntro.s6_p1')}</p>
            </div>
            <div className="bio-fade relative flex h-[min(420px,55vh)] w-full max-w-md flex-1 justify-center">
              <ParticleShield sectionRef={bioRef} />
            </div>
          </div>
        </section>

        {/* —— Màn 7: Lineup —— */}
        <section
          ref={lineupRef}
          className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-32 pt-24 sm:px-8"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-black" />
          <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl md:text-5xl">{t('hrProIntro.s7_h1')}</h2>
            <p className="mt-3 text-xl text-emerald-400/90">{t('hrProIntro.s7_h2')}</p>
          </div>
          <div className="relative z-10 mt-16 flex w-full max-w-5xl flex-wrap items-end justify-center gap-6 sm:gap-10">
            {[
              { Icon: Monitor, w: 'w-40 sm:w-48' },
              { Icon: Laptop, w: 'w-36 sm:w-44' },
              { Icon: Smartphone, w: 'w-20 sm:w-24' },
            ].map(({ Icon, w }, i) => (
              <div
                key={i}
                ref={(el) => {
                  if (el) lineupDevicesRef.current[i] = el;
                }}
                className={cn(
                  'lineup-glow flex flex-col items-center justify-end rounded-2xl border border-white/10 bg-zinc-900/50 p-6 will-change-transform',
                  w
                )}
              >
                <Icon className="h-full w-full text-zinc-400" strokeWidth={0.75} />
              </div>
            ))}
          </div>
          <div className="relative z-10 mt-14 flex flex-wrap justify-center gap-4">
            <MagneticButton
              className="rounded-full bg-white px-10 py-4 text-base font-semibold text-black hover:bg-zinc-200"
              onClick={() => navigate('/')}
            >
              {t('hrProIntro.ctaStart')}
            </MagneticButton>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={() => navigate('/')}
            >
              {t('hrProIntro.ctaGuide')}
            </Button>
          </div>
        </section>
      </main>

      <aside className="fixed bottom-4 right-4 z-40 hidden max-w-[220px] rounded-xl border border-white/10 bg-black/80 p-3 text-[11px] text-zinc-500 backdrop-blur-md sm:block">
        <p className="font-medium text-zinc-400">{t('hrProIntro.guideTitle')}</p>
        <p className="mt-1 leading-snug">{t('hrProIntro.guideBody')}</p>
      </aside>
    </div>
  );
}
