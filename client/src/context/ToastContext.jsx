import { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts) => {
    const id = Math.random().toString(36).slice(2);
    const t = typeof opts === 'string' ? { message: opts, kind: 'info' } : opts;
    setToasts((arr) => [...arr, { id, kind: 'info', duration: 3500, ...t }]);
    setTimeout(() => dismiss(id), (t.duration || 3500));
  }, [dismiss]);

  const helpers = {
    toast,
    success: (m) => toast({ message: m, kind: 'success' }),
    error: (m) => toast({ message: m, kind: 'error', duration: 5000 }),
    info: (m) => toast({ message: m, kind: 'info' }),
  };

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-soft min-w-[260px] max-w-[360px] glass`}
            >
              {t.kind === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />}
              {t.kind === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />}
              {t.kind === 'info' && <Info className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />}
              <div className="text-sm flex-1">{t.message}</div>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-600">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
