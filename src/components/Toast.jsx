import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({
  showToast: () => {},
  addToast: () => {}
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msgOrObj, typeArg = 'success') => {
    const id = Date.now() + Math.random();
    let text = '';
    let title = '';
    let type = typeArg;

    if (typeof msgOrObj === 'object' && msgOrObj !== null) {
      text = msgOrObj.message || msgOrObj.text || '';
      title = msgOrObj.title || '';
      type = msgOrObj.type || typeArg;
    } else {
      text = String(msgOrObj || '');
    }

    setToasts((prev) => [...prev, { id, title, message: text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, addToast: showToast }}>
      {children}
      <div className="toast-container fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} pointer-events-auto px-4 py-3 rounded-xl border flex items-start gap-2.5 shadow-xl text-xs backdrop-blur-md transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-cyan-950/90 border-cyan-500/40 text-cyan-200'
            }`}
          >
            <span className="text-sm shrink-0">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="flex flex-col">
              {toast.title && <span className="font-bold text-[11px] mb-0.5">{toast.title}</span>}
              <span className="leading-snug">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
