import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';

/** Resolves to false when the Clipboard API is missing or refuses. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
      return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const COPIED_MS = 2500;

interface CopyLinkButtonProps {
  /** Defaults to the current address, which carries the year, view and place. */
  getUrl?: () => string;
}

/**
 * Copies a link to the current map. Where the clipboard is unavailable (older
 * browsers, insecure origins, locked-down school devices) it shows the link in
 * a selected read-only field so it can be copied by hand.
 */
export default function CopyLinkButton({
  getUrl = () => window.location.href,
}: CopyLinkButtonProps) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (state !== 'manual') return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [state, url]);

  const handleClick = async () => {
    const href = getUrl();
    clearTimeout(timer.current);
    if (await copyText(href)) {
      setState('copied');
      timer.current = setTimeout(() => setState('idle'), COPIED_MS);
    } else {
      setUrl(href);
      setState('manual');
    }
  };

  return (
    <div className="copy-link">
      <div className="copy-link__row">
        <button
          type="button"
          className="button button--primary"
          onClick={handleClick}
        >
          <Icon name={state === 'copied' ? 'check' : 'link'} size={16} />
          Copy link
        </button>
        <span className="copy-link__status" role="status">
          {state === 'copied' ? 'Link copied' : ''}
        </span>
      </div>
      {state === 'manual' && (
        <div className="copy-link__manual">
          <label htmlFor={`${id}-url`}>
            Copying is blocked here. Copy this link:
          </label>
          <input
            ref={inputRef}
            id={`${id}-url`}
            className="input"
            type="text"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
