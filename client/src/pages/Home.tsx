// Design: Fintech Aurora — glassmorphism escuro, verde-esmeralda proprietário, dourado de autoridade e ritmo assimétrico.
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Mail, Menu, Sparkles } from "lucide-react";

const heroImage = "/manus-storage/analisai-hero-aurora_947786f4.png";
const proofTexture = "/manus-storage/analisai-proof-texture_b4a25c84.png";
const contactGlow = "/manus-storage/analisai-contact-glow_08e85c6f.png";
const markImage = "/manus-storage/analisai-mark_faf1e76b.png";

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="AnalisaAI.me — início">
      <img src={markImage} alt="" />
      <span>AnalisaAI<span className="brand-dot">.me</span></span>
    </a>
  );
}

function ProofCarousel() {
  const testimonials: Array<{ quote: string; name: string; role: string }> = [];
  const [active, setActive] = useState(0);
  const hasTestimonials = testimonials.length > 0;

  useEffect(() => {
    if (!hasTestimonials) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % testimonials.length), 6000);
    return () => window.clearInterval(timer);
  }, [hasTestimonials, testimonials.length]);

  const current = useMemo(() => testimonials[active], [active, testimonials]);

  return (
    <section className="proof-section" id="prova-social" aria-labelledby="proof-title">
      <div className="proof-texture" style={{ backgroundImage: `url(${proofTexture})` }} />
      <div className="section-kicker"><Sparkles size={15} /> Clareza que aparece no resultado</div>
      <div className="proof-heading-row">
        <div>
          <h2 id="proof-title">Mais controle para você<br /><em>decidir melhor.</em></h2>
          <p className="section-lede">Um espaço preparado para reunir depoimentos reais de clientes e mostrar, com transparência, como a rotina financeira pode ficar mais leve.</p>
        </div>
        {hasTestimonials ? (
          <div className="carousel-count" aria-live="polite">0{active + 1} <span>/ 0{testimonials.length}</span></div>
        ) : null}
      </div>
      <div className="testimonial-frame" aria-live="polite">
        {hasTestimonials && current ? (
          <>
            <blockquote>“{current.quote}”</blockquote>
            <div className="testimonial-meta"><strong>{current.name}</strong><span>{current.role}</span></div>
            <div className="carousel-controls">
              <button type="button" onClick={() => setActive((active - 1 + testimonials.length) % testimonials.length)} aria-label="Depoimento anterior"><ChevronLeft size={18} /></button>
              <div className="carousel-dots">{testimonials.map((item, index) => <button key={item.name} className={index === active ? "active" : ""} onClick={() => setActive(index)} aria-label={`Ir para depoimento ${index + 1}`} />)}</div>
              <button type="button" onClick={() => setActive((active + 1) % testimonials.length)} aria-label="Próximo depoimento"><ChevronRight size={18} /></button>
            </div>
          </>
        ) : (
          <div className="testimonial-empty">
            <span className="empty-index">01</span>
            <div>
              <strong>Depoimentos reais, no tempo certo.</strong>
              <p>Este carrossel está pronto para receber histórias verificadas dos clientes AnalisaAI.me. A prova social só entra aqui com autorização e dados fornecidos pela empresa.</p>
            </div>
            <a href="mailto:contato@analisai.me?subject=Depoimentos%20AnalisaAI.me">Enviar conteúdo <ArrowRight size={16} /></a>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main id="top" className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Abrir menu"><Menu size={20} /></button>
          <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Navegação principal">
            <a href="mailto:contato@analisai.me?subject=Login%20AnalisaAI.me">Login</a>
            <a href="#painel">Painel Contador</a>
            <a className="nav-cta" href="#conheca">Conheça <ArrowRight size={15} /></a>
          </nav>
        </div>
      </header>

      <section className="hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(3, 8, 21, .18), rgba(3, 8, 21, .72)), url(${heroImage})` }}>
        <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" />
        <div className="hero-content">
          <div className="eyebrow"><span className="eyebrow-mark">↗</span> BPO FINANCEIRO <span className="eyebrow-divider">—</span> SOLUÇÃO ASSESSORIA VIRTUAL</div>
          <h1>Seu financeiro sob controle,<br /><span>sem contratar ninguém.</span></h1>
          <p>Terceirize contas a pagar, contas a receber, conciliação bancária e gerencial com especialistas dedicados. Atendimento rápido e sem burocracia.</p>
          <div className="hero-actions"><a className="primary-button" href="mailto:contato@analisai.me?subject=Agendar%20diagnóstico">Agendar diagnóstico <ArrowRight size={18} /></a><span className="hero-note">Resposta humana em até 1 dia útil</span></div>
        </div>
      </section>

      <ProofCarousel />

      <section className="contact-section" id="conheca" aria-labelledby="contact-title">
        <img className="contact-glow" src={contactGlow} alt="" />
        <div className="contact-copy"><div className="section-kicker"><Mail size={15} /> Fale com a gente</div><h2 id="contact-title">Menos ruído.<br /><span>Mais direção.</span></h2><p>Conte o que sua operação precisa organizar e receba uma conversa direta, sem apresentações genéricas.</p></div>
        <a className="email-card" href="mailto:contato@analisai.me"><span>contato@analisai.me</span><ArrowRight size={18} /></a>
      </section>

      <footer className="site-footer"><Logo /><span>© 2026 AnalisaAI.me. Inteligência financeira para decisões melhores.</span><a href="mailto:contato@analisai.me">contato@analisai.me</a></footer>
    </main>
  );
}
