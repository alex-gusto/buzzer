import { useEffect, useState } from 'react';

function copyText(value: string) {
  if (!value) {
    return Promise.reject(new Error('Missing value'));
  }

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Copy failed'));
    }
  });
}

export type CopyButtonProps = {
  text: string;
  idleLabel: string;
  copiedLabel?: string;
  errorLabel?: string;
  className?: string;
};

export function CopyButton({
  text,
  idleLabel,
  copiedLabel = 'Copied',
  errorLabel = 'Copy failed',
  className,
}: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (status === 'idle') {
      return;
    }

    const timeout = window.setTimeout(() => setStatus('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleCopy = async () => {
    try {
      await copyText(text);
      setStatus('copied');
    } catch (error) {
      console.error('Failed to copy text', error);
      setStatus('error');
    }
  };

  const label = status === 'copied' ? copiedLabel : status === 'error' ? errorLabel : idleLabel;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className={`inline-flex items-center gap-2 rounded-full border border-slate-500/40 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-300/60 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()}
    >
      <span>{label}</span>
      <span aria-hidden className="text-base">⧉</span>
    </button>
  );
}
