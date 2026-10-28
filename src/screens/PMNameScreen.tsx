import { useState } from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import { supabase, type ProjectManager } from '../lib/supabase';
import { accountEmail, accountOid } from '../lib/msal';
import ErrorMessage from '../components/ErrorMessage';

type Props = {
  account: AccountInfo;
  onCreated: (pm: ProjectManager) => void;
  onBack: () => void;
};

// Only reached when sign-in could not connect the person to an existing project manager row by
// email. They confirm the name their ratings will appear under, and a row is created for them.
export default function PMNameScreen({ account, onCreated, onBack }: Props) {
  const [name, setName] = useState(account.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    const { data, error } = await supabase
      .from('gc_project_managers')
      .insert({ name: trimmed, email: accountEmail(account), azure_oid: accountOid(account) })
      .select()
      .single();
    if (error) {
      console.error('[pm] could not create project manager:', error);
      setError(
        error.code === '23505'
          ? 'That name or email is already in use. Ask an administrator to link your account.'
          : 'Could not save your name.'
      );
      setSaving(false);
      return;
    }
    onCreated(data as ProjectManager);
    setSaving(false);
  }

  return (
    <div className="min-h-[calc(100vh-80px)] px-6 py-10">
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="text-white/40 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-white mb-1">Confirm Your Name</h2>
        <p className="text-white/40 text-sm mb-8">
          This is the name your ratings will be filed under. You only need to do this once.
        </p>

        {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Full name"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-md px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-500/60 mb-3"
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-md py-2.5 text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
