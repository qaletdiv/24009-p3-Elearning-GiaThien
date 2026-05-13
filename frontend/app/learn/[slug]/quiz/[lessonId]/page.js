'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Button from '../../../../../components/Button'
import { apiRequest } from '../../../../../lib/api'

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function QuizPage() {
  const params = useParams()
  const router = useRouter()

  const slug = params.slug
  const lessonId = params.lessonId

  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(null)

  const loadQuiz = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiRequest(`/quizzes/courses/${slug}/lessons/${lessonId}`)
      setData(res.data)

      const timeLimitMinutes = Number(res.data.quiz?.timeLimitMinutes || 0)
      setRemainingSeconds(timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null)
      setResult(null)
      setAnswers({})
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug && lessonId) {
      loadQuiz()
    }
  }, [slug, lessonId])

  const handleSubmit = async () => {
    if (!data?.quiz) return

    try {
      setSubmitting(true)
      setError('')

      const payload = Object.entries(answers).map(([questionId, answerId]) => ({
        questionId: Number(questionId),
        answerId: Number(answerId),
      }))

      const res = await apiRequest(`/quizzes/courses/${slug}/lessons/${lessonId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: payload,
        }),
      })

      setResult(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (remainingSeconds === null || result) return

    if (remainingSeconds <= 0) {
      handleSubmit()
      return
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev === null ? null : prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [remainingSeconds, result])

  const totalAnswered = useMemo(() => {
    return Object.keys(answers).length
  }, [answers])

  if (loading) {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Đang tải bài kiểm tra...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-[32px] bg-red-50 p-6 text-red-600">{error || 'Không tải được bài kiểm tra'}</div>
      </section>
    )
  }

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">A.7 Làm bài kiểm tra</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{data.quiz.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cần đạt tối thiểu {data.quiz.passScore}% để vượt qua bài kiểm tra.
          </p>
        </div>

        <div className="rounded-[24px] bg-slate-900 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Thời gian còn lại</p>
          <p className="mt-1 text-2xl font-bold">
            {remainingSeconds === null ? 'Không giới hạn' : formatTime(Math.max(remainingSeconds, 0))}
          </p>
        </div>
      </div>

      {result ? (
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div
            className={`rounded-[24px] p-6 ${
              result.isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <h2 className="text-2xl font-bold">
              {result.isPassed ? 'Bạn đã đạt bài kiểm tra' : 'Bạn chưa đạt bài kiểm tra'}
            </h2>
            <p className="mt-3">
              Điểm số: <strong>{result.score}%</strong> • Đúng {result.correctCount}/{result.totalQuestions} câu
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {result.isPassed ? (
              <Button
                onClick={() => {
                  if (result.nextLesson?.lessonType === 'quiz') {
                    router.push(`/learn/${slug}/quiz/${result.nextLesson.id}`)
                    return
                  }

                  if (result.nextLesson?.id) {
                    router.push(`/learn/${slug}?lessonId=${result.nextLesson.id}`)
                    return
                  }

                  router.push(`/learn/${slug}`)
                }}
              >
                {result.nextLesson ? 'Tiếp tục bài học' : 'Quay về khóa học'}
              </Button>
            ) : (
              <Button onClick={loadQuiz}>Làm lại</Button>
            )}

            <Button variant="outline" onClick={() => router.push(`/learn/${slug}`)}>
              Về phòng học
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <p className="text-sm text-slate-600">
              Đã trả lời {totalAnswered}/{data.quiz.questions.length} câu
            </p>
          </div>

          {data.quiz.questions.map((question, index) => (
            <div key={question.id} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-lg font-bold text-slate-900">
                Câu {index + 1}. {question.questionText}
              </h2>

              <div className="mt-5 space-y-3">
                {question.answers.map((answer) => {
                  const isSelected = Number(answers[question.id]) === Number(answer.id)

                  return (
                    <label
                      key={answer.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-[24px] border px-4 py-4 transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={answer.id}
                        checked={isSelected}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: answer.id,
                          }))
                        }
                        className="mt-1"
                      />
                      <span className="text-sm leading-7 text-slate-700">{answer.answerText}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang nộp bài...' : 'Nộp bài'}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/learn/${slug}`)}>
              Quay lại phòng học
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}