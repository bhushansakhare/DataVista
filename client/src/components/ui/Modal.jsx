import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className={`card w-full ${widths[size]} overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center justify-between">
              <div className="font-semibold">{title}</div>
              <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
            {footer && (
              <div className="px-5 py-4 border-t border-ink-200/60 dark:border-ink-800/60 flex justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
