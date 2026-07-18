import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Ações do rodapé (botões). */
  actions?: ReactNode;
  large?: boolean;
}

/**
 * Modal acessível: fecha com Esc, clique no backdrop, dá foco ao primeiro campo
 * e devolve o foco ao fechar (corrige a fragilidade #F da avaliação de UX).
 */
export function Modal({ title, subtitle, onClose, children, actions, large }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // autofocus no primeiro campo de formulário (não no botão de fechar)
    const first = boxRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea",
    );
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        className={`modal ${large ? "modal-lg" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
