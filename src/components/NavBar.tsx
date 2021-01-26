import Help from './Help';

interface NavBarProps {
  onHelp?: () => void;
  showHelp?: boolean;
}

const NavBar = ({ onHelp, showHelp }: NavBarProps) => (
  <div className="nav-bar">
    <div className="title drop">🌍 Historic Country Borders</div>
    <div className="help-icon noselect" onClick={onHelp}>
      ❔
    </div>
    {showHelp && <Help />}
  </div>
);

export default NavBar;
