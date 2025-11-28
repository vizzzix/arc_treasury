import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useRef, useState, useEffect } from "react";

export function Toaster() {
  const { toasts } = useToast();
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const userClosedRef = useRef<Set<string>>(new Set());

  // Initialize open states for all toasts
  useEffect(() => {
    const newStates: Record<string, boolean> = {};
    toasts.forEach((toast) => {
      if (!(toast.id in openStates)) {
        newStates[toast.id] = true;
      } else {
        newStates[toast.id] = openStates[toast.id];
      }
    });
    if (Object.keys(newStates).length > 0) {
      setOpenStates((prev) => ({ ...prev, ...newStates }));
    }
  }, [toasts]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, duration, onOpenChange, ...props }) {
        const isOpen = openStates[id] ?? true;
        
        return (
          <Toast 
            key={id} 
            {...props} 
            open={isOpen}
            duration={undefined}
            onOpenChange={(open) => {
              // Only allow closing if user explicitly closed it (via close button)
              if (!open && userClosedRef.current.has(id)) {
                // User closed it manually, allow it
                userClosedRef.current.delete(id);
                setOpenStates((prev) => ({ ...prev, [id]: false }));
                if (onOpenChange) {
                  onOpenChange(open);
                }
              } else if (!open) {
                // Automatic close attempt - prevent it by keeping it open
                setOpenStates((prev) => ({ ...prev, [id]: true }));
                // Don't call onOpenChange to prevent state update in parent
              }
            }}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose 
              onClick={() => {
                // Mark as user-closed before the onOpenChange fires
                userClosedRef.current.add(id);
              }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
