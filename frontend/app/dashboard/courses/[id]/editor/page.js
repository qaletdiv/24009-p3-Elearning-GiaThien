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

  // Trạng thái chặn bấm liên tục khi đang lưu dữ liệu
  const [isSavingLessonId, setIsSavingLessonId] = useState(null)

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

  const getDefaultLessonForm = (sectionId, currentSection) => ({
    sectionId,
    title: '',
    lessonType: 'video',
    content: '',
    videoUrl: '',
    documentUrl: '',
    durationSeconds: '',
    isPreview: false,
    isPublished: true,
    unlockOrder: (currentSection?.lessons?.length || 0) + 1,
    sortOrder: (currentSection?.lessons?.length || 0) + 1,
  })

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

  const handleCreateLesson = async (sectionId, section) => {
    const form = newLessonBySection[sectionId] || getDefaultLessonForm(sectionId, section)
    try {
      setMessage('')
      setError('')

      const formData = new FormData()
      formData.append('sectionId', sectionId)
      formData.append('title', form.title)
      formData.append('lessonType', form.lessonType)
      formData.append('content', form.content || '')
      formData.append('videoUrl', form.videoUrl || '')
      formData.append('durationSeconds', form.durationSeconds ? String(form.durationSeconds) : '')
      formData.append('unlockOrder', String(form.unlockOrder || 0))
      formData.append('sortOrder', String(form.sortOrder || 0))
      formData.append('isPreview', form.isPreview ? 'true' : 'false')
      formData.append('isPublished', form.isPublished ? 'true' : 'false')

      if (selectedFiles[`new-${sectionId}`]) {
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
      if (!response.ok) throw new Error(resData.message || 'Lỗi tạo bài học')

      setMessage('Tạo bài học thành công')
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

  // FIX HOÀN TOÀN LỖI NÚT LƯU BÀI KHÔNG HOẠT ĐỘNG
  const handleUpdateLesson = async (lesson) => {
    try {
      setMessage('')
      setError('')
      setIsSavingLessonId(lesson.id) // Bật trạng thái loading cho riêng bài này

      const formData = new FormData()
      formData.append('sectionId', String(lesson.sectionId))
      formData.append('title', String(lesson.title || ''))
      formData.append('lessonType', String(lesson.lessonType || 'video'))
      formData.append('content', String(lesson.content || ''))
      formData.append('videoUrl', String(lesson.videoUrl || ''))
      formData.append('documentUrl', String(lesson.documentUrl || ''))
      formData.append('durationSeconds', lesson.durationSeconds ? String(lesson.durationSeconds) : '')
      formData.append('unlockOrder', String(lesson.unlockOrder || 0))
      formData.append('sortOrder', String(lesson.sortOrder || 0))
      
      // Khắc phục ép kiểu an toàn tuyệt đối chống lỗi treo dữ liệu ngầm ở React
      formData.append('isPreview', String(lesson.isPreview) === 'true' || lesson.isPreview === 1 ? 'true' : 'false')
      formData.append('isPublished', String(lesson.isPublished) === 'false' || lesson.isPublished === 0 ? 'false' : 'true')

      if (selectedFiles[lesson.id]) {
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

      setMessage(`Cập nhật bài học "${lesson.title}" thành công!`)
      
      setSelectedFiles(prev => {
        const next = { ...prev }
        delete next[lesson.id]
        return next
      })
      
      await fetchEditorData()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSavingLessonId(null) // Tắt trạng thái loading
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
                placeholder="Tên chương học"
                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
              />
              <input
                type="number"
                value={newSection.sortOrder}
                onChange={(e) => setNewSection((prev) => ({ ...prev, sortOrder: e.target.value }))}
                placeholder="Sort"
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
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Chương {sectionIndex + 1}</label>
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
                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="w-full md:w-40">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Sort</label>
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
                      <Button type="button" variant="outline" onClick={() => handleUpdateSection(section)}>Lưu chương</Button>
                      <Button type="button" variant="outline" onClick={() => handleDeleteSection(section.id)}>Xóa chương</Button>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Thêm bài học</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        value={lessonForm.title}
                        onChange={(e) => handleLessonFormChange(section.id, 'title', e.target.value, section)}
                        placeholder="Tên bài học"
                        className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />

                      <select
                        value={lessonForm.lessonType}
                        onChange={(e) => handleLessonFormChange(section.id, 'lessonType', e.target.value, section)}
                        className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="video">Video</option>
                        <option value="document">Document</option>
                        <option value="quiz">Quiz</option>
                      </select>

                      {lessonForm.lessonType === 'video' ? (
                        <input
                          value={lessonForm.videoUrl}
                          onChange={(e) => handleLessonFormChange(section.id, 'videoUrl', e.target.value, section)}
                          placeholder="Youtube embed / video URL"
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        />
                      ) : lessonForm.lessonType === 'document' ? (
                        <div className="flex items-center w-full rounded-2xl bg-white px-4 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                          <input
                            type="file"
                            onChange={(e) => setSelectedFiles(prev => ({ ...prev, [`new-${section.id}`]: e.target.files[0] }))}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        </div>
                      ) : null}

                      <input
                        type="number"
                        value={lessonForm.durationSeconds}
                        onChange={(e) => handleLessonFormChange(section.id, 'durationSeconds', e.target.value, section)}
                        placeholder="Thời lượng (giây)"
                        className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />

                      <input
                        type="number"
                        value={lessonForm.sortOrder}
                        onChange={(e) => handleLessonFormChange(section.id, 'sortOrder', e.target.value, section)}
                        placeholder="Sort order"
                        className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />

                      <input
                        type="number"
                        value={lessonForm.unlockOrder}
                        onChange={(e) => handleLessonFormChange(section.id, 'unlockOrder', e.target.value, section)}
                        placeholder="Unlock order"
                        className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                      />

                      <label className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
                        <input
                          type="checkbox"
                          checked={lessonForm.isPreview}
                          onChange={(e) => handleLessonFormChange(section.id, 'isPreview', e.target.checked, section)}
                        />
                        Cho phép học thử
                      </label>

                      <label className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
                        <input
                          type="checkbox"
                          checked={lessonForm.isPublished}
                          onChange={(e) => handleLessonFormChange(section.id, 'isPublished', e.target.checked, section)}
                        />
                        Đã xuất bản
                      </label>

                      <div className="md:col-span-2">
                        <textarea
                          value={lessonForm.content}
                          onChange={(e) => handleLessonFormChange(section.id, 'content', e.target.value, section)}
                          rows={4}
                          placeholder="Nội dung bài học / Mô tả tài liệu"
                          className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button type="button" onClick={() => handleCreateLesson(section.id, section)}>Thêm bài học</Button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {(section.lessons || []).map((lesson) => {
                      const quizForm = quizFormByLesson[lesson.id] || { title: `${lesson.title} - Quiz`, passScore: 80, timeLimitMinutes: '' }
                      const questionForm = lesson.quiz?.id ? newQuestionByQuiz[lesson.quiz.id] || { ...emptyQuestionForm } : { ...emptyQuestionForm }

                      return (
                        <div key={lesson.id} className="rounded-[24px] border border-slate-200 p-4 bg-white">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-lg font-semibold text-slate-900">Bài: {lesson.title}</h4>
                            <div className="flex gap-2">
                              {/* Tích hợp trạng thái Disabled và Text đổi động để chống bấm spam */}
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
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Tên bài học</label>
                              <input
                                value={lesson.title}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'title', e.target.value)}
                                placeholder="Tên bài học"
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            <select
                              value={lesson.lessonType}
                              onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'lessonType', e.target.value)}
                              className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="video">Video</option>
                              <option value="document">Document</option>
                              <option value="quiz">Quiz</option>
                            </select>

                            {lesson.lessonType === 'video' ? (
                              <input
                                value={lesson.videoUrl || ''}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'videoUrl', e.target.value)}
                                placeholder="Youtube embed / video URL"
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            ) : lesson.lessonType === 'document' ? (
                              <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center w-full rounded-2xl bg-slate-50 px-4 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-600">
                                  <input
                                    type="file"
                                    onChange={(e) => setSelectedFiles(prev => ({ ...prev, [lesson.id]: e.target.files[0] }))}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                  />
                                </div>
                                {lesson.documentUrl && (
                                  <p className="text-xs text-slate-400 pl-2 truncate">
                                    File cũ: <a href={`http://localhost:5000${lesson.documentUrl}`} target="_blank" rel="noreferrer" className="text-blue-500 underline hover:text-blue-600">{lesson.documentUrl}</a>
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div />
                            )}

                            <input
                              type="number"
                              value={lesson.durationSeconds || ''}
                              onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'durationSeconds', e.target.value)}
                              placeholder="Thời lượng (giây)"
                              className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                            />

                            <input
                              type="number"
                              value={lesson.sortOrder}
                              onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'sortOrder', e.target.value)}
                              placeholder="Sort order"
                              className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                            />

                            <label className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={String(lesson.isPreview) === 'true' || lesson.isPreview === true || lesson.isPreview === 1}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'isPreview', e.target.checked)}
                              />
                              Cho phép học thử
                            </label>

                            <label className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={String(lesson.isPublished) === 'true' || lesson.isPublished === true || lesson.isPublished === 1}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'isPublished', e.target.checked)}
                              />
                              Đã xuất bản
                            </label>

                            <div className="md:col-span-2">
                              <textarea
                                value={lesson.content || ''}
                                onChange={(e) => handleLessonFieldChange(section.id, lesson.id, 'content', e.target.value)}
                                rows={4}
                                placeholder="Nội dung bài học"
                                className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>

                          {lesson.lessonType === 'quiz' && (
                            <div className="mt-5 rounded-[20px] bg-slate-50 p-4">
                              <h5 className="mb-4 text-lg font-semibold text-slate-900">Thiết lập quiz</h5>
                              <div className="grid gap-4 md:grid-cols-3">
                                <input
                                  value={quizForm.title}
                                  onChange={(e) => handleQuizFormChange(lesson.id, 'title', e.target.value)}
                                  placeholder="Tiêu đề quiz"
                                  className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                />
                                <input
                                  type="number"
                                  value={quizForm.passScore}
                                  onChange={(e) => handleQuizFormChange(lesson.id, 'passScore', e.target.value)}
                                  placeholder="Điểm đạt"
                                  className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                />
                                <input
                                  type="number"
                                  value={quizForm.timeLimitMinutes}
                                  onChange={(e) => handleQuizFormChange(lesson.id, 'timeLimitMinutes', e.target.value)}
                                  placeholder="Thời gian (phút)"
                                  className="block w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                              <div className="mt-4">
                                <Button type="button" onClick={() => handleSaveQuiz(lesson.id)}>Lưu quiz</Button>
                              </div>

                              {lesson.quiz?.id && (
                                <div className="mt-6 space-y-4">
                                  <div className="rounded-[20px] bg-white p-4 shadow-sm">
                                    <h6 className="mb-4 text-base font-semibold text-slate-900">Thêm câu hỏi mới</h6>
                                    <div className="space-y-4">
                                      <input
                                        value={questionForm.questionText}
                                        onChange={(e) => handleQuestionFormChange(lesson.quiz.id, 'questionText', e.target.value)}
                                        placeholder="Nội dung câu hỏi"
                                        className="block w-full rounded-2xl border-0 bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                      />
                                      <div className="grid gap-3 md:grid-cols-2">
                                        {questionForm.answers.map((answer, index) => (
                                          <div key={index} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                                            <input
                                              value={answer.answerText}
                                              onChange={(e) => handleAnswerChange(lesson.quiz.id, index, 'answerText', e.target.value)}
                                              placeholder={`Đáp án ${index + 1}`}
                                              className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-600"
                                            />
                                            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`correct-answer-${lesson.quiz.id}`}
                                                checked={Boolean(answer.isCorrect)}
                                                onChange={() => handleChooseCorrectAnswer(lesson.quiz.id, index)}
                                              />
                                              Đáp án đúng
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                      <Button type="button" onClick={() => handleCreateQuestion(lesson.quiz.id)}>Xác nhận thêm câu hỏi</Button>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    {(lesson.quiz.questions || []).map((question, questionIndex) => (
                                      <div key={question.id} className="rounded-[20px] bg-white p-5 border border-slate-100">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1">
                                            <p className="font-semibold text-slate-900">Câu {questionIndex + 1}. {question.questionText}</p>
                                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                              {(question.answers || []).map((answer) => (
                                                <div
                                                  key={answer.id}
                                                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                                                    answer.isCorrect ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-50 text-slate-600'
                                                  }`}
                                                >
                                                  {answer.answerText} {answer.isCorrect && '✓'}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteQuestion(question.id)}
                                            className="text-xs font-bold text-red-400 hover:text-red-600 transition"
                                          >
                                            Xóa
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