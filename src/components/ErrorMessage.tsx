import { AlertCircle } from 'lucide-react';

export default function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 bg-legacy-red/10 border border-legacy-red/30 rounded-lg px-4 py-3 text-legacy-red text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
