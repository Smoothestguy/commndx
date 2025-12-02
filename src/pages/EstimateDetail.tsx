import { useParams, Navigate } from "react-router-dom";
import { EstimateDetailView } from "@/components/estimates/EstimateDetailView";

const EstimateDetail = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/estimates" replace />;
  }

  return <EstimateDetailView estimateId={id} />;
};

export default EstimateDetail;
