import Image from 'next/image';

interface FooterProps {
  dataUrl?: string;
  lastCommit?: Date;
  discordInvite?: string;
}

export default function Footer({
  dataUrl = 'https://github.com/nrgapple/historicborders-timeline-example',
  lastCommit,
  discordInvite,
}: FooterProps) {
  return (
    <div className="footer">
      <div>
        <div className="logo">🌎 HistoricBorders.app</div>
        {!!lastCommit && (
          <div className="last-commit">
            <span>
              Maps Updated:{' '}
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
        <div>
          <a href={discordInvite} className="discord-link">
            <Image
              src={'/discord-mark-blue.svg'}
              alt={'discord'}
              width="10"
              height="10"
            />
            Join the Discord!
          </a>
        </div>
      </div>
    </div>
  );
}
