import { notFound } from 'next/navigation';
import { FeatureRouter } from '@/components/features/router';
import { NAV } from '@/components/layout/nav-config';

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (!NAV.CLIENT.some((n) => n.href === `/client/${slug[0]}`)) notFound();
  return <FeatureRouter role="CLIENT" slug={slug} />;
}
