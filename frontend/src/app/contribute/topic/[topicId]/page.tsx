import { notFound, redirect } from 'next/navigation'
import {
  isTrainingTopicId,
  type TrainingTopicId,
} from '@/lib/training/training-topic-route'
import { TrainingRecorderPage } from '@/app/contribute/page'

interface TrainingTopicPageProps {
  params: {
    topicId: string
  }
}

export default function TrainingTopicPage({ params }: TrainingTopicPageProps) {
  if (params.topicId === 'assessment-screening') {
    redirect('/assessment')
  }

  if (!isTrainingTopicId(params.topicId)) {
    notFound()
  }

  return <TrainingRecorderPage topicId={params.topicId as TrainingTopicId} />
}
