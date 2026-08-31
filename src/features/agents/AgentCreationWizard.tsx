import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentWizardStore } from './store';
import { providerOptions } from './schema';

const totalSteps = 4;
const stepLabels = ['Identity & Role', 'Engine Settings', 'Spend Constraints', 'Final Review'];

export default function AgentCreationWizard() {
  const { currentStep, values, setCurrentStep, setValues, nextStep, prevStep } = useAgentWizardStore();
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof typeof values, value: string | number) => {
    setValues({ [field]: value } as Partial<typeof values>);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!values.name || values.name.trim().length < 2) newErrors.name = 'Agent name is required (min 2 characters).';
      if (!values.description || values.description.trim().length < 10) newErrors.description = 'Description must be at least 10 characters.';
      if (!values.ownerDepartment || values.ownerDepartment.trim().length < 2) newErrors.ownerDepartment = 'Department is required (min 2 characters).';
    } else if (step === 1) {
      if (!values.provider) newErrors.provider = 'Provider is required.';
      if (!values.model || values.model.trim().length < 2) newErrors.model = 'Model name is required (min 2 characters).';
      const temp = Number(values.temperature);
      if (Number.isNaN(temp) || temp < 0 || temp > 2) newErrors.temperature = 'Temperature must be between 0 and 2.';
    } else if (step === 2) {
      const budget = Number(values.budget);
      const cap = Number(values.singleTransactionCap);
      if (Number.isNaN(budget) || budget < 0) newErrors.budget = 'Daily limit must be zero or greater.';
      if (Number.isNaN(cap) || cap < 0) newErrors.singleTransactionCap = 'Single-transaction cap must be zero or greater.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps - 1) {
        setDirection(1);
        nextStep();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      prevStep();
    }
  };

  const handleConfirm = () => {
    const payload = JSON.stringify(values, null, 2);
    alert(`Configuration payload:\n${payload}`);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
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
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {currentStep === 0 && (
              <div className="step">
                <h2>Identity & Role</h2>
                <label>
                  Name:
                  <input type="text" value={values.name} onChange={(e) => updateField('name', e.target.value)} />
                  {errors.name && <span className="error">{errors.name}</span>}
                </label>
                <label>
                  Description:
                  <textarea value={values.description} onChange={(e) => updateField('description', e.target.value)} />
                  {errors.description && <span className="error">{errors.description}</span>}
                </label>
                <label>
                  Department:
                  <input type="text" value={values.ownerDepartment} onChange={(e) => updateField('ownerDepartment', e.target.value)} />
                  {errors.ownerDepartment && <span className="error">{errors.ownerDepartment}</span>}
                </label>
              </div>
            )}
            {currentStep === 1 && (
              <div className="step">
                <h2>Engine Settings</h2>
                <label>
                  Provider:
                  <select value={values.provider} onChange={(e) => updateField('provider', e.target.value)}>
                    {providerOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {errors.provider && <span className="error">{errors.provider}</span>}
                </label>
                <label>
                  Model:
                  <input type="text" value={values.model} onChange={(e) => updateField('model', e.target.value)} />
                  {errors.model && <span className="error">{errors.model}</span>}
                </label>
                <label>
                  Temperature:
                  <input type="number" min="0" max="2" step="0.1" value={Number.isNaN(Number(values.temperature)) ? '' : Number(values.temperature)} onChange={(e) => updateField('temperature', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.temperature && <span className="error">{errors.temperature}</span>}
                </label>
                <label>
                  API Key (optional):
                  <input type="password" value={values.apiKey} onChange={(e) => updateField('apiKey', e.target.value)} />
                </label>
              </div>
            )}
            {currentStep === 2 && (
              <div className="step">
                <h2>Spend Constraints</h2>
                <label>
                  Daily Limit (budget):
                  <input type="number" min="0" value={Number.isNaN(Number(values.budget)) ? '' : Number(values.budget)} onChange={(e) => updateField('budget', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.budget && <span className="error">{errors.budget}</span>}
                </label>
                <label>
                  Single Transaction Cap:
                  <input type="number" min="0" value={Number.isNaN(Number(values.singleTransactionCap)) ? '' : Number(values.singleTransactionCap)} onChange={(e) => updateField('singleTransactionCap', e.target.value === '' ? NaN : parseFloat(e.target.value))} />
                  {errors.singleTransactionCap && <span className="error">{errors.singleTransactionCap}</span>}
                </label>
              </div>
            )}
            {currentStep === 3 && (
              <div className="step">
                <h2>Final Review</h2>
                <p><strong>Name:</strong> {values.name}</p>
                <p><strong>Description:</strong> {values.description}</p>
                <p><strong>Department:</strong> {values.ownerDepartment}</p>
                <p><strong>Provider:</strong> {values.provider}</p>
                <p><strong>Model:</strong> {values.model}</p>
                <p><strong>Temperature:</strong> {Number.isNaN(Number(values.temperature)) ? '' : values.temperature}</p>
                <p><strong>Daily Limit:</strong> {Number.isNaN(Number(values.budget)) ? '' : values.budget}</p>
                <p><strong>Single Transaction Cap:</strong> {Number.isNaN(Number(values.singleTransactionCap)) ? '' : values.singleTransactionCap}</p>
                {values.apiKey && <p><strong>API Key:</strong> •••••••••••••</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="navigation">
        {currentStep > 0 && (
          <button className="button button-secondary" onClick={handleBack}>Back</button>
        )}
        {currentStep < totalSteps - 1 ? (
          <button className="button button-primary" onClick={handleNext}>Next</button>
        ) : (
          <button className="button button-primary" onClick={handleConfirm}>Confirm</button>
        )}
      </div>
    </div>
  );
}
