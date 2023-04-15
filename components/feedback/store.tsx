import React, { createContext, useState } from 'react';
import { useFingerPrint } from '../../hooks/useFingerPrint';

export type TypeRate = '' | 'bad' | 'meh' | 'nice';
import ReactGA4 from 'react-ga4';

const defaultState = {
  isModalShow: false,
  onModalShow: (state: boolean) => {},

  formUser: '',
  onChangeFormUser: (value: string) => {},
  formMessage: '',
  onChangeFormMessage: (value: string) => {},
  formRate: '' as TypeRate,
  onChangeFormRate: (value: TypeRate) => {},

  isSending: false,
  onSend: () => {},

  isHasUser: false,
  type: 'form',
  themeColor: '#1f5a68',
  textColor: 'white',
  showOnInitial: false,
};

const FeedbackContext = createContext(defaultState);

export function FeedbackProvider({
  children,
  user,
  metadata,
  type,
  apiPath,
  themeColor,
  textColor,
  showOnInitial,
}: {
  children: React.ReactElement;
  type: string;
  apiPath: string;
  user?: string;
  metadata?: object;
  themeColor: string;
  textColor: string;
  showOnInitial: boolean;
}) {
  const [isModalShow, setIsModalShow] = useState(showOnInitial);

  const [formUser, setFormUser] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formRate, setFormRate] = useState<TypeRate>('');
  const [isSending, setIsSending] = useState(false);
  const fp = useFingerPrint();

  const isHasUser = !!user;

  const onSend = async () => {
    try {
      setIsSending(true);

      await fetch(apiPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: user || formUser,
          message: formMessage,
          rate: formRate,
          visitorId: fp,
          metadata,
        }),
      });

      try {
        ReactGA4.event({
          category: 'Feedback',
          action: `${formRate}`,
        });
      } catch (e) {
        console.error(`ga error: ${e}`);
      }

      setFormUser('');
      setFormMessage('');
      setFormRate('');
      setIsModalShow(false);
    } catch (err) {
      alert(err);
    } finally {
      setIsSending(false);
    }
  };

  const onModalShow = (status: boolean) => {
    setIsModalShow(status);
  };

  const onChangeFormUser = (value: string) => {
    setFormUser(value);
  };

  const onChangeFormMessage = (value: string) => {
    setFormMessage(value);
  };

  const onChangeFormRate = (value: TypeRate) => {
    setFormRate(value);
  };

  return (
    <FeedbackContext.Provider
      value={{
        isModalShow,
        onModalShow,

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
        themeColor,
        textColor,
        showOnInitial,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  );
}

export default FeedbackContext;
