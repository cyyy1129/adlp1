import type { ReactNode } from 'react';
import Button from '../Button';

interface ConfirmationCardProps {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onEdit: () => void;
  confirmLabel?: string;
  disabled?: boolean;
}

export default function ConfirmationCard({
  title,
  children,
  onConfirm,
  onEdit,
  confirmLabel = '✓ Confirm',
  disabled = false,
}: ConfirmationCardProps) {
  return (
    <section className="planning-confirmation" aria-label={title}>
      <p className="planning-confirmation-label">{title}</p>
      <div className="planning-confirmation-value">{children}</div>
      <div className="planning-confirmation-actions">
        <Button onClick={onConfirm} disabled={disabled} size="md">{confirmLabel}</Button>
        <Button variant="secondary" onClick={onEdit} disabled={disabled} size="md">✕ Edit / try again</Button>
      </div>
    </section>
  );
}
