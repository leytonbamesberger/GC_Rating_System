// Takes its text color from the page it is on (white on the dark screens, dark blue on the light ones).
export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 border-2 border-slate-400/30 border-t-legacy-red rounded-full animate-spin" />
      <p className="text-sm opacity-60">{message}</p>
    </div>
  );
}
