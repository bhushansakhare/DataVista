import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Sheet, BarChart3, Share2, ArrowRight } from 'lucide-react';

const STEPS = [
  { icon: Sheet, title: 'Paste your Google Sheet link', desc: 'Make sure your sheet is shared as "Anyone with link — Viewer".' },
  { icon: BarChart3, title: 'Pick X / Y / group', desc: 'Choose what to plot. We auto-detect numbers and dates.' },
  { icon: Share2, title: 'Save and share', desc: 'Save to a dashboard, share with a public link, embed anywhere.' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-mesh-light dark:bg-mesh-dark">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-2xl p-8"
      >
        <div className="text-xs font-bold uppercase tracking-wider text-brand-600">Welcome</div>
        <h1 className="text-3xl font-extrabold mt-1">You&apos;re in. Here&apos;s how SheetFlow works.</h1>
        <p className="text-sm text-ink-500 mt-2">Three steps to your first dashboard.</p>

        <div className="mt-8 space-y-3">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-4 rounded-xl border transition ${
                i === step ? 'border-brand-500 bg-brand-500/5' : 'border-ink-200 dark:border-ink-800'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                i < step ? 'bg-emerald-500/15 text-emerald-600' : 'bg-brand-500/10 text-brand-600'
              }`}>
                {i < step ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{i + 1}. {s.title}</div>
                <div className="text-sm text-ink-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={() => navigate('/app')} className="btn-ghost">Skip</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="btn-secondary">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => navigate('/app/sheets/import')} className="btn-primary">
              Import your first sheet <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
