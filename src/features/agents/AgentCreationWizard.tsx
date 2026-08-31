import React, { useReducer, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_STATE = {
  name: '',
  description: '',
  department: '',
  provider: 'openai',
  temperature: 0.7,
  dailyLimit: 100,
  transactionLimit: 10,
};

const totalSteps = 4;
const stepLabels = ['Identity & Role', 'Engine Settings', 'Spend Constraints', 'Final Review'];

export default function AgentCreationWizard() {
  const [reducer], dispatch = useReducer((state, action) => {
    if (action.type === 'UPDATE_FIELD') {
      return { ...state, [action.field]: action.value };
    }
    return state;
  }, INITIAL_STATE);
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);

  const updateField = (field: keyof typeof InitialState, value: string | number) =>
    dispatch({ type: 'UPDATE_FIELD', field, value });

  const validateStep = (step: number): booean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!reducer.name.trim()) newErrors.name = 'Name is required.';
      if (!reducer.description.trim()) newErrors.description = 'Description is required.';
      if (!reducer.department.trim()) newErrors.department = 'Department is required.';
    } else if (step === 1) {
      if (!reducer.provider) newErrors.provider = 'Provider is required.';
      if (Number.isNaN(reducer.temperature) || reducer.temperature < 0 || reducer.temperature > 1) newErrors.temperature = 'Temperature must be between 0 and 1.';
    } else if (step === 2) {
      if (Number.isNaN(reducer.dailyLimit) || reducer.dailyLimit <= 0) newErrors.dailyLimit = 'Daily limit must be positive.';
      if (Number.isNaN(reducer.transactionLimit) || reducer.transactionLimit <= 0) newErrors.transactionLimit = 'Transaction limit must be positive.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps - 1) {
        setDirection(1);
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = () => {
    const payload = JSON.stringify(reducer, null, 2);
    alert(`Configuration payload:` + payload);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
    }),
  };

  return (
    <div className="agent-wizard">
      <div className="progress-bar">
        {stepLabels.map((label, index) => (
          <div
            key={label}
            className={`step-progress ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            onClick={() => index < currentStep && setCurrentStep(index)}
          >
            <span className="step-bubble">{index + 1}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="step-content">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={ duration: 0.3, ease: 'easeInOut' }
          >
            {currentStep === 0 && (
              <div className="step">
                <h2>Identity & Role</h2>
                <label>
                  Name:
                  <input type="text" value={reducer.name} onChange={(e) => updateField('name', e.target.value)} />
                  {errors.name && <span className="error">{errors.name}</span>}
                </label>
                <label>
                  Description:
                  <textarea value={reducer.description} onChange={(e) => updateField('description', e.target.value)} />
                  {errors.description && <span className="error">{errors.description}</span>}
                </label>
                <label>
                  Department:
                  <input type="text" value={reducer.department} onChange={(e) => updateField('department', e.target.value)} />
                  {errors.department && <span className="error">{errors.department}</span>}
                </label>
              </div>
            )}
            {currentStep === 1 && (
              <div className="step">
                <h2>Engine Settings</h2>
                <label>
                  Provider:
                  <select value={reducer.provider} onChange={(e) => updateField('provider', e.target.value)}>
                    <option value="nvidia">Nvidia</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama</option>
                  </select>
                  {errors.provider && <span className="error">{errors.provider}</span>}
                </label>
                <label>
                  Temperature:
                  <input type="number" min="0" max="1" step="0.1" value={Number.isNaN(reducer.temperature) ? '' : reducer.temperature} onChange={(e) => updateField('temperature', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.temperature && <span className="error">{errors.temperature}</span>}
                </label>
              </div>
            )}
            {currentStep === 2 && (
              <div className="step">
                <h2>Spend Constraints</h2>
                <label>
                  Daily Limit:
                  <input type="number" min="0" value={Number.isNaN(reducer.dailyLimit) ? '' : reducer.dailyLimit} onChange={(e) => updateField('dailyLimit', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.dailyLimit && <span className="error">{errors.dailyLimit}</span>}
                </label>
                <label>
                  Transaction Limit:
                  <input type="number" min="0" value={Number.isNaN(reducer.transactionLimit) ? '' : reducer.transactionLimit} onChange={(e) => updateField('transactionLimit', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.transactionLimit && <span className="error">{errors.transactionLimit}</span>}
                </label>
              </div>
            )}
            {currentStep === 3 && (
              <div className="step">
                <h2>Final Review</h2>
                <p><strong>Name:</strong> {reducer.name}</p>
                <p><strong>Description:</strong> {reducer.description}</p>
                <p><strong>Department:</strong> {reducer.department}</p>
                <p><strong>Provider:</strong> {reducer.provider}</p>
                <p><strong>Temperature:</strong> {Number.isNaN(reducer.temperature) ? '' : reducer.temperature}</p>
                <p><strong>Daily Limit:</strong> {Number.isNaN(reducer.dailyLimit) ? '' : reducer.dailyLimit}</p>
                <p><strong>Transaction Limit:</strong> {Number.isNaN(reducer.transactionLimit) ? '' : reducer.transactionLimit}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="navigation">
        {currentStep > 0 && (
          <button className="button button-secondary" onClick={handleBack}>
            Back
          </button>
        )}
        {currentStep < totalSteps - 1 ? (
          <button className="button button-primary" onClick={handleNext}>
            Next
          </button>
        ) : (
          <button className="button button-primary" onClick={handleConfirm}>
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
