import { useParams } from 'react-router-dom';
import { HrReportContent } from '@/components/hr/HrReportContent';

const HrReportPage = () => {
  const { reportType } = useParams();
  const reportKey = reportType || '';

  return (
    <div className="p-6">
      <HrReportContent reportType={reportKey} />
    </div>
  );
};

export default HrReportPage;
