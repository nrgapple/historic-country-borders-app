import GlobeTmpl from 'react-globe.gl';

const Globe = ({ forwardRef, ...otherProps }: any) => (
  <GlobeTmpl {...otherProps} ref={forwardRef} />
);

export default Globe;
