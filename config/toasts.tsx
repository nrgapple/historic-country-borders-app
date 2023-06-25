import { ToastMessage } from '../util/types';

const share: ToastMessage = {
  message: (
    <span>
      If you enjoy using Historic Boarders please share it with your friends!
    </span>
  ),
  opts: { icon: '❤️', duration: 2000, position: 'bottom-right' },
};

export const toastMessages: ToastMessage[] = [
  // empty for now
  // {
  //   message: 'Come join the discord in the bottom right corner!',
  //   opts: { icon: '💬', duration: 3000, position: 'bottom-center' },
  // },
];
