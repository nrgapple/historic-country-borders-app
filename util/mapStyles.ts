import { MapStyle } from './types';

export const oldLayout = {
  layout: {
    'text-field': '{title}',
    'text-font': ['Lato Bold'],
    'text-size': {
      base: 1,
      stops: [
        [4, 0],
        [6, 8],
        [9, 12],
      ],
    },
    'text-padding': 3,
    'text-letter-spacing': 0.1,
    'text-max-width': 7,
    'text-transform': 'uppercase',
    'text-offset': [0, 3],
    'icon-allow-overlap': true,
    'icon-image': 'old',
    'icon-size': {
      base: 1,
      stops: [
        [5, 0.03],
        [9, 0.1],
      ],
    },
  },
  image: {
    url: '/old.png',
    id: 'old',
  },
} as MapStyle;

export const inUseLayout = {
  layout: {
    'text-field': '{title}',
    'text-font': ['Lato Bold'],
    'text-size': {
      base: 1,
      stops: [
        [4, 0],
        [6, 8],
        [9, 12],
      ],
    },
    'text-allow-overlap': true,
    'text-padding': 3,
    'text-letter-spacing': 0.1,
    'text-max-width': 7,
    'text-transform': 'uppercase',
    'text-offset': [0, 3],
    'icon-allow-overlap': true,
    'icon-image': 'in-use',
    'icon-size': {
      base: 1,
      stops: [
        [5, 0.04],
        [9, 0.1],
      ],
    },
  },
  image: {
    url: '/in-use.png',
    id: 'in-use',
  },
} as MapStyle;

export const deadLayout = {
  layout: {
    'text-field': '{title}',
    'text-font': ['Lato Bold'],
    'text-size': {
      base: 1,
      stops: [
        [4, 0],
        [6, 8],
        [9, 12],
      ],
    },
    'text-padding': 3,
    'text-letter-spacing': 0.1,
    'text-max-width': 7,
    'text-transform': 'uppercase',
    'text-offset': [0, 3],
    'icon-allow-overlap': true,
    'icon-image': 'dead',
    'icon-size': {
      base: 1,
      stops: [
        [5, 0.05],
        [9, 0.2],
      ],
    },
  },
  image: {
    url: '/dead.png',
    id: 'dead',
  },
} as MapStyle;

export const currentLayout = {
  layout: {
    'text-field': '{title}',
    'text-font': ['Lato Bold'],
    'text-size': {
      base: 1,
      stops: [
        [4, 0],
        [6, 8],
        [9, 12],
      ],
    },
    'text-padding': 3,
    'text-letter-spacing': 0.1,
    'text-max-width': 7,
    'text-transform': 'uppercase',
    'text-offset': [0, 3],
    'icon-allow-overlap': true,
    'icon-image': 'current',
    'icon-size': {
      base: 1,
      stops: [
        [5, 0.02],
        [9, 0.1],
      ],
    },
  },
  image: {
    url: '/current.png',
    id: 'current',
  },
} as MapStyle;
