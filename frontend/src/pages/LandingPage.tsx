import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 bg-grid">
      {/* Top Header */}
      <header className="px-6 py-6 flex justify-between items-center max-w-7xl mx-auto w-full border-b border-zinc-900/50">
        <div className="text-xl font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Acnerra
        </div>
        <nav className="flex gap-4 items-center">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">Get Started</Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto py-20 lg:py-28 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="inline-block px-3 py-1.5 mb-6 text-[10px] font-bold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 rounded-full">
          Partner Accountability
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] text-zinc-50 max-w-3xl">
          Achieve goals through absolute <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">consistency</span>.
        </h1>
        
        <p className="text-base md:text-lg text-zinc-400 mb-12 max-w-2xl leading-relaxed">
          Acnerra combines modular task tracking with shared partner accountability to double your goal achievement rate. 1:1 check-ins, automated deadline triggers, and transparency.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link to="/register">
            <Button variant="primary" size="lg" className="w-full sm:w-auto shadow-2xl shadow-indigo-600/25">
              Start Free Today
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Explore Demo
            </Button>
          </Link>
        </div>
      </main>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto w-full px-6 py-16 border-t border-zinc-900/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 font-bold">1</div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Create Milestones</h3>
            <p className="text-sm text-zinc-400">Map out your accountability priorities with statuses, detailed subtasks, and target dates.</p>
          </div>
          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 font-bold">2</div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Accountability Partner</h3>
            <p className="text-sm text-zinc-400">Invite a buddy to inspect your progress. Maintain peer momentum with mutual checkpoints.</p>
          </div>
          <div className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all duration-300">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 font-bold">3</div>
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Daily Check-Ins</h3>
            <p className="text-sm text-zinc-400">Verify execution details daily. Build chains of consistency that inspire absolute reliability.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 px-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-500 text-xs">
          <div>© 2024 Acnerra. Built for team consistency.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
