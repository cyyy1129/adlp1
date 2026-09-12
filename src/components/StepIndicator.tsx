// ============================================================
// StepIndicator — Onboarding progress indicator
// ============================================================

interface Step {
  label: string;
  icon: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={index} className="step-item-wrapper">
            {/* Connector line before this step (not for first) */}
            {index > 0 && (
              <div className={`step-connector ${isCompleted ? 'step-connector-done' : ''}`} />
            )}
            <div
              className={`step-item ${isActive ? 'step-active' : ''} ${isCompleted ? 'step-completed' : ''}`}
            >
              <div className="step-circle">
                {isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="step-icon">{step.icon}</span>
                )}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
