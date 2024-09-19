import { ToastMessage } from '../util/types';

const share: ToastMessage = {
  message: (
    <span>
      If you enjoy using Historic Boarders please give feedback by clicking the
      hand 👋 icon or star ⭐️ it on{' '}
      <a
        className="toast-link"
        href="https://github.com/nrgapple/historic-country-borders-app"
      >
        GitHub
      </a>
      !
    </span>
  ),
  opts: { icon: '❤️', duration: 5000, position: 'bottom-center' },
};

export const toastMessages: ToastMessage[] = [
  {
    message: (
      <span>
        The map's border data is ingested from{' '}
        <a
          className="toast-link"
          href="https://github.com/aourednik/historical-basemaps"
        >
          historical-basemaps
        </a>
        . Please help them out and create an issue if you find any errors.
      </span>
    ),
    opts: { icon: '📀', duration: 3000, position: 'bottom-center' },
  },
  {
    message: `Tip: Copying links will share the current year and location on the map.`,
    opts: { icon: '🔗', duration: 4000, position: 'bottom-center' },
  },
  share,
];
