import React, { FormEvent, useEffect, useId, useState } from 'react';
import Dialog from './Dialog';
import { useChrome } from '../contexts/ChromeContext';
import { useFingerPrint } from '../hooks/useFingerPrint';
import { trackEvent } from '../lib/analytics';

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

export default function FeedbackDialog() {
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

  useEffect(() => {
    if (open && status.kind === 'sent') setStatus({ kind: 'idle' });
    // Only reset the success message when the dialog is reopened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating || !visitorId) return;
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: email.trim(),
          message: message.trim(),
          rate: rating,
          visitorId,
          metadata: { page: window.location.pathname },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          typeof body?.message === 'string'
            ? body.message
            : `Feedback failed (HTTP ${response.status}).`,
        );
      }
      trackEvent('feedback_submit', {
        rating,
        has_message: Boolean(message.trim()),
      });
      setRating(null);
      setMessage('');
      setEmail('');
      setStatus({ kind: 'sent' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Feedback could not be sent.',
      });
    }
  };

  return (
    <Dialog open={open} onClose={closeOverlay} title="Send feedback">
      {status.kind === 'sent' ? (
        <div className="feedback__done" role="status">
          <p>Thanks — your feedback was sent.</p>
          <button type="button" className="button" onClick={closeOverlay}>
            Close
          </button>
        </div>
      ) : (
        <form className="feedback" onSubmit={handleSubmit}>
          <p className="dialog__lede">
            What’s working, what’s broken, what’s missing? Map border errors are
            best reported to the{' '}
            <a
              href="https://github.com/aourednik/historical-basemaps/issues"
              target="_blank"
              rel="noreferrer"
            >
              historical-basemaps project
            </a>
            , which publishes the data.
          </p>

          <fieldset className="field">
            <legend className="field__label" id={ratingGroupId}>
              How is it so far?
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
            <label className="field__label" htmlFor={messageId}>
              Message <span className="field__optional">optional</span>
            </label>
            <textarea
              id={messageId}
              className="input"
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

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
              disabled={!rating || !visitorId || status.kind === 'sending'}
            >
              {status.kind === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
