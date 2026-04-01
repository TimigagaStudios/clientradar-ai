import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  message?: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-500/20 bg-green-500/10 text-green-200',
  error: 'border-red-500/20 bg-red-500/10 text-red-200',
  info: 'border-white/10 bg-white/10 text-white',
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();

    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-3 w-[min(360px,calc(100vw-2rem))]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className={`rounded-2xl border backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.25)] px-4 py-4 ${toastStyles[toast.type]}`}
            >
              <p className="font-semibold tracking-tight">{toast.title}</p>
              {toast.message && (
                <p className="text-sm mt-1 opacity-85 leading-6">{toast.message}</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }

  return context;
};
