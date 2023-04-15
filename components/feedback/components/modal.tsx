import FeedbackContext from '../store';
import React, { useContext } from 'react';
import FeedbackModalElementRate from './modal-element-rate';
import EmojiSad from './emoji-sad';
import EmojiNice from './emoji-nice';
import EmojiMeh from './emoji-meh';

export default function FeedbackModal({
  title,
  description,
}: {
  title?: null | string | React.ReactElement;
  description?: null | string | React.ReactElement;
}) {
  const {
    isModalShow,

    formUser,
    onChangeFormUser,
    formMessage,
    onChangeFormMessage,
    formRate,
    onChangeFormRate,

    isSending,
    onSend,

    isHasUser,
    type,
  } = useContext(FeedbackContext);

  if (!isModalShow) return null;

  return (
    <div className="feedback-widget-modal">
      {(title || description) && (
        <header className="feedback-widget-header">
          {title && <h3 className="feedback-widget-modal-title">{title}</h3>}
          {description && <p>{description}</p>}
        </header>
      )}

      <form
        className="feedback-widget-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        {!isHasUser && (
          <div>
            <input
              className="feedback-widget-form-control"
              type="email"
              name="email"
              placeholder="Email (optional)"
              value={formUser}
              onChange={(event: React.ChangeEvent) =>
                onChangeFormUser((event.target as HTMLInputElement).value)
              }
            />
          </div>
        )}

        {['full', 'form'].includes(type) && (
          <div>
            <textarea
              className="feedback-widget-form-control"
              name="message"
              placeholder="Message (optional)"
              rows={3}
              value={formMessage}
              onChange={(event: React.ChangeEvent) =>
                onChangeFormMessage((event.target as HTMLInputElement).value)
              }
            />
          </div>
        )}

        {['full', 'rate'].includes(type) && (
          <div>
            <div className="feedback-widget-form-rate">
              <FeedbackModalElementRate
                value="bad"
                selected={formRate}
                onChange={onChangeFormRate}
              >
                <EmojiSad color={formRate === 'bad' ? '#000' : '#999'} />
              </FeedbackModalElementRate>
              <FeedbackModalElementRate
                value="meh"
                selected={formRate}
                onChange={onChangeFormRate}
              >
                <EmojiMeh color={formRate === 'meh' ? '#000' : '#999'} />
              </FeedbackModalElementRate>
              <FeedbackModalElementRate
                value="nice"
                selected={formRate}
                onChange={onChangeFormRate}
              >
                <EmojiNice color={formRate === 'nice' ? '#000' : '#999'} />
              </FeedbackModalElementRate>
            </div>
          </div>
        )}

        <div>
          <button
            className="feedback-widget-form-control"
            type="submit"
            disabled={isSending || !formRate}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
