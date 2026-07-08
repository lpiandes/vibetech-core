import { Suspense } from "react";

import PropertiesPortfolioLayout, {
  type BusinessSubjectPortfolioIndex,
  type PortfolioPresentation,
} from "./PropertiesPortfolioLayout";
import { ProductLoading } from "@/components/product";

export default function PropertiesRenderer({
  businessId,
  portfolio,
  presentation,
}: {
  businessId: string;
  portfolio: BusinessSubjectPortfolioIndex;
  presentation: PortfolioPresentation;
}) {
  return (
    <Suspense fallback={<ProductLoading />}>
      <PropertiesPortfolioLayout businessId={businessId} portfolio={portfolio} presentation={presentation} />
    </Suspense>
  );
}
