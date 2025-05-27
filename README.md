# [Historic Borders](https://historicborders.app/)

Visualize country borders from different times in history (2000 BC-1994)

As seen on [r/dataisbeautiful](https://www.reddit.com/r/dataisbeautiful/comments/l52krh/an_app_i_made_for_visualizing_country_borders/).

## Screenshot

<img width="1023" alt="screen-shot-of-app" src="https://user-images.githubusercontent.com/10817537/175097196-e746778d-241a-4bee-b406-aac294849597.png">

## Development

### Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

### Testing

This project uses [Vitest](https://vitest.dev/) for testing with React Testing Library.

```bash
# Run tests in watch mode
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

For more details about testing, see [test/README.md](test/README.md).

## Data

The data is pulled from [aourednik's](https://github.com/aourednik/historical-basemaps) historical basemaps repo.

## Keep in Mind

1. historical boundaries are even more disputed than contemporary ones, that
2. the actual concept of territory and national boundary becomes meaningful, in Europe, only since the [Peace of Westphalia](https://en.wikipedia.org/wiki/Peace_of_Westphalia) (1648), that
3. areas of civilizations actually overlap, especially in ancient history, and that
4. overlaying these ancient vector maps on contemporary physical maps can be misleading; rivers, lakes, shorelines _do_ change very much over millenia; think for instance about the evolution of the [Aral sea](https://en.wikipedia.org/wiki/Aral_Sea) since the 1980s.

Finally, note that overlapping areas are useally dealt with as topological errors in traditional GIS. Fuzzy borders are difficult to handle. Certainly a field to investigate...
