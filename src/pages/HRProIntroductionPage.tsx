import { useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { MagneticButton } from '@/pages/hr-pro-intro/MagneticButton';
import { ParticleShield } from '@/pages/hr-pro-intro/ParticleShield';

gsap.registerPlugin(ScrollTrigger);

const PERF_FLOATS = [
  { t: '1840.5h', l: '8%', top: '12%' },
  { t: 'NV-2044', l: '72%', top: '18%' },
  { t: 'OT++', l: '18%', top: '68%' },
  { t: '12 ca', l: '80%', top: '52%' },
  { t: '99.2%', l: '42%', top: '8%' },
  { t: 'λ sort', l: '55%', top: '72%' },
  { t: 'Σ 48k', l: '12%', top: '38%' },
  { t: 'sync', l: '88%', top: '34%' },
  { t: '176ms', l: '28%', top: '82%' },
  { t: 'batch', l: '62%', top: '28%' },
  { t: 'HR-Δ', l: '5%', top: '55%' },
  { t: '8.4M', l: '75%', top: '78%' },
];

function DashboardMock({ t, className }: { t: (k: string) => string; className?: string }) {
  return (
    <div className={cn('hr-hero-dash relative w-full max-w-lg sm:max-w-xl lg:max-w-none lg:max-w-[min(100%,560px)]', className)}>
      <div
        className={cn(
          'relative rounded-[1.35rem] p-px',
          'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_40px_100px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]'
        )}
        style={{
          background: 'linear-gradient(150deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 50%, rgba(140,160,200,0.1) 100%)',
        }}
      >
        <div className="overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#14141a] via-[#0c0c10] to-[#030304] px-5 pb-8 pt-6 sm:px-7 sm:pb-9 sm:pt-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-white/45">
              {t('hrProIntro.mockBadge')}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.65)]" />
          </div>
          <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{t('hrProIntro.mockTitle')}</p>
          <p className="mt-1.5 text-xs text-white/40">{t('hrProIntro.mockSub')}</p>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[72, 94, 88].map((n, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-1 py-3 text-center backdrop-blur-sm"
              >
                <p className="text-base font-semibold tabular-nums text-white sm:text-lg">{n}%</p>
                <p className="mt-0.5 text-[8px] uppercase tracking-wider text-white/30">KPI</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HRProIntroductionPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const archRef = useRef<HTMLElement>(null);
  const perfRef = useRef<HTMLElement>(null);
  const perfParallaxRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<HTMLElement>(null);
  const shieldRef = useRef<HTMLElement>(null);
  const closingRef = useRef<HTMLElement>(null);

  const scrollToGuide = useCallback(() => {
    document.getElementById('hr-pro-guide')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const scrollToArch = useCallback(() => {
    archRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToHighlights = useCallback(() => {
    document.getElementById('hr-pro-highlights')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set('.hr-hero-line, .hr-hero-dash, .hr-scroll-cue, .arch-layer, .perf-float, .perf-chart, .perf-bg-slow, .phone-3d, .phone-inner, .phone-tick, .closing-brand, .closing-fade', {
        clearProps: 'all',
      });
      gsap.set('.hr-hero-line, .hr-hero-dash, .hr-scroll-cue', { opacity: 1, y: 0, scale: 1 });
      gsap.set('.arch-layer', { opacity: 1 });
      gsap.set('.perf-chart', { opacity: 1, scale: 1 });
      gsap.set('.perf-float', { opacity: 0.35 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to('.hr-logo-sheen', {
        rotation: 360,
        duration: 18,
        repeat: -1,
        ease: 'none',
      });

      gsap.set('.hr-hero-line', { yPercent: 120, opacity: 0 });
      gsap.set('.hr-hero-dash', { scale: 0.82, opacity: 0, y: 48 });
      gsap.set('.hr-scroll-cue', { opacity: 0, y: 12 });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 0.75,
          },
        })
        .to('.hr-hero-line', { yPercent: 0, opacity: 1, stagger: 0.14, ease: 'power2.out' }, 0.06)
        .to('.hr-hero-dash', { scale: 1, opacity: 1, y: 0, ease: 'power2.out' }, 0.22)
        .to('.hr-scroll-cue', { opacity: 0.55, y: 0, ease: 'power1.out' }, 0.72);

      const archLayers = gsap.utils.toArray<HTMLElement>('.arch-layer');
      gsap.set(archLayers, {
        transformPerspective: 1400,
        transformOrigin: '50% 50%',
        force3D: true,
      });
      gsap
        .timeline({
          scrollTrigger: {
            trigger: archRef.current,
            start: 'top top',
            end: '+=240%',
            pin: true,
            scrub: 0.85,
          },
        })
        .fromTo(
          archLayers,
          { z: 0, y: 0, rotateX: 6, rotationY: 0, opacity: 0.9 },
          {
            z: (i) => 40 + (archLayers.length - 1 - i) * 56,
            y: (i) => -i * 24,
            rotateX: 22,
            rotationY: (i) => -8 + i * 5,
            opacity: 1,
            stagger: 0.04,
            ease: 'none',
            force3D: true,
          },
          0
        )
        .to('.arch-light', { backgroundPosition: '220% 50%', ease: 'none', duration: 1 }, 0);

      gsap.set('.perf-float', { x: 0, y: 0, scale: 1, opacity: 0.45 });
      gsap.set('.perf-chart', { scale: 0.35, opacity: 0 });
      gsap.set('.perf-bg-slow', { y: 0 });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: perfRef.current,
            start: 'top top',
            end: '+=210%',
            pin: true,
            scrub: 0.95,
            onUpdate: (self) => {
              const fast = perfParallaxRef.current?.querySelector('.perf-parallax-fast') as HTMLElement | null;
              if (fast) gsap.set(fast, { y: self.progress * -120 });
            },
          },
        })
        .to('.perf-float', { scale: 0.15, opacity: 0, x: '42vw', y: '28vh', stagger: 0.03, ease: 'power2.in' }, 0.25)
        .to('.perf-chart', { scale: 1, opacity: 1, ease: 'power2.out' }, 0.48)
        .to('.perf-bg-slow', { y: -80, ease: 'none' }, 0);

      gsap.set('.phone-3d', { transformPerspective: 1100, rotateY: -26, rotateX: 8 });
      gsap.set('.phone-inner', { y: '0%' });
      gsap.set('.phone-tick', { scale: 0, opacity: 0 });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: touchRef.current,
            start: 'top top',
            end: '+=190%',
            pin: true,
            scrub: 0.8,
          },
        })
        .to('.phone-3d', { rotateY: 4, rotateX: 2, ease: 'none' }, 0)
        .to('.phone-inner', { y: '-38%', ease: 'none' }, 0.08)
        .to('.phone-tick', { scale: 1, opacity: 1, ease: 'back.out(2)' }, 0.55);

      gsap.set('.closing-brand', { opacity: 0, scale: 0.92, filter: 'blur(12px)' });
      gsap.set('.closing-fade', { opacity: 0, y: 24 });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: closingRef.current,
            start: 'top 80%',
            end: 'top 20%',
            scrub: 0.6,
          },
        })
        .to('.closing-brand', { opacity: 1, scale: 1, filter: 'blur(0px)', ease: 'power2.out' }, 0)
        .to('.closing-fade', { opacity: 1, y: 0, stagger: 0.08, ease: 'power2.out' }, 0.12);
    }, root);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="hr-pro-apple min-h-screen bg-black text-white antialiased [font-feature-settings:'ss01','cv11']"
    >
      <header className="sticky top-0 z-[200] flex h-12 items-center border-b border-white/[0.08] bg-black/80 px-5 backdrop-saturate-150 backdrop-blur-xl sm:h-[52px] sm:px-8 lg:px-14 xl:px-20">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-9 w-9 shrink-0 text-white hover:bg-white/10 hover:text-white"
          aria-label={t('hrProIntro.backAria')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[15px] font-semibold tracking-tight text-white/95">
          {t('hrProIntro.navCenter')}
        </span>
        <div className="w-9 shrink-0 sm:w-10" aria-hidden />
      </header>

      {/* Phân cảnh 1 — Hero (kiểu apple.com/iphone — tiêu đề khổng lồ + CTA) */}
      <section
        ref={heroRef}
        className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-black px-5 pb-16 pt-8 sm:px-8 lg:px-14 xl:px-20"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 100% 80% at 30% -20%, rgba(80,100,160,0.2), transparent 50%), radial-gradient(ellipse 70% 50% at 100% 40%, rgba(40,60,100,0.14), transparent 45%), #000',
          }}
        />

        <div className="relative z-[1] mx-auto w-full max-w-[1440px]">
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left xl:gap-16">
            <div className="w-full shrink-0 lg:max-w-[min(42rem,48%)] xl:max-w-[min(44rem,46%)]">
              <p className="hr-apple-eyebrow mb-6 sm:mb-8 lg:mb-6">{t('hrProIntro.heroEyebrow')}</p>

              <div className="relative inline-block lg:block">
                <div
                  className="hr-logo-sheen pointer-events-none absolute -inset-6 rounded-[2rem] opacity-50 sm:-inset-10 sm:rounded-[2.5rem]"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.04) 12%, rgba(200,220,255,0.28) 50%, transparent 68%, transparent 100%)',
                  }}
                />
                <div className="overflow-hidden px-2 lg:px-0">
                  <h1 className="hr-hero-line hr-apple-headline text-[clamp(3rem,11vw,7rem)] font-semibold tracking-[-0.04em] text-white xl:text-[clamp(3.5rem,6.5vw,6.5rem)]">
                    {t('hrProIntro.heroMega')}
                  </h1>
                </div>
              </div>

              <div className="mt-6 overflow-hidden sm:mt-8 lg:mt-6">
                <p className="hr-hero-line text-[clamp(1.25rem,3.2vw,1.85rem)] font-medium leading-snug text-white/88 xl:text-[clamp(1.35rem,2.2vw,2rem)]">
                  {t('hrProIntro.heroLine1')}
                </p>
              </div>
              <div className="mt-3 overflow-hidden sm:mt-4">
                <p className="hr-hero-line text-[clamp(1rem,2.2vw,1.25rem)] font-normal text-[#a1a1a6]">{t('hrProIntro.heroLine2')}</p>
              </div>

              <p className="mt-4 text-sm text-[#6e6e73]">{t('hrProIntro.heroBrand')}</p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:mt-12 lg:justify-start">
                <button type="button" className="hr-apple-cta" onClick={scrollToArch}>
                  {t('hrProIntro.exploreCta')}
                </button>
                <button type="button" className="hr-apple-link bg-transparent font-normal" onClick={scrollToHighlights}>
                  {t('hrProIntro.learnMore')}
                </button>
              </div>
            </div>

            <div className="mt-12 flex w-full justify-center lg:mt-0 lg:w-auto lg:flex-1 lg:justify-end xl:justify-center">
              <DashboardMock t={t} className="mt-0" />
            </div>
          </div>

          <p className="hr-scroll-cue mt-14 text-center text-xs font-medium uppercase tracking-[0.2em] text-[#6e6e73] lg:mt-16">
            {t('hrProIntro.scrollCue')}
          </p>
        </div>
      </section>

      {/* Highlights — rail cuộn ngang full-bleed kiểu “Get the highlights” (apple.com) */}
      <section id="hr-pro-highlights" className="relative z-[4] border-t border-white/[0.06] bg-black py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14 xl:px-20">
          <h2 className="hr-apple-headline mb-3 text-[clamp(2rem,4vw,3.5rem)] text-white">{t('hrProIntro.highlightsTitle')}</h2>
          <p className="hr-apple-body mb-10 max-w-[42rem] text-left text-[#a1a1a6] lg:mb-12">{t('hrProIntro.highlightsLead')}</p>
        </div>
        <div className="hr-apple-scroll-rail snap-x snap-mandatory w-full overflow-x-auto overflow-y-hidden scroll-smooth overscroll-x-contain">
          <div className="flex w-max gap-4 px-5 pb-4 pt-1 sm:gap-5 sm:px-8 lg:gap-6 lg:pl-14 lg:pr-14 xl:pl-20 xl:pr-20">
            {(['hl1', 'hl2', 'hl3', 'hl4', 'hl5', 'hl6'] as const).map((key, i) => (
              <div
                key={key}
                className={cn(
                  'flex min-h-[160px] w-[min(78vw,340px)] shrink-0 snap-start flex-col justify-end rounded-[1.75rem] border border-white/[0.08] bg-[#1d1d1f] p-8 transition-colors duration-300 sm:w-[min(72vw,380px)] sm:min-h-[180px] lg:w-[min(42vw,480px)] lg:min-h-[200px] xl:w-[440px]',
                  i === 5 && 'mr-5 sm:mr-8 lg:mr-14 xl:mr-20'
                )}
              >
                <p className="text-[clamp(1.05rem,2.5vw,1.35rem)] font-semibold leading-snug tracking-tight text-white">{t(`hrProIntro.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Phân cảnh 2 — Kiến trúc / exploded — bố cục ngang desktop */}
      <section ref={archRef} className="relative z-[5] bg-[#000000]">
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col items-center justify-center gap-14 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-14 lg:py-12 xl:gap-12 xl:px-20">
          <div className="arch-stage relative flex min-h-[300px] w-full max-w-xl shrink-0 items-center justify-center [perspective:1400px] lg:min-h-[360px] lg:w-[52%] lg:max-w-none xl:min-h-[400px] xl:w-[55%]">
            <div className="arch-light pointer-events-none absolute inset-0 rounded-3xl opacity-50 [background:linear-gradient(110deg,transparent_0%,rgba(120,170,255,0.18)_42%,rgba(180,120,255,0.14)_58%,transparent_100%)] [background-size:200%_100%] [background-position:0%_50%]" />
            <div className="relative h-[220px] w-full max-w-lg lg:h-[240px] lg:max-w-xl xl:h-[260px]">
              {[t('hrProIntro.layerPay'), t('hrProIntro.layerAtt'), t('hrProIntro.layerHr'), t('hrProIntro.layerCore')].map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    'arch-layer absolute inset-0 m-auto flex h-[178px] max-h-[88%] w-[92%] flex-col justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] px-6 py-8 shadow-2xl backdrop-blur-xl lg:h-[200px]',
                    i === 3 && 'ring-1 ring-cyan-400/30'
                  )}
                  style={{ maxWidth: '32rem' }}
                >
                  <p className="text-center text-sm font-semibold tracking-wide text-white/88">{label}</p>
                  <div className="mt-4 h-2 w-2/5 rounded-full bg-white/10" />
                  <div className="mt-2 h-2 w-full rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-20 w-full max-w-xl text-center lg:max-w-md lg:text-left xl:max-w-lg">
            <p className="hr-apple-eyebrow mb-3 text-[#6e6e73]">{t('hrProIntro.secArch')}</p>
            <h2 className="hr-apple-headline text-[clamp(2rem,4.5vw,4rem)] text-white">{t('hrProIntro.archH1')}</h2>
            <h2 className="hr-apple-headline mt-1 text-[clamp(1.75rem,3.5vw,3rem)] text-indigo-200/95">{t('hrProIntro.archH2')}</h2>
            <p className="hr-apple-body mt-8 text-left lg:mt-10">{t('hrProIntro.archP1')}</p>
          </div>
        </div>
      </section>

      {/* Phân cảnh 3 — Hiệu năng / space gray */}
      <section ref={perfRef} className="relative z-[6] bg-[#1d1d1f] text-white">
        <div
          ref={perfParallaxRef}
          className="perf-bg-slow pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="perf-parallax-fast pointer-events-none absolute inset-0 opacity-[0.07]" style={{ willChange: 'transform' }} />

        <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col justify-center overflow-hidden px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:gap-10 lg:px-14 lg:py-16 xl:gap-16 xl:px-20">
          <div className="relative z-10 flex w-full flex-1 flex-col items-center lg:items-stretch">
            {PERF_FLOATS.map((item) => (
              <span
                key={item.t}
                className="perf-float pointer-events-none absolute font-mono text-[11px] font-medium text-white/50 sm:text-xs"
                style={{ left: item.l, top: item.top }}
              >
                {item.t}
              </span>
            ))}

            <div className="perf-chart relative z-10 mx-auto mt-4 w-full max-w-md lg:mx-0 lg:mt-0 lg:max-w-none xl:pr-4">
              <div className="rounded-2xl border border-cyan-400/40 bg-gradient-to-b from-[#0c1220] to-[#060a12] p-6 shadow-[0_0_60px_-12px_rgba(34,211,238,0.35)] ring-1 ring-violet-500/20 lg:p-8">
                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Throughput</p>
                <div className="mt-6 flex h-36 items-end justify-center gap-2 sm:h-40 sm:gap-3 lg:h-44">
                  {[40, 65, 45, 88, 55, 92, 70].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-t-sm bg-gradient-to-t from-cyan-500/30 to-violet-400/90 sm:w-2.5 lg:w-3"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-12 grid w-full max-w-xl grid-cols-3 gap-4 sm:gap-6 lg:mt-14 lg:max-w-none">
              {[
                { v: t('hrProIntro.statBig1'), lab: t('hrProIntro.statBig1Lab') },
                { v: t('hrProIntro.statBig2'), lab: t('hrProIntro.statBig2Lab') },
                { v: t('hrProIntro.statBig3'), lab: t('hrProIntro.statBig3Lab') },
              ].map((row) => (
                <div key={row.lab} className="text-center lg:text-left">
                  <p className="text-[clamp(1.65rem,4vw,2.75rem)] font-semibold leading-none tracking-tight text-white xl:text-[clamp(2rem,3vw,3.25rem)]">
                    {row.v}
                  </p>
                  <p className="mt-2 text-[12px] leading-snug text-[#a1a1a6] sm:text-[14px] lg:max-w-[10rem]">{row.lab}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-14 w-full max-w-xl shrink-0 text-center lg:mt-0 lg:max-w-md lg:text-left xl:max-w-lg">
            <p className="hr-apple-eyebrow mb-3 text-[#86868b]">{t('hrProIntro.secPerf')}</p>
            <h2 className="hr-apple-headline text-[clamp(2rem,4vw,3.5rem)] text-white">{t('hrProIntro.perfH1')}</h2>
            <h2 className="hr-apple-headline mt-1 text-[clamp(1.5rem,2.8vw,2.25rem)] font-medium text-emerald-200/90">
              {t('hrProIntro.perfH2')}
            </h2>
            <p className="mt-8 text-[17px] leading-[1.47] text-[#a1a1a6] sm:text-[19px]">{t('hrProIntro.perfP1')}</p>
          </div>
        </div>
      </section>

      {/* Phân cảnh 4 — Pearl / điện thoại */}
      <section ref={touchRef} className="hr-pro-apple-light relative z-[7] bg-[#fbfbfd] text-[#1d1d1f]">
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col items-center justify-center gap-14 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-14 xl:gap-20 xl:px-20">
          <div className="flex w-full justify-center [perspective:1200px] lg:w-auto lg:flex-1 lg:justify-center">
            <div className="phone-3d w-full max-w-[260px] will-change-transform sm:max-w-[280px] lg:max-w-[300px]" style={{ transformStyle: 'preserve-3d' }}>
              <div className="rounded-[2rem] border border-neutral-300/90 bg-gradient-to-b from-white to-neutral-100 p-2.5 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.05]">
                <div className="relative h-[420px] overflow-hidden rounded-[1.55rem] bg-neutral-950 sm:h-[460px]">
                  <div className="phone-inner absolute left-0 right-0 top-0 px-4 pb-8 pt-5 will-change-transform" style={{ height: '160%' }}>
                    <div className="h-2 w-1/3 rounded-full bg-white/15" />
                    <p className="mt-6 text-sm font-semibold text-white">Payslip</p>
                    <div className="mt-3 h-24 rounded-xl bg-white/10" />
                    <p className="mt-6 text-sm font-semibold text-white">Leave</p>
                    <div className="mt-3 h-20 rounded-xl bg-white/8" />
                    <p className="mt-6 text-sm font-semibold text-white">Profile</p>
                    <div className="mt-3 h-28 rounded-xl bg-white/8" />
                  </div>
                  <div className="phone-tick pointer-events-none absolute bottom-8 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
                    <Check className="h-6 w-6 text-white" strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full max-w-[480px] shrink-0 lg:max-w-[min(40%,28rem)] xl:max-w-md">
            <p className="hr-apple-eyebrow mb-3">{t('hrProIntro.secTouch')}</p>
            <h2 className="hr-apple-headline text-[clamp(2rem,4.5vw,3.25rem)] text-[#1d1d1f]">{t('hrProIntro.touchH1')}</h2>
            <h2 className="hr-apple-headline mt-1 text-[clamp(1.75rem,3.5vw,2.75rem)] text-[#6e6e73]">{t('hrProIntro.touchH2')}</h2>
            <p className="hr-apple-body mt-8 text-left">{t('hrProIntro.touchP1')}</p>
            <p className="mt-5 text-[15px] font-medium text-[#0071e3]">{t('hrProIntro.phoneOk')}</p>
          </div>
        </div>
      </section>

      {/* Phân cảnh 5 — Khiên / particles */}
      <section ref={shieldRef} className="relative z-[8] overflow-hidden bg-black py-24 sm:py-32">
        <ParticleShield sectionRef={shieldRef} />
        <div className="relative z-10 mx-auto max-w-[min(100%,920px)] px-5 text-center lg:px-14 xl:px-20">
          <p className="hr-apple-eyebrow mb-4 text-[#6e6e73]">{t('hrProIntro.secShield')}</p>
          <h2 className="hr-metallic-text hr-apple-headline text-[clamp(2rem,5vw,3.75rem)]">{t('hrProIntro.shieldH1')}</h2>
          <h2 className="hr-apple-headline mt-2 text-[clamp(1.75rem,4vw,3rem)] text-white/50">{t('hrProIntro.shieldH2')}</h2>
          <p className="mt-10 text-[17px] leading-[1.47] text-[#a1a1a6] sm:text-[19px]">{t('hrProIntro.shieldP1')}</p>
        </div>
      </section>

      <section id="hr-pro-guide" className="border-t border-white/[0.06] bg-[#000] px-5 py-20 sm:px-8 lg:px-14 xl:px-20">
        <div className="mx-auto max-w-[min(100%,800px)] text-center">
          <p className="hr-apple-eyebrow mb-3 text-[#6e6e73]">{t('common.help')}</p>
          <h3 className="hr-apple-headline text-[clamp(1.75rem,3.5vw,2.5rem)] text-white">{t('hrProIntro.guideTitle')}</h3>
          <p className="mt-5 text-[17px] leading-[1.47] text-[#a1a1a6]">{t('hrProIntro.guideBody')}</p>
        </div>
      </section>

      {/* Phân cảnh 6 — Horizon & CTA */}
      <footer
        ref={closingRef}
        className="relative z-[9] overflow-hidden bg-gradient-to-b from-black via-[#030308] to-[#061520] px-5 py-28 sm:px-8 lg:px-14 xl:px-20"
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#0a3d5c]/40 to-transparent" />
        <div className="relative mx-auto max-w-[min(100%,1100px)] text-center">
          <div className="closing-brand">
            <p className="hr-apple-eyebrow text-[#6e6e73]">{t('hrProIntro.heroEyebrow')}</p>
            <p className="mt-2 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-tight text-white">HR Pro</p>
          </div>
          <h2 className="closing-fade hr-apple-headline mt-14 text-[clamp(1.75rem,4vw,2.75rem)] leading-tight text-white">
            {t('hrProIntro.closingH1')}
          </h2>
          <p className="closing-fade mt-5 text-[19px] leading-snug text-[#a1a1a6]">{t('hrProIntro.closingH2')}</p>
          <div className="closing-fade mt-14 flex flex-wrap items-center justify-center gap-5">
            <MagneticButton variant="apple" onClick={() => navigate('/')}>
              {t('hrProIntro.ctaDashboard')}
            </MagneticButton>
            <MagneticButton variant="outline" onClick={scrollToGuide}>
              {t('hrProIntro.ctaGuide')}
            </MagneticButton>
          </div>
          <p className="closing-fade mt-24 text-xs tracking-[0.2em] text-[#424245]">Copyright © {new Date().getFullYear()} Yousung Vina. HR Pro.</p>
        </div>
      </footer>
    </div>
  );
}
