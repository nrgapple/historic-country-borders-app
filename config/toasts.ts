import { Toast } from 'react-hot-toast';

export interface ToastMessage {
  message: Element | string;
  opts?:
    | Partial<
        Pick<
          Toast,
          | 'id'
          | 'style'
          | 'className'
          | 'icon'
          | 'duration'
          | 'ariaProps'
          | 'position'
          | 'iconTheme'
        >
      >
    | undefined;
}
