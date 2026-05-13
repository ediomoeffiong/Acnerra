import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      <header className="px-6 py-8 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Acnerra
        </div>
        <nav className="flex gap-6 items-center">
          <Link href="/login" className="text-slate-400 hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/register" className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-full font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
            Get Started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto py-20">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 rounded-full">
          Collaborative Accountability
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
          Crush your goals with <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">partners</span>.
        </h1>
        <p className="text-xl text-slate-400 mb-12 max-w-2xl leading-relaxed">
          Acnerra is the accountability platform designed for teams and partners who want to stay productive together. 1:1 accountability, real-time check-ins, and task management.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/register" className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center group">
            Start Your Journey
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link href="/dashboard" className="bg-slate-900 border border-slate-800 hover:bg-slate-800 px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center">
            View Dashboard
          </Link>
        </div>
      </main>

      <footer className="py-12 border-t border-slate-900 px-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-8 text-slate-500 text-sm">
          <div>© 2024 Acnerra. All rights reserved.</div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
