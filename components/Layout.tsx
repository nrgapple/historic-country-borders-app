import React, { ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  year?: string;
};

export default function Layout({
  children,
  title,
  description,
  url,
  image,
  year,
}: Props) {
  // In App Router, metadata is handled at the page level via generateMetadata
  // This component now just renders children
  return <>{children}</>;
}
