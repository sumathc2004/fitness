import { notFound } from 'next/navigation';
import { FeatureRouter } from '@/components/features/router';
import { NAV } from '@/components/layout/nav-config';

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (!NAV.SUPER_ADMIN.some((n) => n.href === `/admin/${slug[0]}`)) notFound();
  return <FeatureRouter role="SUPER_ADMIN" slug={slug} />;
}
