import type { ReactNode } from 'react';

interface ChatMessageProps {
  role: 'assistant' | 'user';
  children: ReactNode;
}

export default function ChatMessage({ role, children }: ChatMessageProps) {
  return (
    <div className={`planning-message planning-message-${role}`}>
      {role === 'assistant' && <span className="planning-avatar" aria-hidden="true">DL</span>}
      <div className="planning-bubble">{children}</div>
    </div>
  );
}
