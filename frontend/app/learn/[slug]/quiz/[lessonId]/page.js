'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

  const slug = params?.slug
  const lessonId = params?.lessonId

  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(null)

  const timerRef = useRef(null)
  const submittedRef = useRef(false) 


  const loadQuiz = async () => {
    try {
      setLoading(true)
      setError('')

      const res = await apiRequest(`/quizzes/courses/${slug}/lessons/${lessonId}`)

      if (!res?.data?.quiz) {
        throw new Error('Không tìm thấy dữ liệu quiz')
      }

      setData(res.data)

      const timeLimit = Number(res.data.quiz?.timeLimitMinutes || 0)
      setRemainingSeconds(timeLimit > 0 ? timeLimit * 60 : null)

      setAnswers({})
      setResult(null)
      submittedRef.current = false
    } catch (err) {
      setError(err.message || 'Lỗi tải bài kiểm tra')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug && lessonId) {
      loadQuiz()
    }
  }, [slug, lessonId])


  useEffect(() => {
    if (remainingSeconds === null || result) return

    if (remainingSeconds <= 0) {
      if (!submittedRef.current) {
        handleSubmit()
      }
      return
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [remainingSeconds, result])

  
  const handleSubmit = async () => {
    if (!data?.quiz || submittedRef.current) return

    try {
      submittedRef.current = true
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

      clearInterval(timerRef.current)
      setResult(res.data)
    } catch (err) {
      submittedRef.current = false
      setError(err.message || 'Nộp bài thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  
  const totalAnswered = useMemo(() => {
    return Object.keys(answers).length
  }, [answers])

  
  if (loading) {
    return (
      <section className="max-w-5xl mx-auto py-10 text-center text-slate-500">
        Đang tải bài kiểm tra...
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="max-w-5xl mx-auto py-10 text-red-600 text-center">
        {error || 'Không tải được bài kiểm tra'}
      </section>
    )
  }


  if (result) {
    return (
      <section className="max-w-5xl mx-auto py-10">
        <div className={`p-6 rounded-xl ${result.isPassed ? 'bg-green-100' : 'bg-red-100'}`}>
          <h2 className="text-xl font-bold">
            {result.isPassed ? 'Bạn đã đạt' : 'Bạn chưa đạt'}
          </h2>

          <p className="mt-2">
            Điểm: <b>{result.score}%</b> ({result.correctCount}/{result.totalQuestions})
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          {result.isPassed ? (
            <Button
              onClick={() => {
                if (result.nextLesson?.lessonType === 'quiz') {
                  router.push(`/learn/${slug}/quiz/${result.nextLesson.id}`)
                } else if (result.nextLesson?.id) {
                  router.push(`/learn/${slug}?lessonId=${result.nextLesson.id}`)
                } else {
                  router.push(`/learn/${slug}`)
                }
              }}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button onClick={loadQuiz}>Làm lại</Button>
          )}

          <Button variant="outline" onClick={() => router.push(`/learn/${slug}`)}>
            Quay lại
          </Button>
        </div>
      </section>
    )
  }

  
  return (
    <section className="max-w-5xl mx-auto py-10">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{data.quiz.title}</h1>

        <div className="bg-black text-white px-4 py-2 rounded">
          {remainingSeconds === null
            ? '∞'
            : formatTime(Math.max(remainingSeconds, 0))}
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Đã trả lời {totalAnswered}/{data.quiz.questions.length}
      </p>

      {data.quiz.questions.map((q, index) => (
        <div key={q.id} className="mb-6 p-4 border rounded">
          <h2 className="font-semibold">
            Câu {index + 1}. {q.questionText}
          </h2>

          <div className="mt-3 space-y-2">
            {q.answers.map((a) => (
              <label key={a.id} className="block">
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={Number(answers[q.id]) === a.id}
                  onChange={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: a.id,
                    }))
                  }
                />
                <span className="ml-2">{a.answerText}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Đang nộp...' : 'Nộp bài'}
      </Button>
    </section>
  )
}