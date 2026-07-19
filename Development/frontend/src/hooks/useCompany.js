import { useParams } from "react-router-dom";

export function useCompany() {
  const { slug } = useParams();

  return {
    slug,
  };
}
