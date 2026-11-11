import { notFound } from 'next/navigation';
import { FeatureRouter } from '@/components/features/router';
import { isRoutable } from '@/components/layout/nav-config';

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (!isRoutable('TRAINER', `/trainer/${slug[0]}`)) notFound();
  return <FeatureRouter role="TRAINER" slug={slug} />;
}
