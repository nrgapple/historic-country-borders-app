import { useMemo } from 'react';
import { mapEventPropertiesType } from '../util/types';

interface DetailProps {
  id: number;
  title: string;
  content: string;
  author: string;
  flagged: boolean;
  actualDate: Date;
  onFlag: (id: number, active: boolean) => void;
  onClose: () => void;
}

const Detail = ({
  id,
  title,
  content,
  author,
  flagged,
  actualDate,
  onFlag,
  onClose,
}: DetailProps) => {
  const renderDate = useMemo(() => {
    return new Date(actualDate).toDateString();
  }, [actualDate]);
  return (
    <div className="details">
      <div className="details-nav">
        <div className="noselect" onClick={() => onClose()}>
          ╳
        </div>
      </div>
      <div className="details-body">
        <h1>{title}</h1>
        <h3>{renderDate}</h3>
        <p>{content}</p>
        <footer>Created by {author}</footer>
      </div>
    </div>
  );
};

export default Detail;
