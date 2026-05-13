'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Button from '../../../components/Button'
import { apiRequest, getStoredUser } from '../../../lib/api'

function formatPrice(price, isFree) {
  if (isFree || Number(price) === 0) return 'Miễn phí'
  return `${Number(price).toLocaleString('vi-VN')}đ`
}

function renderActionLabel(course) {
  if (!course) return 'Mua ngay'
  if (course.viewer?.isEnrolled) return 'Vào học ngay'
  if (!course.viewer?.isAuthenticated) return 'Mua ngay'
  return 'Mua ngay'
}

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await apiRequest(`/courses/${slug}`)
        setCourse(res.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchCourse()
    }
  }, [slug])

  const totalLessons = useMemo(() => {
    if (!course?.sections) return 0
    return course.sections.reduce((sum, section) => sum + (section.lessons?.length || 0), 0)
  }, [course])

  const handlePrimaryAction = async () => {
    if (!course) return

    try {
      setActionLoading(true)
      const storedUser = getStoredUser()

      if (!storedUser) {
        router.push(`/auth?redirect=${encodeURIComponent(`/checkout/${course.slug}`)}`)
        return
      }

      if (course.viewer?.isEnrolled) {
        router.push(`/learn/${course.slug}`)
        return
      }

      router.push(`/checkout/${course.slug}`)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Đang tải chi tiết khóa học...
        </div>
      </section>
    )
  }

  if (error || !course) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-[32px] bg-red-50 p-6 text-red-600">{error || 'Không tìm thấy khóa học'}</div>
      </section>
    )
  }

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[16/8] bg-slate-100">
              {course.trailerUrl ? (
                <iframe
                  src={course.trailerUrl}
                  title={course.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : course.coverImageUrl ? (
                <img src={course.coverImageUrl} alt={course.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 text-slate-500">
                  Chưa có trailer
                </div>
              )}
            </div>

            <div className="space-y-4 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-600">
                  {course.category?.name || 'Khóa học'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                  {course.level || 'all-level'}
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{course.title}</h1>

              <p className="text-base leading-8 text-slate-600">
                {course.shortDescription || 'Khóa học đang được cập nhật mô tả ngắn.'}
              </p>

              <div className="grid gap-4 rounded-[24px] bg-slate-50 p-5 md:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-500">Giảng viên</p>
                  <p className="mt-1 font-semibold text-slate-900">{course.instructor?.fullName || 'Đang cập nhật'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Đánh giá</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {Number(course.ratingAvg || 0).toFixed(1)} / 5 ({course.ratingCount || 0} lượt)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Bài học</p>
                  <p className="mt-1 font-semibold text-slate-900">{totalLessons} bài</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Giới thiệu khóa học</h2>
            <div className="prose prose-slate mt-4 max-w-none whitespace-pre-line text-slate-600">
              {course.description || 'Khóa học đang được cập nhật nội dung chi tiết.'}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Giáo án</h2>
            <div className="mt-6 space-y-4">
              {course.sections?.length ? (
                course.sections.map((section, index) => (
                  <div key={section.id} className="rounded-[24px] bg-slate-50 p-5">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Phần {index + 1}: {section.title}
                      </h3>
                      <span className="text-sm text-slate-500">{section.lessons?.length || 0} bài</span>
                    </div>

                    <div className="space-y-2">
                      {section.lessons?.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{lesson.title}</p>
                            <p className="mt-1 text-slate-500">{lesson.lessonType}</p>
                          </div>
                          <div className="text-right text-slate-500">
                            {lesson.isPreview ? 'Preview' : 'Nội dung khóa học'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Chưa có giáo án chi tiết.</p>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-bold text-slate-900">Giảng viên</h2>
            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
                {course.instructor?.avatarUrl ? (
                  <img
                    src={`http://localhost:5000${course.instructor.avatarUrl}`}
                    alt={course.instructor.fullName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  course.instructor?.fullName?.charAt(0)?.toUpperCase() || 'I'
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{course.instructor?.fullName || 'Đang cập nhật'}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Giảng viên đang phụ trách và đồng hành cùng học viên trong suốt lộ trình học tập của khóa học này.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside>
          <div className="sticky top-24 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Đăng ký ngay</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {formatPrice(course.price, course.isFree)}
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              <li>• Truy cập khóa học mọi lúc</li>
              <li>• Theo dõi tiến độ học tập</li>
              <li>• Học trên nhiều thiết bị</li>
              <li>• Làm quiz nếu khóa học có bài kiểm tra</li>
            </ul>

            <Button className="mt-8 w-full" onClick={handlePrimaryAction} disabled={actionLoading}>
              {actionLoading ? 'Đang xử lý...' : renderActionLabel(course)}
            </Button>

            {!course.viewer?.isAuthenticated && (
              <p className="mt-3 text-center text-sm text-slate-500">
                Bạn cần đăng nhập để tiếp tục thanh toán.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}