import { useState, useEffect } from 'react';
import { Settings, X, Save } from 'lucide-react';
import { type BidThresholds, fetchThresholds, saveThresholds } from '../lib/bidThresholds';

type Props = {
  onClose: () => void;
  onSaved: (t: BidThresholds) => void;
};

function fmtInput(n: number): string {
  if (n <= 1) return '';
  return String(n);
}

function parseDollar(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? 0 : n;
}

function DollarInput({
  label,
  score,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  score: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0
          ${score >= 4 ? 'bg-emerald-600/15 text-emerald-700' :
            score === 3 ? 'bg-amber-500/15 text-amber-700' :
            'bg-legacy-red/10 text-legacy-red'}`}
        >
          {score}
        </div>
        <span className="text-legacy-blue-dark text-sm">{label}</span>
      </div>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-legacy-blue-light text-sm pointer-events-none">$</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white border border-legacy-blue-light/30 rounded-lg pl-6 pr-3 py-2 text-legacy-blue-dark text-sm focus:outline-none focus:border-legacy-blue-dark transition-colors placeholder-legacy-blue-light/50"
        />
      </div>
    </div>
  );
}

export default function ThresholdsModal({ onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier2, setTier2] = useState('');
  const [tier3, setTier3] = useState('');
  const [tier4, setTier4] = useState('');
  const [tier5, setTier5] = useState('');

  useEffect(() => {
    fetchThresholds().then((t) => {
      setTier2(fmtInput(t.tier_2_min));
      setTier3(fmtInput(t.tier_3_min));
      setTier4(fmtInput(t.tier_4_min));
      setTier5(fmtInput(t.tier_5_min));
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const t: BidThresholds = {
      tier_2_min: parseDollar(tier2) || 1,
      tier_3_min: parseDollar(tier3),
      tier_4_min: parseDollar(tier4),
      tier_5_min: parseDollar(tier5),
    };
    setSaving(true);
    await saveThresholds(t);
    setSaving(false);
    onSaved(t);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-legacy-blue-dark/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-legacy-blue-light/20 rounded-xl shadow-xl w-full max-w-md text-legacy-blue-dark">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-legacy-blue-light/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-legacy-blue-light/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-legacy-blue-dark" />
            </div>
            <div>
              <h3 className="text-legacy-blue-dark font-semibold text-base">Total Bids Thresholds</h3>
              <p className="text-legacy-blue-light text-xs mt-0.5">Minimum dollar amount to earn each score</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-legacy-blue-light hover:text-legacy-blue-dark transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-legacy-blue-dark border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 bg-legacy-blue-light/5 rounded-lg px-4 py-3">
                <p className="text-legacy-blue-light text-xs leading-relaxed">
                  Score <span className="text-legacy-red font-medium">1</span> is assigned when Total Bids Submitted is $0. Set the minimum dollar thresholds for scores 2–5 below.
                </p>
              </div>
              <DollarInput label="Score 2" score={2} value={tier2} onChange={setTier2} placeholder="e.g. 1" />
              <DollarInput label="Score 3" score={3} value={tier3} onChange={setTier3} placeholder="e.g. 1,000,000" />
              <DollarInput label="Score 4" score={4} value={tier4} onChange={setTier4} placeholder="e.g. 5,000,000" />
              <DollarInput label="Score 5" score={5} value={tier5} onChange={setTier5} placeholder="e.g. 10,000,000" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-legacy-blue-light/15 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-legacy-blue-dark hover:bg-legacy-blue-light/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="flex items-center gap-2 rounded-full px-5 py-2 bg-legacy-blue-dark hover:bg-legacy-blue-dark/90 disabled:opacity-50 text-white text-sm font-medium transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
