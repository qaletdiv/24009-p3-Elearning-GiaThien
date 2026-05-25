'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Button from '../../../../../components/Button'
import { apiRequest, getStoredUser } from '../../../../../lib/api'

const emptyQuestionForm = {
  questionText: '',
  sortOrder: 0,
  answers: [
    { answerText: '', isCorrect: true },
    { answerText: '', isCorrect: false },
    { answerText: '', isCorrect: false },
    { answerText: '', isCorrect: false },
  ],
}

export default function CourseEditorPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [course, setCourse] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [newSection, setNewSection] = useState({ title: '', sortOrder: 0 })
  const [newLessonBySection, setNewLessonBySection] = useState({})
  const [quizFormByLesson, setQuizFormByLesson] = useState({})
  const [newQuestionByQuiz, setNewQuestionByQuiz] = useState({})
  const [selectedFiles, setSelectedFiles] = useState({})

  // Trạng thái loading riêng biệt để tránh spam click nút
  const [isSavingLessonId, setIsSavingLessonId] = useState(null)
  const [isCreatingLessonSectionId, setIsCreatingLessonSectionId] = useState(null)

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/courses/${courseId}/editor`)
      return
    }
    if (!['admin', 'instructor'].includes(user.role)) {
      router.replace('/')
      return
    }
    setAuthorized(true)
  }, [router, courseId])

  const fetchEditorData = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiRequest(`/manage/courses/${courseId}/editor`)
      setCourse(res.data)

      const nextQuizForms = {}
      const nextQuestionForms = {}

      ;(res.data.sections || []).forEach((section) => {
        ;(section.lessons || []).forEach((lesson) => {
          if (lesson.lessonType === 'quiz') {
            nextQuizForms[lesson.id] = {
              title: lesson.quiz?.title || `${lesson.title} - Quiz`,
              passScore: lesson.quiz?.passScore || 80,
              timeLimitMinutes: lesson.quiz?.timeLimitMinutes || '',
            }
            if (lesson.quiz?.id) {
              nextQuestionForms[lesson.quiz.id] = { ...emptyQuestionForm }
            }
          }
        })
      })
      setQuizFormByLesson(nextQuizForms)
      setNewQuestionByQuiz(nextQuestionForms)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authorized) {
      fetchEditorData()
    }
  }, [authorized])

  const sectionCount = useMemo(() => course?.sections?.length || 0, [course])

  const getDefaultLessonForm = (sectionId, currentSection) => {
    const nextOrder = (currentSection?.lessons?.length || 0) + 1
    return {
      sectionId,
      title: '',
      lessonType: 'video',
      content: '',
      videoUrl: '',
      documentUrl: '',
      isPreview: false,
      isPublished: true,
      unlockMethod: 'sequential', // Tùy chọn trực quan thay thế cho unlockOrder: 'sequential' hoặc 'free'
      sortOrder: nextOrder,
    }
  }

  const handleCreateSection = async (e) => {
    e.preventDefault()
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/courses/${courseId}/sections`, {
        method: 'POST',
        body: JSON.stringify({
          title: newSection.title,
          sortOrder: Number(newSection.sortOrder || 0),
        }),
      })
      setMessage('Tạo chương học thành công')
      setNewSection({ title: '', sortOrder: sectionCount + 1 })
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateSection = async (section) => {
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/sections/${section.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: section.title,
          sortOrder: Number(section.sortOrder || 0),
        }),
      })
      setMessage('Cập nhật chương học thành công')
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteSection = async (sectionId) => {
    const confirmed = window.confirm('Bạn có chắc muốn xóa chương học này?')
    if (!confirmed) return
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/sections/${sectionId}`, { method: 'DELETE' })
      setMessage('Xóa chương học thành công')
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLessonFormChange = (sectionId, field, value, section) => {
    setNewLessonBySection((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || getDefaultLessonForm(sectionId, section)),
        [field]: value,
      },
    }))
  }

  // SỬA LỖI: Nút "Thêm bài học" hoạt động chuẩn xác và chống trùng lặp dữ liệu đầu vào
  const handleCreateLesson = async (sectionId, section) => {
    const form = newLessonBySection[sectionId] || getDefaultLessonForm(sectionId, section)
    if (!form.title.trim()) {
      setError('Vui lòng nhập tên bài học trước khi thêm.')
      return
    }

    try {
      setMessage('')
      setError('')
      setIsCreatingLessonSectionId(sectionId)

      const formData = new FormData()
      formData.append('sectionId', String(sectionId))
      formData.append('title', String(form.title.trim()))
      formData.append('lessonType', String(form.lessonType))
      formData.append('content', String(form.content || ''))
      formData.append('videoUrl', form.lessonType === 'video' ? String(form.videoUrl || '') : '')
      formData.append('durationSeconds', '') // Đặt trống (không bắt người dùng gõ tay số giây vô lý)

      // Chuyển đổi logic Unlock sang dữ liệu số cho tầng điều hướng Backend nhận biết
      const calculatedUnlockOrder = form.unlockMethod === 'sequential' ? String(form.sortOrder) : '0'
      formData.append('unlockOrder', calculatedUnlockOrder)
      formData.append('sortOrder', String(form.sortOrder || 1))
      
      formData.append('isPreview', form.isPreview ? 'true' : 'false')
      formData.append('isPublished', form.isPublished ? 'true' : 'false')

      if (form.lessonType === 'document' && selectedFiles[`new-${sectionId}`]) {
        formData.append('documentFile', selectedFiles[`new-${sectionId}`])
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      
      const response = await fetch(`http://localhost:5000/api/manage/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      })

      const resData = await response.json()
      if (!response.ok) throw new Error(resData.message || 'Hệ thống không thể khởi tạo bài học mới')

      setMessage(`Thêm bài học "${form.title}" thành công!`)
      
      // Khởi động lại form về rỗng
      setNewLessonBySection((prev) => ({
        ...prev,
        [sectionId]: getDefaultLessonForm(sectionId, section),
      }))
      
      setSelectedFiles(prev => {
        const next = { ...prev }
        delete next[`new-${sectionId}`]
        return next
      })

      fetchEditorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsCreatingLessonSectionId(null)
    }
  }

  const handleLessonFieldChange = (sectionId, lessonId, field, value) => {
    setCourse((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              lessons: section.lessons.map((lesson) =>
                lesson.id !== lessonId ? lesson : { ...lesson, [field]: value }
              ),
            }
      ),
    }))
  }

  const handleUpdateLesson = async (lesson) => {
    try {
      setMessage('')
      setError('')
      setIsSavingLessonId(lesson.id)

      const formData = new FormData()
      formData.append('sectionId', String(lesson.sectionId))
      formData.append('title', String(lesson.title || ''))
      formData.append('lessonType', String(lesson.lessonType || 'video'))
      formData.append('content', String(lesson.content || ''))
      formData.append('videoUrl', lesson.lessonType === 'video' ? String(lesson.videoUrl || '') : '')
      formData.append('documentUrl', lesson.lessonType === 'document' ? String(lesson.documentUrl || '') : '')
      formData.append('durationSeconds', '') // Triệt tiêu việc validate trường số giây

      // Đồng bộ hóa việc chuyển đổi UnlockOrder hiện tại sang chuỗi ký tự số an toàn
      const finalUnlockOrder = lesson.unlockMethod === 'free' ? '0' : String(lesson.sortOrder || lesson.unlockOrder || 0)
      formData.append('unlockOrder', finalUnlockOrder)
      formData.append('sortOrder', String(lesson.sortOrder || 0))
      
      formData.append('isPreview', String(lesson.isPreview) === 'true' || lesson.isPreview === true || lesson.isPreview === 1 ? 'true' : 'false')
      formData.append('isPublished', String(lesson.isPublished) === 'false' || lesson.isPublished === false || lesson.isPublished === 0 ? 'false' : 'true')

      if (lesson.lessonType === 'document' && selectedFiles[lesson.id]) {
        formData.append('documentFile', selectedFiles[lesson.id])
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      
      const response = await fetch(`http://localhost:5000/api/manage/lessons/${lesson.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      })

      const resData = await response.json()
      if (!response.ok) {
        throw new Error(resData.message || 'Gặp lỗi trong quá trình cập nhật thông tin bài học')
      }

      setMessage(`Cập nhật thành công thông tin bài học!`)
      
      setSelectedFiles(prev => {
        const next = { ...prev }
        delete next[lesson.id]
        return next
      })
      
      await fetchEditorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSavingLessonId(null)
    }
  }

  const handleDeleteLesson = async (lessonId) => {
    const confirmed = window.confirm('Bạn có chắc muốn xóa bài học này?')
    if (!confirmed) return
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/lessons/${lessonId}`, { method: 'DELETE' })
      setMessage('Xóa bài học thành công')
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleQuizFormChange = (lessonId, field, value) => {
    setQuizFormByLesson((prev) => ({
      ...prev,
      [lessonId]: {
        ...(prev[lessonId] || { title: '', passScore: 80, timeLimitMinutes: '' }),
        [field]: value,
      },
    }))
  }

  const handleSaveQuiz = async (lessonId) => {
    const form = quizFormByLesson[lessonId]
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/lessons/${lessonId}/quiz`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          passScore: Number(form.passScore || 80),
          timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
        }),
      })
      setMessage('Lưu quiz thành công')
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleQuestionFormChange = (quizId, field, value) => {
    setNewQuestionByQuiz((prev) => ({
      ...prev,
      [quizId]: {
        ...(prev[quizId] || { ...emptyQuestionForm }),
        [field]: value,
      },
    }))
  }

  const handleAnswerChange = (quizId, index, field, value) => {
    setNewQuestionByQuiz((prev) => {
      const current = prev[quizId] || { ...emptyQuestionForm }
      const answers = current.answers.map((answer, answerIndex) =>
        answerIndex !== index ? answer : { ...answer, [field]: value }
      )
      return { ...prev, [quizId]: { ...current, answers } }
    })
  }

  const handleChooseCorrectAnswer = (quizId, index) => {
    setNewQuestionByQuiz((prev) => {
      const current = prev[quizId] || { ...emptyQuestionForm }
      return {
        ...prev,
        [quizId]: {
          ...current,
          answers: current.answers.map((answer, answerIndex) => ({
            ...answer,
            isCorrect: answerIndex === index,
          })),
        },
      }
    })
  }

  const handleCreateQuestion = async (quizId) => {
    const form = newQuestionByQuiz[quizId] || { ...emptyQuestionForm }
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/quizzes/${quizId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          questionText: form.questionText,
          sortOrder: Number(form.sortOrder || 0),
          answers: form.answers,
        }),
      })
      setMessage('Thêm câu hỏi quiz thành công')
      setNewQuestionByQuiz((prev) => ({
        ...prev,
        [quizId]: { ...emptyQuestionForm },
      }))
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteQuestion = async (questionId) => {
    const confirmed = window.confirm('Bạn có chắc muốn xóa câu hỏi này?')
    if (!confirmed) return
    try {
      setMessage('')
      setError('')
      await apiRequest(`/manage/questions/${questionId}`, { method: 'DELETE' })
      setMessage('Xóa câu hỏi thành công')
      fetchEditorData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!authorized) return null

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {course?.title || 'Biên soạn khóa học'}
        </h1>
      </div>

      {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Đang tải dữ liệu biên soạn...
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleCreateSection} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Tạo chương mới</h2>
            <div className="grid gap-4 md:grid-cols-[1fr_160px_auto]">
              <input
                value={newSection.title}
                onChange={(e) => setNewSection((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Tên chương học (Ví dụ: Chương 1: Giới thiệu cơ bản)"
                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
              />
              <input
                type="number"
                value={newSection.sortOrder}
                onChange={(e) => setNewSection((prev) => ({ ...prev, sortOrder: e.target.value }))}
                placeholder="Thứ tự hiển thị"
                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
              />
              <Button type="submit">Thêm chương</Button>
            </div>
          </form>

          <div className="space-y-6">
            {(course?.sections || []).map((section, sectionIndex) => {
              const lessonForm = newLessonBySection[section.id] || getDefaultLessonForm(section.id, section)

              return (
                <div key={section.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end border-b border-slate-100 pb-5">
                    <div className="flex-1">
                      <label className="mb-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Chương {sectionIndex + 1}</label>
                      <input
                        value={section.title}
                        onChange={(e) =>
                          setCourse((prev) => ({
                            ...prev,
                            sections: prev.sections.map((item) =>
                              item.id !== section.id ? item : { ...item, title: e.target.value }
                            ),
                          }))
                        }
                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600 font-semibold"
                      />
                    </div>

                    <div className="w-full md:w-40">
                      <label className="mb-2 block text-xs font-bold text-slate-400 uppercase tracking-wider">Thứ tự hiển thị</label>
                      <input
                        type="number"
                        value={section.sortOrder}
                        onChange={(e) =>
                          setCourse((prev) => ({
                            ...prev,
                            sections: prev.sections.map((item) =>
                              item.id !== section.id ? item : { ...item, sortOrder: e.target.value }
                            ),
                          }))
                        }
                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => handleUpdateSection(section)}>Lưu tên chương</Button>
                      <Button type="button" variant="outline" onClick={() => handleDeleteSection(section.id)}>Xóa chương</Button>
                    </div>
                  </div>

                  {/* THIẾT KẾ MỚI TRỰC QUAN CHO FORM "THÊM BÀI HỌC" */}
                  <div className="rounded-[24px] bg-slate-50 p-5 border border-slate-200">
                    <h3 className="mb-4 text-base font-bold text-slate-800 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">+</span>
                      Thêm bài học mới vào chương này
                    </h3>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Tên bài học</label>
                        <input
                          value={lessonForm.title}
                          onChange={(e) => handleLessonFormChange(section.id, 'title', e.target.value, section)}
                          placeholder="Ví dụ: Bài 1: Tổng quan quy trình hoạt động"
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Định dạng phân phối bài học</label>
                        <select
                          value={lessonForm.lessonType}
                          onChange={(e) => handleLessonFormChange(section.id, 'lessonType', e.target.value, section)}
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="video">Bài học Video (Nhúng URL Youtube / Bên ngoài)</option>
                          <option value="document">Bài học Document (Tải file tài liệu, PDF, Word)</option>
                          <option value="quiz">Bài tập trắc nghiệm</option>
                        </select>
                      </div>

                     
                      {lessonForm.lessonType === 'video' && (
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Đường dẫn liên kết Video</label>
                          <input
                            value={lessonForm.videoUrl}
                            onChange={(e) => handleLessonFormChange(section.id, 'videoUrl', e.target.value, section)}
                            placeholder="Dán link Video Youtube embed hoặc MP4 URL tại đây..."
                            className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      )}

                      {lessonForm.lessonType === 'document' && (
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">Chọn file đính kèm từ máy tính</label>
                          <div className="flex items-center w-full rounded-2xl bg-white px-4 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                            <input
                              type="file"
                              onChange={(e) => setSelectedFiles(prev => ({ ...prev, [`new-${section.id}`]: e.target.files[0] }))}
                              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                          </div>
                        </div>
                      )}

                      {/* Thay đổi Sort Order & Unlock Order thành giao diện mô tả trực quan, dễ hiểu */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Thứ tự hiển thị bài học này</label>
                        <input
                          type="number"
                          value={lessonForm.sortOrder}
                          onChange={(e) => handleLessonFormChange(section.id, 'sortOrder', Number(e.target.value || 1), section)}
                          placeholder="Ví dụ: Bài số 1, Bài số 2..."
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Cấu hình điều kiện mở khóa bài</label>
                        <select
                          value={lessonForm.unlockMethod || 'sequential'}
                          onChange={(e) => handleLessonFormChange(section.id, 'unlockMethod', e.target.value, section)}
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="sequential">Học tuần tự (Xong bài trước mới được xem bài này)</option>
                          <option value="free">Mở khóa tự do (Học viên có thể nhảy bài tự do)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-6 py-2">
                        <label className="inline-flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lessonForm.isPreview}
                            onChange={(e) => handleLessonFormChange(section.id, 'isPreview', e.target.checked, section)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Cho phép học thử (Không cần mua)
                        </label>

                        <label className="inline-flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lessonForm.isPublished}
                            onChange={(e) => handleLessonFormChange(section.id, 'isPublished', e.target.checked, section)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Phát hành công khai
                        </label>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Nội dung văn bản / Ghi chú đính kèm bài học</label>
                        <textarea
                          value={lessonForm.content}
                          onChange={(e) => handleLessonFormChange(section.id, 'content', e.target.value, section)}
                          rows={3}
                          placeholder="Nhập nội dung bài học chữ hoặc mô tả tài liệu hướng dẫn học viên tại đây..."
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button 
                        type="button" 
                        onClick={() => handleCreateLesson(section.id, section)}
                        disabled={isCreatingLessonSectionId === section.id}
                      >
                        {isCreatingLessonSectionId === section.id ? 'Đang khởi tạo bài học...' : '✓ Xác nhận thêm bài học'}
                      </Button>
                    </div>
                  </div>

                  {/* THIỂT KẾ CHI TIẾT DANH SÁCH BÀI HỌC CŨ ĐÃ LƯU TRONG CƠ SỞ DỮ LIỆU */}
                  <div className="mt-6 space-y-4">
                    {(section.lessons || []).map((lesson) => {
                      const quizForm = quizFormByLesson[lesson.id] || { title: `${lesson.title} - Quiz`, passScore: 80, timeLimitMinutes: '' }
                      const questionForm = lesson.quiz?.id ? newQuestionByQuiz[lesson.quiz.id] || { ...emptyQuestionForm } : { ...emptyQuestionForm }

                      return (
                        <div key={lesson.id} className="rounded-[24px] border border-slate-200 p-5 bg-white shadow-inner">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-100 pb-3">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                              Bài học: {lesson.title}
                            </h4>
                            <div className="flex gap-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => handleUpdateLesson(lesson)}
                                disabled={isSavingLessonId === lesson.id}
                              >
                                {isSavingLessonId === lesson.id ? 'Đang lưu...' : 'Lưu bài'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => handleDeleteLesson(lesson.id)}>Xóa bài</Button>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tên bài học</label>
                              <input
                                value={lesson.title}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'title', e.target.value)}
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Định dạng bài học</label>
                              <select
                                value={lesson.lessonType}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'lessonType', e.target.value)}
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              >
                                <option value="video">Video</option>
                                <option value="document">Document</option>
                                <option value="quiz">Quiz</option>
                              </select>
                            </div>

                            {/* Trường dữ liệu động thông minh tương ứng định dạng cũ */}
                            {lesson.lessonType === 'video' && (
                              <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Đường dẫn liên kết Video</label>
                                <input
                                  value={lesson.videoUrl || ''}
                                  onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'videoUrl', e.target.value)}
                                  className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                            )}

                            {lesson.lessonType === 'document' && (
                              <div className="flex flex-col gap-1 w-full">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tải tài liệu mới thay thế</label>
                                <div className="flex items-center w-full rounded-2xl bg-slate-50 px-4 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                                  <input
                                    type="file"
                                    onChange={(e) => setSelectedFiles(prev => ({ ...prev, [lesson.id]: e.target.files[0] }))}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                </div>
                                {lesson.documentUrl && (
                                  <p className="text-xs text-slate-400 pl-2 truncate mt-1">
                                    Tệp đính kèm hiện tại: <a href={`http://localhost:5000${lesson.documentUrl}`} target="_blank" rel="noreferrer" className="text-blue-500 underline hover:text-blue-600 font-medium">{lesson.documentUrl}</a>
                                  </p>
                                )}
                              </div>
                            )}

                            {lesson.lessonType === 'quiz' && <div />}

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Thứ tự hiển thị</label>
                              <input
                                type="number"
                                value={lesson.sortOrder}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'sortOrder', Number(e.target.value || 0))}
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Quy tắc mở khóa bài</label>
                              <select
                                value={lesson.unlockMethod || (Number(lesson.unlockOrder) === 0 ? 'free' : 'sequential')}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'unlockMethod', e.target.value)}
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              >
                                <option value="sequential">Học tuần tự (Bài trước xong mới được xem)</option>
                                <option value="free">Mở khóa tự do (Có thể tự do nhảy bài)</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-6 py-2">
                              <label className="inline-flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(lesson.isPreview) || lesson.isPreview === 1}
                                  onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'isPreview', e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Học thử không mua
                              </label>

                              <label className="inline-flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(lesson.isPublished) || lesson.isPublished === 1}
                                  onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'isPublished', e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Công khai bài học
                              </label>
                            </div>

                            <div className="md:col-span-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nội dung / Mô tả giáo án bài học</label>
                              <textarea
                                value={lesson.content || ''}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'content', e.target.value)}
                                rows={3}
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>

                          {/* KHU VỰC THIẾT LẬP CHI TIẾT CỦA BÀI HỌC DẠNG QUIZ */}
                          {lesson.lessonType === 'quiz' && (
                            <div className="mt-5 rounded-[20px] bg-slate-50 p-4 border border-slate-200">
                              <h5 className="mb-4 text-sm font-bold text-slate-800">Cấu hình thông số bài trắc nghiệm (Quiz)</h5>
                              <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Tiêu đề tiêu chuẩn</label>
                                  <input
                                    value={quizForm.title}
                                    onChange={(e) => handleQuizFormChange(lesson.id, 'title', e.target.value)}
                                    className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Tỷ lệ % để đạt (Pass score)</label>
                                  <input
                                    type="number"
                                    value={quizForm.passScore}
                                    onChange={(e) => handleQuizFormChange(lesson.id, 'passScore', e.target.value)}
                                    className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-slate-500">Giới hạn thời gian làm bài (Phút)</label>
                                  <input
                                    type="number"
                                    value={quizForm.timeLimitMinutes}
                                    onChange={(e) => handleQuizFormChange(lesson.id, 'timeLimitMinutes', e.target.value)}
                                    placeholder="Bỏ trống nếu làm tự do"
                                    className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                  />
                                </div>
                              </div>
                              <div className="mt-4">
                                <Button type="button" onClick={() => handleSaveQuiz(lesson.id)}>Lưu thiết lập quiz</Button>
                              </div>

                              {lesson.quiz?.id && (
                                <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
                                  <div className="rounded-[20px] bg-white p-4 shadow-sm border border-slate-100">
                                    <h6 className="mb-4 text-sm font-bold text-slate-800">Thêm câu hỏi trắc nghiệm mới</h6>
                                    <div className="space-y-4">
                                      <input
                                        value={questionForm.questionText}
                                        onChange={(e) => handleQuestionFormChange(lesson.quiz.id, 'questionText', e.target.value)}
                                        placeholder="Ví dụ: Đâu là thẻ tiêu đề lớn nhất trong tài liệu HTML?"
                                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                      />
                                      <div className="grid gap-3 md:grid-cols-2">
                                        {questionForm.answers.map((answer, index) => (
                                          <div key={index} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                                            <input
                                              value={answer.answerText}
                                              onChange={(e) => handleAnswerChange(lesson.quiz.id, index, 'answerText', e.target.value)}
                                              placeholder={`Đáp án lựa chọn ${index + 1}`}
                                              className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                            />
                                            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`correct-answer-${lesson.quiz.id}`}
                                                checked={Boolean(answer.isCorrect)}
                                                onChange={() => handleChooseCorrectAnswer(lesson.quiz.id, index)}
                                              />
                                              Đánh dấu đây là đáp án đúng
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                      <Button type="button" onClick={() => handleCreateQuestion(lesson.quiz.id)}>Xác nhận thêm câu hỏi vào bộ đề</Button>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Danh sách bộ câu hỏi hiện tại ({lesson.quiz.questions?.length || 0} câu)</p>
                                    {(lesson.quiz.questions || []).map((question, questionIndex) => (
                                      <div key={question.id} className="rounded-[20px] bg-white p-5 border border-slate-100 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1">
                                            <p className="font-semibold text-slate-900 text-sm">Câu {questionIndex + 1}: {question.questionText}</p>
                                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                              {(question.answers || []).map((answer) => (
                                                <div
                                                  key={answer.id}
                                                  className={`rounded-xl px-3 py-2.5 text-xs font-medium ${
                                                    answer.isCorrect ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 font-semibold' : 'bg-slate-50 text-slate-600'
                                                  }`}
                                                >
                                                  {answer.answerText} {answer.isCorrect && ' ✓ (Đáp án đúng)'}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteQuestion(question.id)}
                                            className="text-xs font-bold text-red-400 hover:text-red-600 transition bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl"
                                          >
                                            Xóa câu này
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/courses')}>Quay lại danh sách khóa học</Button>
          </div>
        </div>
      )}
    </section>
  )
}