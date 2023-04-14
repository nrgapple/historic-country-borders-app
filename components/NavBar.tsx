import Help from './Help';

interface NavBarProps {
  title: string;
  author?: string;
  onHelp?: () => void;
  showHelp?: boolean;
}

export default function NavBar({ onHelp, showHelp, title }: NavBarProps) {
  return (
    <div className="nav-bar">
      <div className="title drop">🌍 {title}</div>
      <div className="help-icon noselect" onClick={onHelp}>
        ❔
      </div>
      {showHelp && <Help />}
    </div>
  );
}
