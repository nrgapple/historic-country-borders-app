import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import Dialog from './Dialog';
import { useChrome } from '../atlas/hooks';
import { useFingerPrint } from '../hooks/useFingerPrint';
import { track } from '../lib/analytics';

type Rating = 'bad' | 'meh' | 'nice';

const RATINGS: Array<{ value: Rating; label: string }> = [
  { value: 'bad', label: 'Not great' },
  { value: 'meh', label: 'Okay' },
  { value: 'nice', label: 'Good' },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

/** Where to send corrections to the historical border data. */
export const HISTORICAL_CORRECTIONS = (
  <>
    To correct a historical border, open an issue with the{' '}
    <a
      href="https://github.com/aourednik/historical-basemaps/issues"
      target="_blank"
      rel="noreferrer"
    >
      historical-basemaps project
    </a>
    , which publishes the border data.
  </>
);

interface FeedbackDialogProps {
  /** Page-specific advice on where to report data errors. */
  corrections?: ReactNode;
}

export default function FeedbackDialog({
  corrections = HISTORICAL_CORRECTIONS,
}: FeedbackDialogProps) {
  const { overlay, closeOverlay } = useChrome();
  const open = overlay === 'feedback';
  // Fingerprinting is an abuse control for this optional form only; its code
  // loads after a visitor opens the dialog.
  const visitorId = useFingerPrint(open);
  const [rating, setRating] = useState<Rating | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const ratingGroupId = useId();
  const messageId = useId();
  const emailId = useId();
  const hintId = useId();
  const hasMessage = message.trim().length > 0;

  useEffect(() => {
    if (open && status.kind === 'sent') setStatus({ kind: 'idle' });
    // Only reset the success message when the dialog is reopened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if ((!rating && !hasMessage) || !visitorId) return;
    setStatus({ kind: 'sending' });
    const sent = {
      rating: rating ?? 'none',
      has_message: hasMessage,
      has_email: email.trim() !== '',
    };
    let response: Response;
    try {
      response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: email.trim(),
          message: message.trim(),
          rate: rating ?? '',
          visitorId,
          metadata: { page: window.location.pathname },
        }),
      });
    } catch {
      track('feedback_submit', {
        ...sent,
        outcome: 'failed',
        reason: 'network',
      });
      setStatus({ kind: 'error', message: 'Feedback could not be sent.' });
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      track('feedback_submit', {
        ...sent,
        outcome: 'failed',
        reason:
          response.status === 429
            ? 'rate_limited'
            : response.status >= 500
              ? 'server'
              : 'rejected',
      });
      setStatus({
        kind: 'error',
        message:
          typeof body?.message === 'string'
            ? body.message
            : `Feedback failed (HTTP ${response.status}).`,
      });
      return;
    }
    track('feedback_submit', { ...sent, outcome: 'sent' });
    setRating(null);
    setMessage('');
    setEmail('');
    setStatus({ kind: 'sent' });
  };

  return (
    <Dialog open={open} onClose={closeOverlay} title="Send feedback">
      {status.kind === 'sent' ? (
        <div className="feedback__done" role="status">
          <p>Thanks. Your feedback was sent.</p>
          <button type="button" className="button" onClick={closeOverlay}>
            Close
          </button>
        </div>
      ) : (
        <form className="feedback" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor={messageId}>
              What did you notice on this map?
            </label>
            <textarea
              id={messageId}
              className="input"
              rows={4}
              maxLength={2000}
              aria-describedby={hintId}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p className="field__hint" id={hintId}>
              {corrections}
            </p>
          </div>

          <fieldset className="field">
            <legend className="field__label" id={ratingGroupId}>
              How well does the map work for you?{' '}
              <span className="field__optional">optional</span>
            </legend>
            <div
              className="segmented"
              role="radiogroup"
              aria-labelledby={ratingGroupId}
            >
              {RATINGS.map((option) => (
                <label key={option.value} className="segmented__option">
                  <input
                    type="radio"
                    name="rating"
                    value={option.value}
                    checked={rating === option.value}
                    onChange={() => setRating(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field__label" htmlFor={emailId}>
              Email{' '}
              <span className="field__optional">optional, for a reply</span>
            </label>
            <input
              id={emailId}
              className="input"
              type="email"
              maxLength={320}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {status.kind === 'error' && (
            <p className="form-error" role="alert">
              {status.message}
            </p>
          )}

          <div className="dialog__actions">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                (!rating && !hasMessage) ||
                !visitorId ||
                status.kind === 'sending'
              }
            >
              {status.kind === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
