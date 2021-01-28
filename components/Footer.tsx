interface FooterProps {
  dataUrl?: string;
}

const Footer = (
  url = 'https://github.com/nrgapple/historicborders-timeline-example',
) => (
  <div className="footer">
    <div>
      🗺 This map uses data from <a href={url}>here</a> to show country borders
      over history. Create your own data{' '}
      <a href="https://github.com/nrgapple/historicborders-timeline-example">
        here
      </a>{' '}
    </div>
    <div>
      <a href="https://github.com/nrgapple/historic-country-borders-app">
        ⭐️ Star this on Github!
      </a>
    </div>
  </div>
);

export default Footer;
