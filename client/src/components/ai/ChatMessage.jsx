import { motion } from 'framer-motion';
import { Sparkles, User as UserIcon, Loader2, AlertTriangle } from 'lucide-react';

/**
 * One message in the AI assistant chat. Three roles:
 *   - user      → right-aligned, neutral bubble
 *   - assistant → left-aligned, branded bubble; can also render a structured
 *                 attachment (suggestions list, dashboard summary, error)
 *   - thinking  → assistant bubble with a spinner + animated text
 */
export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 justify-end"
      >
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 bg-brand-500 text-white">
          {message.attachment === 'sheet' && (
            <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80 mb-1">
              {message.attachmentLabel}
            </div>
          )}
          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-ink-200 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-4 h-4 text-ink-600 dark:text-ink-300" />
        </div>
      </motion.div>
    );
  }

  if (message.role === 'thinking') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3"
      >
        <AssistantAvatar />
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-ink-100 dark:bg-ink-800/60 text-ink-700 dark:text-ink-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          <span className="text-sm">{message.content || 'Thinking…'}</span>
        </div>
      </motion.div>
    );
  }

  if (message.role === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3"
      >
        <AssistantAvatar variant="error" />
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" /> {message.title || 'Something went wrong'}
          </div>
          <div className="text-sm mt-1 opacity-90">{message.content}</div>
        </div>
      </motion.div>
    );
  }

  // assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <AssistantAvatar />
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-ink-900 border border-ink-200/60 dark:border-ink-800/60 text-ink-800 dark:text-ink-100 max-w-[80%]">
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
        {message.children}
      </div>
    </motion.div>
  );
}

function AssistantAvatar({ variant = 'default' }) {
  const cls = variant === 'error'
    ? 'bg-rose-500/15 text-rose-600'
    : 'bg-gradient-to-br from-brand-500 to-purple-500 text-white';
  return (
    <div className={`w-8 h-8 rounded-full ${cls} flex items-center justify-center flex-shrink-0`}>
      <Sparkles className="w-4 h-4" />
    </div>
  );
}
