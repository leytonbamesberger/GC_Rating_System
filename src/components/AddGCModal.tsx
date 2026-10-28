import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase, type GeneralContractor } from '../lib/supabase';
import ErrorMessage from './ErrorMessage';

type Props = {
  onClose: () => void;
  onSaved: (gc: GeneralContractor) => void;
  initialName?: string;
  // Edit mode — pass the full GC to edit
  editGC?: GeneralContractor;
};

export default function AddGCModal({ onClose, onSaved, initialName = '', editGC }: Props) {
  const isEdit = !!editGC;
  const [name, setName] = useState(editGC ? editGC.name : initialName);
  const [aliases, setAliases] = useState(editGC ? (editGC.aliases ?? '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    setError('');

    if (isEdit && editGC) {
      const updatePayload: Partial<GeneralContractor> = {
        name: trimmedName,
        aliases: aliases.trim() || null,
      };

      const { data, error: updateError } = await supabase
        .from('gc_contractors')
        .update(updatePayload)
        .eq('id', editGC.id)
        .select()
        .maybeSingle();

      setSaving(false);

      if (updateError) {
        setError(
          updateError.message.includes('unique')
            ? 'A GC with that name already exists.'
            : 'Failed to update GC. Please try again.'
        );
        return;
      }

      if (data) onSaved(data as GeneralContractor);
    } else {
      const { data, error: insertError } = await supabase
        .from('gc_contractors')
        .insert({
          name: trimmedName,
          aliases: aliases.trim() || null,
        })
        .select()
        .maybeSingle();

      setSaving(false);

      if (insertError) {
        setError(
          insertError.message.includes('unique')
            ? 'A GC with that name already exists.'
            : 'Failed to save GC. Please try again.'
        );
        return;
      }

      if (data) onSaved(data as GeneralContractor);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-legacy-blue-dark/50 flex items-center justify-center z-50 px-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-legacy-blue-light/20 rounded-xl w-full max-w-md p-6 shadow-xl text-legacy-blue-dark">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-legacy-blue-dark font-semibold text-lg">
            {isEdit ? 'Edit General Contractor' : 'Add General Contractor'}
          </h3>
          <button
            onClick={onClose}
            className="text-legacy-blue-light hover:text-legacy-blue-dark transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-legacy-blue-light text-xs uppercase tracking-wide font-medium mb-2">
              Official GC Name <span className="text-legacy-red">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full legal name"
              className="w-full bg-white border border-legacy-blue-light/30 focus:border-legacy-blue-dark rounded-lg px-4 py-3 text-legacy-blue-dark placeholder-legacy-blue-light/50 text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-legacy-blue-light text-xs uppercase tracking-wide font-medium mb-2">
              Aliases <span className="text-legacy-blue-light/60">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. ABC, ABC Const, A.B.C."
              className="w-full bg-white border border-legacy-blue-light/30 focus:border-legacy-blue-dark rounded-lg px-4 py-3 text-legacy-blue-dark placeholder-legacy-blue-light/50 text-sm focus:outline-none transition-colors"
            />
          </div>
        </div>

        {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-full bg-legacy-blue-dark hover:bg-legacy-blue-dark/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 text-sm transition"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save GC'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full px-5 py-3 border border-legacy-blue-light/30 text-legacy-blue-dark hover:bg-legacy-blue-light/5 text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
