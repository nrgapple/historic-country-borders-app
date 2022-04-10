interface FooterProps {
  dataUrl?: string;
  lastCommit?: Date;
}

const Footer = ({
  dataUrl = 'https://github.com/nrgapple/historicborders-timeline-example',
  lastCommit,
}: FooterProps) => (
  <div className="footer">
    <div>
      <div className="logo">🌎 HistoricBorders.app</div>
      {!!lastCommit && (
        <div className="last-commit">
          <span>
            Last Updated:{' '}
            {lastCommit.toLocaleDateString('en-us', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      )}
    </div>
    <div className="footer-right">
      <div>
        Data from <a href={dataUrl}>here</a>.
        {/* Create your own data{' '}
      <a href="https://github.com/nrgapple/historicborders-timeline-example">
        here
      </a>{' '} */}
      </div>
      <div>
        <a href="https://github.com/nrgapple/historic-country-borders-app">
          ⭐️ Star this on Github!
        </a>
      </div>
    </div>
  </div>
);

export default Footer;
