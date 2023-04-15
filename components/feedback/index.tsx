import React from 'react';
import FeedbackModal from './components/modal';
import TriggerButton from './components/trigger-button';
import { FeedbackProvider } from './store';

export type TypeForm = 'form' | 'rate' | 'full';

export interface IFeedbackWidget {
  user?: string;
  metadata?: object;
  type?: TypeForm;
  apiPath?: string;
  themeColor?: string;
  textColor?: string;
  title?: null | string | React.ReactElement;
  description?: null | string | React.ReactElement;
  showOnInitial?: boolean;
  customIcon?: React.ReactElement;
}

export default function FeedbackWidget({
  user,
  metadata,
  type = 'form',
  apiPath = 'api/feedback',
  themeColor = '#00e9a3',
  textColor = '#000',
  title,
  description,
  showOnInitial = false,
  customIcon,
}: IFeedbackWidget) {
  return (
    <FeedbackProvider
      user={user}
      metadata={metadata}
      type={type}
      apiPath={apiPath}
      themeColor={themeColor}
      textColor={textColor}
      showOnInitial={showOnInitial}
    >
      <div
        className="feedback-widget"
        style={{
          // @ts-ignore
          '--color-primary': themeColor,
          '--color-text': textColor,
        }}
      >
        <TriggerButton>{customIcon}</TriggerButton>
        <FeedbackModal title={title} description={description} />
      </div>
    </FeedbackProvider>
  );
}
