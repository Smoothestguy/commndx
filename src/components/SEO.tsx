import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  noIndex?: boolean;
  image?: string;
}

export const SEO = ({ 
  title = "Command X", 
  description = "Business management platform for projects, estimates, and invoices",
  keywords,
  noIndex = false,
  image
}: SEOProps) => {
  const fullTitle = title === "Command X" ? title : `${title} | Command X`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {image && <meta property="og:image:width" content="1200" />}
      {image && <meta property="og:image:height" content="630" />}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
      {image && <meta name="twitter:card" content="summary_large_image" />}
    </Helmet>
  );
};
