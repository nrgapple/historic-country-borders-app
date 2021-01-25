interface NavBarProps {
  onClick?: () => void
}

const NavBar = ({onClick}: NavBarProps) => (
  <div className="nav-bar" onClick={onClick}>
    <div className="title drop">🌍 Historic Country Borders</div>
  </div>
);

export default NavBar;
