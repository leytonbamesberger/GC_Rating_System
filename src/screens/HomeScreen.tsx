import { ClipboardList, BarChart2 } from 'lucide-react';

type Props = {
  name: string;
  confirmationMessage: string;
  onAddReport: () => void;
  onViewDashboard: () => void;
};

export default function HomeScreen({ name, confirmationMessage, onAddReport, onViewDashboard }: Props) {
  return (
    <div className="min-h-[calc(100vh-64px)] px-6 py-10">
      <div className="max-w-md mx-auto">
        {confirmationMessage && (
          <div className="mb-6 bg-emerald-600/10 border border-emerald-600/30 rounded-lg px-4 py-3 text-emerald-700 text-sm">
            {confirmationMessage}
          </div>
        )}

        <div className="mb-10">
          <p className="text-legacy-blue-light text-xs uppercase tracking-widest font-medium mb-1">Logged in as</p>
          <h2 className="text-3xl font-bold text-legacy-blue-dark">{name}</h2>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onAddReport}
            className="group flex items-center gap-5 bg-white hover:bg-legacy-blue-light/5 border border-legacy-blue-light/25 hover:border-legacy-blue-dark rounded-xl px-6 py-6 transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-legacy-blue-light/10 flex items-center justify-center flex-shrink-0 group-hover:bg-legacy-blue-light/5 transition-colors">
              <ClipboardList className="w-6 h-6 text-legacy-blue-dark" />
            </div>
            <div>
              <p className="text-legacy-blue-dark font-semibold text-lg leading-tight">Add a GC Report</p>
              <p className="text-legacy-blue-light text-sm mt-0.5">Rate a general contractor</p>
            </div>
            <div className="ml-auto text-legacy-blue-light/50 group-hover:text-legacy-blue-light transition-colors text-xl">›</div>
          </button>

          <button
            onClick={onViewDashboard}
            className="group flex items-center gap-5 bg-white hover:bg-legacy-blue-light/5 border border-legacy-blue-light/25 hover:border-legacy-blue-dark rounded-xl px-6 py-6 transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-legacy-blue-light/10 flex items-center justify-center flex-shrink-0 group-hover:bg-legacy-blue-light/5 transition-colors">
              <BarChart2 className="w-6 h-6 text-legacy-blue-dark" />
            </div>
            <div>
              <p className="text-legacy-blue-dark font-semibold text-lg leading-tight">View GC Reports</p>
              <p className="text-legacy-blue-light text-sm mt-0.5">Browse the GC performance dashboard</p>
            </div>
            <div className="ml-auto text-legacy-blue-light/50 group-hover:text-legacy-blue-light transition-colors text-xl">›</div>
          </button>
        </div>
      </div>
    </div>
  );
}
