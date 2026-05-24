import { STATUS_COLOR, STATUS_LABEL, type Status } from '@/lib/status';

export function StatusPill({
  status,
  size = 'sm',
  count,
}: {
  status: Status;
  size?: 'sm' | 'md';
  count?: number;
}) {
  const c = STATUS_COLOR[status];
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset ${c.bg} ${c.text} ${c.ring} ${pad} font-medium`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${c.dot} ${status !== 'ok' ? 'animate-pulse' : ''}`}
      />
      {STATUS_LABEL[status]}
      {count !== undefined && count > 0 ? ` · ${count}` : ''}
    </span>
  );
}

export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${c.dot} ${status !== 'ok' ? 'animate-pulse' : ''} ${className}`}
    />
  );
}
