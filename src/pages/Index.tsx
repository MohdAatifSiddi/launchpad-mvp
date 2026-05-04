import { Link } from "react-router-dom";

const themeStyle: React.CSSProperties & Record<string, string> = {
  ["--background"]: "201 100% 13%",
  ["--foreground"]: "0 0% 100%",
  ["--muted-foreground"]: "240 4% 66%",
  ["--primary"]: "0 0% 100%",
  ["--primary-foreground"]: "0 0% 4%",
  ["--secondary"]: "0 0% 10%",
  ["--muted"]: "0 0% 10%",
  ["--accent"]: "0 0% 10%",
  ["--border"]: "0 0% 18%",
  ["--input"]: "0 0% 18%",
  fontFamily: "'Inter', sans-serif",
};

const serif = { fontFamily: "'Instrument Serif', serif" };

const Index = () => {
  return (
    <div style={themeStyle} className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
      />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-7xl flex-row items-center justify-between px-8 py-6">
        <Link to="/" className="text-3xl tracking-tight text-foreground" style={serif}>
          Velorah<sup className="text-xs">®</sup>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#" className="text-sm text-foreground transition-colors">Home</a>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Studio</a>
          <Link to="/legal/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">About</Link>
          <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Journal</a>
          <Link to="/legal/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Reach Us</Link>
        </div>
        <Link
          to="/auth?mode=signup"
          className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03]"
        >
          Begin Journey
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center px-6 pb-40 pt-32 py-[90px] text-center">
        <h1
          style={{ ...serif, letterSpacing: "-2.46px" }}
          className="animate-fade-rise max-w-7xl text-5xl font-normal leading-[0.95] sm:text-7xl md:text-8xl"
        >
          Where <em className="not-italic text-muted-foreground">dreams</em> rise{" "}
          <em className="not-italic text-muted-foreground">through the silence.</em>
        </h1>
        <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          We're designing tools for deep thinkers, bold creators, and quiet rebels. Amid the chaos, we build digital spaces for sharp focus and inspired work.
        </p>
        <Link
          to="/auth?mode=signup"
          className="liquid-glass animate-fade-rise-delay-2 mt-12 cursor-pointer rounded-full px-14 py-5 text-base text-foreground hover:scale-[1.03]"
        >
          Begin Journey
        </Link>
      </section>
    </div>
  );
};

export default Index;
