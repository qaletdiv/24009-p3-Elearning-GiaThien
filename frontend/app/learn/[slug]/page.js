'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Button from '../../../components/Button'
import { apiRequest } from '../../../lib/api'

function getEmbedUrl(videoUrl) {
  if (!videoUrl) return null

  if (videoUrl.includes('youtube.com/embed/')) return videoUrl

  if (videoUrl.includes('youtube.com/watch?v=')) {
    const url = new URL(videoUrl)
    const videoId = url.searchParams.get('v')
    return videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl
  }

  if (videoUrl.includes('youtu.be/')) {
    const parts = videoUrl.split('youtu.be/')
    return parts[1] ? `https://www.youtube.com/embed/${parts[1]}` : videoUrl
  }

  return null
}

function isDirectVideo(url = '') {
  return ['.mp4', '.webm', '.ogg', '.mov'].some((ext) => url.toLowerCase().includes(ext))
}

export default function LearningPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const slug = params.slug
  const lessonId = searchParams.get('lessonId')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('discussion')
  const [discussionContent, setDiscussionContent] = useState('')
  const [discussionLoading, setDiscussionLoading] = useState(false)
  const [completeLoading, setCompleteLoading] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const endpoint = lessonId
        ? `/learning/courses/${slug}?lessonId=${lessonId}`
        : `/learning/courses/${slug}`

      const res = await apiRequest(endpoint)
      setData(res.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug) {
      loadData()
    }
  }, [slug, lessonId])

  useEffect(() => {
    if (!loading && data?.currentLesson?.lessonType === 'quiz' && !data.previewMode) {
      router.replace(`/learn/${slug}/quiz/${data.currentLesson.id}`)
    }
  }, [loading, data, router, slug])

  const handleSelectLesson = (selectedLessonId, selectedLessonType, isUnlocked) => {
    if (!isUnlocked) return

    if (selectedLessonType === 'quiz' && !data?.previewMode) {
      router.push(`/learn/${slug}/quiz/${selectedLessonId}`)
      return
    }

    router.push(`/learn/${slug}?lessonId=${selectedLessonId}`)
  }

  const handleCompleteLesson = async () => {
    if (!data?.currentLesson || data.previewMode) return

    try {
      setCompleteLoading(true)
      await apiRequest(`/learning/lessons/${data.currentLesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          courseSlug: slug,
          watchedSeconds: data.currentLesson.durationSeconds || 0,
        }),
      })
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompleteLoading(false)
    }
  }

  const handleVideoEnded = async () => {
    if (data?.currentLesson?.lessonType === 'video' && !data?.currentLesson?.isCompleted && !data?.previewMode) {
      await handleCompleteLesson()
    }
  }

  const handleSubmitDiscussion = async (e) => {
    e.preventDefault()
    if (!discussionContent.trim() || data?.previewMode) return

    try {
      setDiscussionLoading(true)
      await apiRequest(`/learning/lessons/${data.currentLesson.id}/discussions`, {
        method: 'POST',
        body: JSON.stringify({
          courseSlug: slug,
          content: discussionContent.trim(),
        }),
      })
      setDiscussionContent('')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setDiscussionLoading(false)
    }
  }

  const currentEmbedUrl = useMemo(() => {
    return getEmbedUrl(data?.currentLesson?.videoUrl || '')
  }, [data])

  const renderPlayer = () => {
    const lesson = data?.currentLesson
    if (!lesson) return null

    if (lesson.lessonType === 'video') {
      const currentEmbedUrl = getEmbedUrl(lesson.videoUrl || '')
      if (currentEmbedUrl) {
        return (
          <iframe
            src={currentEmbedUrl}
            title={lesson.title}
            className="h-full w-full"
            allowFullScreen
          />
        )
      }
      if (lesson.videoUrl && isDirectVideo(lesson.videoUrl)) {
        return <video src={lesson.videoUrl} controls className="h-full w-full" onEnded={handleVideoEnded} />
      }
      return <div className="flex h-full items-center justify-center bg-slate-100 text-slate-500">Video lỗi</div>
    }

    if (lesson.lessonType === 'document') {
      return (
        <div className="flex h-full flex-col overflow-y-auto bg-white p-8">
          <h3 className="text-2xl font-bold mb-4">{lesson.title}</h3>
          {lesson.documentUrl && (
            <a href={lesson.documentUrl} target="_blank" className="mb-4 inline-block text-blue-600 underline">Tải tài liệu</a>
          )}
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content?.replace(/\n/g, '<br />') }} />
        </div>
      )
    }

    if (lesson.lessonType === 'quiz') {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center">
          <h3 className="text-xl font-bold text-slate-900">Bài kiểm tra: {lesson.title}</h3>
          {lesson.isCompleted ? (
            <div className="mt-4">
              <p className="text-emerald-600 font-medium mb-4">Bạn đã hoàn thành bài kiểm tra này!</p>
              <Button onClick={() => router.push(`/learn/${slug}/quiz/${lesson.id}`)}>
                Xem kết quả / Làm lại
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-2 max-w-md text-sm text-slate-600">Nhấn nút bên dưới để bắt đầu bài đánh giá.</p>
              <Button className="mt-5" onClick={() => router.push(`/learn/${slug}/quiz/${lesson.id}`)} disabled={data.previewMode}>
                {data.previewMode ? 'Chế độ xem trước' : 'Bắt đầu làm bài'}
              </Button>
            </>
          )}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Đang tải phòng học...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-[32px] bg-red-50 p-6 text-red-600">{error || 'Không tải được dữ liệu học tập'}</div>
      </section>
    )
  }

  return (
    <section className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{data.course.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tiến độ: {Number(data.progressPercent || 0).toFixed(0)}%
            {data.previewMode ? ' • Đang xem dưới quyền Quản trị/Học thử' : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="aspect-video bg-slate-100 border-b border-slate-100">
              {renderPlayer()}
            </div>

            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 uppercase tracking-wider text-[10px]">
                  {data.currentLesson?.lessonType}
                </span>
                {data.currentLesson?.isCompleted && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-600 text-[10px]">
                    Đã hoàn thành
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-2xl font-bold text-slate-900">{data.currentLesson?.title}</h2>

              <div className="mt-6 flex flex-wrap gap-3">
                {data.currentLesson?.lessonType !== 'quiz' && !data.currentLesson?.isCompleted && !data.previewMode && (
                  <Button onClick={handleCompleteLesson} disabled={completeLoading}>
                    {completeLoading ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
                  </Button>
                )}

                {data.navigation.previousLesson && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleSelectLesson(
                        data.navigation.previousLesson.id,
                        data.navigation.previousLesson.lessonType,
                        data.navigation.previousLesson.isUnlocked
                      )
                    }
                  >
                    Bài trước
                  </Button>
                )}

                {data.navigation.nextLesson && (
                  <Button
                    variant="outline"
                    disabled={!data.navigation.nextLesson.isUnlocked}
                    onClick={() => {
                      if (data.navigation.nextLesson.lessonType === 'quiz' && !data.previewMode) {
                        router.push(`/learn/${slug}/quiz/${data.navigation.nextLesson.id}`)
                        return
                      }

                      handleSelectLesson(
                        data.navigation.nextLesson.id,
                        data.navigation.nextLesson.lessonType,
                        data.navigation.nextLesson.isUnlocked
                      )
                    }}
                  >
                    {data.navigation.nextLesson.lessonType === 'quiz' ? 'Sang bài kiểm tra' : 'Bài tiếp theo'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setTab('discussion')}
                className={`px-6 py-4 text-sm font-semibold transition-all ${tab === 'discussion' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'
                  }`}
              >
                Thảo luận
              </button>
              <button
                onClick={() => setTab('document')}
                className={`px-6 py-4 text-sm font-semibold transition-all ${tab === 'document' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'
                  }`}
              >
                Tóm tắt & Tài liệu
              </button>
            </div>

            <div className="p-6 md:p-8">
              {tab === 'discussion' ? (
                <div>
                  {!data.previewMode ? (
                    <form onSubmit={handleSubmitDiscussion} className="mb-6 space-y-3">
                      <textarea
                        value={discussionContent}
                        onChange={(e) => setDiscussionContent(e.target.value)}
                        rows={4}
                        placeholder="Viết câu hỏi hoặc chia sẻ của bạn..."
                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />
                      <Button type="submit" disabled={discussionLoading}>
                        {discussionLoading ? 'Đang gửi...' : 'Đăng thảo luận'}
                      </Button>
                    </form>
                  ) : (
                    <div className="mb-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                      Chế độ xem trước không hỗ trợ đăng thảo luận.
                    </div>
                  )}

                  <div className="space-y-4">
                    {data.currentLesson?.discussions?.length ? (
                      data.currentLesson.discussions.map((item) => (
                        <div key={item.id} className="rounded-[24px] bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 overflow-hidden">
                              {item.user?.avatarUrl ? (
                                <img
                                  src={`http://localhost:5000${item.user.avatarUrl}`}
                                  alt={item.user.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.user?.fullName?.charAt(0)?.toUpperCase() || 'U'
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{item.user?.fullName}</p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{item.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Chưa có thảo luận nào cho bài học này.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none text-sm leading-8 text-slate-700">
                  {data.currentLesson?.content ? (
                    <div dangerouslySetInnerHTML={{ __html: data.currentLesson.content.replace(/\n/g, '<br />') }} />
                  ) : (
                    <p className="text-slate-400">Bài học này chưa có tài liệu tóm tắt bổ sung.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="rounded-[32px] border border-slate-200 bg-white shadow-sm flex flex-col h-fit">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-900">Mục lục bài học</h3>
          </div>

          <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-4">
              {data.sections.map((section, index) => (
                <div key={section.id} className="rounded-[24px] bg-slate-50 p-4">
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Phần {index + 1}: {section.title}
                  </h4>

                  <div className="space-y-2">
                    {section.lessons.map((lesson) => {
                      const isActive = Number(lesson.id) === Number(data.currentLesson?.id)

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => handleSelectLesson(lesson.id, lesson.lessonType, lesson.isUnlocked)}
                          disabled={!lesson.isUnlocked}
                          className={`w-full rounded-2xl px-4 py-3 text-left transition-all ${isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                            : lesson.isUnlocked
                              ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-100'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-medium text-xs leading-5">{lesson.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] uppercase tracking-tighter ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {lesson.lessonType}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {lesson.isCompleted ? (
                                <span className={isActive ? 'text-white' : 'text-emerald-500'}>✓</span>
                              ) : lesson.isUnlocked ? (
                                <span className={isActive ? 'text-blue-200' : 'text-slate-300'}>○</span>
                              ) : (
                                <span className="text-slate-300">🔒</span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
