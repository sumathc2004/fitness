'use client';

import { Suspense, useState } from 'react';
import type { RoleName } from '@gym/config';
import { Skeleton } from '@/components/ui/misc';
import { Tabs } from '@/components/kit/kit';
import { AttendancePage } from './attendance';
import { AnalyticsPage, MembershipsPage, PaymentsPage, ReportsPage, SubscriptionsPage, TrainerAnalyticsPage } from './business';
import { BodyAnalysisPage, NutritionCalculatorPage, NutritionSettingsPage } from './body';
import { DietBuilderPage, DietListPage } from './diet-builder';
import { MyDietPage } from './diet-log';
import { ExercisesPage } from './exercises';
import { HabitsPage, SleepPage, WaterPage } from './habits';
import { MessagesPage, NotificationsPage } from './messages';
import { ClientDetailPage, ClientsPage, TrainersPage } from './people';
import { MeasurementsPage, PhotosPage, ProgressPage } from './progress';
import { TodaysWorkoutPage, WorkoutHistoryPage } from './workout-run';
import { WorkoutBuilderPage, WorkoutCalendarPage, WorkoutsIndexPage, WorkoutTemplatesPage } from './workouts';

const idOf = (s?: string) => (s && s !== 'new' ? s : undefined);

function TrainerProgress() {
  const [tab, setTab] = useState<'all' | 'client'>('all');
  return (<div><Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All my clients' }, { id: 'client', label: 'One client' }]} />{tab === 'all' ? <TrainerAnalyticsPage /> : <ProgressPage isClient={false} />}</div>);
}

function Feature({ role, slug }: { role: RoleName; slug: string[] }) {
  const [head, sub] = slug;
  const isClient = role === 'CLIENT';
  const common = (): React.ReactNode | undefined => {
    switch (head) {
      case 'messages': return <MessagesPage />;
      case 'notifications': return <NotificationsPage />;
      case 'attendance': return <AttendancePage isClient={isClient} />;
      case 'exercise-3d': return <ExercisesPage mode="3d" />;
      case 'body-analysis': return <BodyAnalysisPage isClient={isClient} />;
      case 'nutrition-calculator': return <NutritionCalculatorPage isClient={isClient} />;
      case 'measurements': return <MeasurementsPage isClient={isClient} />;
      case 'progress-photos': return <PhotosPage isClient={isClient} />;
      default: return undefined;
    }
  };
  const c = common();
  if (c) return <>{c}</>;

  if (role === 'SUPER_ADMIN') {
    switch (head) {
      case 'trainers': return <TrainersPage />;
      case 'clients': return sub ? <ClientDetailPage clientId={sub} base="/admin" /> : <ClientsPage base="/admin" />;
      case 'exercises': return <ExercisesPage mode="manage" />;
      case 'workout-templates': return sub ? <WorkoutBuilderPage id={idOf(sub)} listHref="/admin/workout-templates" forceTemplate /> : <WorkoutTemplatesPage builderBase="/admin/workout-templates" />;
      case 'diet-templates': return sub ? <DietBuilderPage id={idOf(sub)} listHref="/admin/diet-templates" forceTemplate /> : <DietListPage templates builderBase="/admin/diet-templates" />;
      case 'nutrition-settings': return <NutritionSettingsPage />;
      case 'memberships': return <MembershipsPage />;
      case 'subscriptions': return <SubscriptionsPage />;
      case 'payments': return <PaymentsPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'reports': return <ReportsPage />;
    }
  }
  if (role === 'TRAINER') {
    switch (head) {
      case 'clients': return sub ? <ClientDetailPage clientId={sub} base="/trainer" /> : <ClientsPage base="/trainer" />;
      case 'workout-builder': return sub ? <WorkoutBuilderPage id={idOf(sub)} listHref="/trainer/workout-builder" forceTemplate={false} /> : <WorkoutsIndexPage builderBase="/trainer/workout-builder" />;
      case 'workout-calendar': return <WorkoutCalendarPage builderBase="/trainer/workout-builder" />;
      case 'workout-templates': return sub ? <WorkoutBuilderPage id={idOf(sub)} listHref="/trainer/workout-templates" forceTemplate /> : <WorkoutTemplatesPage builderBase="/trainer/workout-templates" />;
      case 'diet-builder': return sub ? <DietBuilderPage id={idOf(sub)} listHref="/trainer/diet-builder" forceTemplate={false} /> : <DietListPage templates builderBase="/trainer/diet-builder" />;
      case 'meal-plans': return <DietListPage templates={false} builderBase="/trainer/diet-builder" />;
      case 'progress': return <TrainerProgress />;
      case 'reports': return <ReportsPage />;
    }
  }
  if (role === 'CLIENT') {
    switch (head) {
      case 'workout': return <TodaysWorkoutPage />;
      case 'workout-history': return <WorkoutHistoryPage />;
      case 'diet': return <MyDietPage />;
      case 'progress': return <ProgressPage isClient />;
      case 'water': return <WaterPage />;
      case 'sleep': return <SleepPage />;
      case 'habits': return <HabitsPage />;
    }
  }
  return null;
}

export function FeatureRouter({ role, slug }: { role: RoleName; slug: string[] }) {
  return <Suspense fallback={<Skeleton className="h-96" />}><Feature role={role} slug={slug} /></Suspense>;
}
