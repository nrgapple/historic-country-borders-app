import React, { useContext } from 'react';
import FeedbackContext from '../store';
import IconDefault from './icon-default';
import IconClose from './icon-close';
import ReactGA4 from 'react-ga4';
import ReactTooltip from 'react-tooltip';
import { isMobile } from '../../../util/constants';
import { useMounted } from '../../../hooks/useMounted';

export default function TriggerButton({
  children,
}: {
  children?: React.ReactElement;
}) {
  const { isModalShow, onModalShow, textColor } = useContext(FeedbackContext);

  const mounted = useMounted();

  return (
    <>
      {mounted && (
        <ReactTooltip
          resizeHide={false}
          id="feedbackTip"
          place="left"
          effect="solid"
          globalEventOff={isMobile ? 'click' : undefined}
        >
          Feedback!
        </ReactTooltip>
      )}
      <button
        data-tip
        data-for="feedbackTip"
        data-delay-show="300"
        data-delay-hide="300"
        type="button"
        aria-label="Feedback"
        className="feedback-widget-trigger-button"
        onClick={() => {
          onModalShow(!isModalShow);
          try {
            ReactGA4.event({
              category: 'Feedback',
              action: `${
                !isModalShow ? `clicked feedback` : 'closed feedback'
              }`,
              label: 'feedback',
            });
          } catch (e) {
            console.error(`ga error: ${e}`);
          }
        }}
      >
        {isModalShow ? (
          <>
            <IconClose color={textColor} size={30} />
          </>
        ) : (
          <>{children ? children : <IconDefault color={textColor} />}</>
        )}
      </button>
    </>
  );
}
