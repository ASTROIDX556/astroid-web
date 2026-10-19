import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import '../../../styles/tokens.css';

const simulationSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Must be a valid positive number'),
  recipientAddress: z.string().min(56, 'Valid Stellar address required (min 56 chars)').max(56, 'Valid Stellar address required'),
  assetType: z.string().min(1, 'Asset type is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
});

type SimulationFormValues = z.infer<typeof simulationSchema>;

interface PolicySimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyId?: string;
}

interface LogEntry {
  ruleName: string;
  status: 'PASS' | 'BLOCK';
  message: string;
}

export const PolicySimulationModal: React.FC<PolicySimulationModalProps> = ({
  isOpen,
  onClose,
  policyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationSchema),
    defaultValues: {
      amount: '',
      recipientAddress: '',
      assetType: 'XLM',
      agentId: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: SimulationFormValues) => {
    setLoading(true);
    setError(null);
    setLogs(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const numAmount = Number(data.amount);
      const simulatedLogs: LogEntry[] = [];

      simulatedLogs.push({
        ruleName: 'Agent Authorization Check',
        status: data.agentId.startsWith('G') ? 'PASS' : 'BLOCK',
        message: data.agentId.startsWith('G')
          ? `Agent ${data.agentId} is authorized.`
          : `Agent ${data.agentId} is not recognized or suspended.`,
      });

      simulatedLogs.push({
        ruleName: 'Asset Whitelist Check',
        status: ['XLM', 'USDC', 'EURT'].includes(data.assetType) ? 'PASS' : 'BLOCK',
        message: ['XLM', 'USDC', 'EURT'].includes(data.assetType)
          ? `Asset ${data.assetType} is whitelisted.`
          : `Asset ${data.assetType} is not permitted by policy.`,
      });

      simulatedLogs.push({
        ruleName: 'Single Transaction Limit',
        status: numAmount <= 1000 ? 'PASS' : 'BLOCK',
        message: numAmount <= 1000
          ? `Amount ${numAmount} is within the single transaction limit of 1000.`
          : `Amount ${numAmount} exceeds the maximum allowed limit of 1000.`,
      });

      setLogs(simulatedLogs);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during simulation.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setLogs(null);
    setError(null);
    onClose();
  };

  return (
    <div className="policy-simulation-modal-overlay" style={overlayStyle}>
      <div className="policy-simulation-modal-content" style={modalStyle}>
        <div style={headerStyle}>
          <h2>Simulate Spending Rule {policyId ? `#${policyId}` : ''}</h2>
          <button onClick={handleClose} style={closeButtonStyle}>&times;</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={formStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Agent ID</label>
            <input {...register('agentId')} placeholder="e.g. GAGENT..." style={inputStyle} />
            {errors.agentId && <span style={errorStyle}>{errors.agentId.message}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Recipient Address</label>
            <input {...register('recipientAddress')} placeholder="Stellar Public Key (56 chars)" style={inputStyle} />
            {errors.recipientAddress && <span style={errorStyle}>{errors.recipientAddress.message}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Amount</label>
            <input {...register('amount')} placeholder="0.00" style={inputStyle} />
            {errors.amount && <span style={errorStyle}>{errors.amount.message}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Asset Type</label>
            <select {...register('assetType')} style={inputStyle}>
              <option value="XLM">XLM</option>
              <option value="USDC">USDC</option>
              <option value="EURT">EURT</option>
              <option value="OTHER">OTHER</option>
            </select>
            {errors.assetType && <span style={errorStyle}>{errors.assetType.message}</span>}
          </div>

          <div style={buttonGroupStyle}>
            <button type="button" onClick={handleClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={primaryButtonStyle}>
              {loading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
        </form>

        {error && (
          <div style={errorBannerStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {logs && (
          <div style={resultsStyle}>
            <h3>Simulation Results</h3>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  ...logItemStyle,
                  borderColor: log.status === 'PASS' ? '#22c55e' : '#ef4444',
                  backgroundColor: log.status === 'PASS' ? '#f0fdf4' : '#fef2f2',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>{log.ruleName}</strong>
                  <span
                    style={{
                      fontWeight: 'bold',
                      color: log.status === 'PASS' ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {log.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '24px',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '500px',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  color: '#6b7280',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  fontSize: '0.95rem',
};

const errorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  marginTop: '16px',
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '4px',
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  padding: '8px 16px',
  borderRadius: '4px',
  fontWeight: 500,
  cursor: 'pointer',
};

const errorBannerStyle: React.CSSProperties = {
  marginTop: '16px',
  padding: '12px',
  backgroundColor: '#fef2f2',
  border: '1px solid #f87171',
  borderRadius: '4px',
  color: '#b91c1c',
  fontSize: '0.9rem',
};

const resultsStyle: React.CSSProperties = {
  marginTop: '20px',
  borderTop: '1px solid #e5e7eb',
  paddingTop: '16px',
};

const logItemStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '4px',
  borderLeft: '4px solid',
  marginBottom: '8px',
  fontSize: '0.9rem',
};
