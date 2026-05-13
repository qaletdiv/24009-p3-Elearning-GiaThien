'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from './Button'
import Input from './Input'
import { apiRequest } from '../lib/api'

const defaultForm = {
  title: '',
  slug: '',
  categoryId: '',
  shortDescription: '',
  description: '',
  coverImageUrl: '',
  trailerUrl: '',
  price: 0,
  level: 'beginner',
  status: 'draft',
  isFree: false,
}

export default function CourseManageForm({ courseId = null }) {
  const router = useRouter()
  const isCreate = !courseId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')

        const categoriesRes = await apiRequest('/courses/categories')
        setCategories(categoriesRes.data)

        if (!isCreate) {
          const courseRes = await apiRequest(`/manage/courses/${courseId}`)
          const course = courseRes.data

          setForm({
            title: course.title || '',
            slug: course.slug || '',
            categoryId: course.categoryId ? String(course.categoryId) : '',
            shortDescription: course.shortDescription || '',
            description: course.description || '',
            coverImageUrl: course.coverImageUrl || '',
            trailerUrl: course.trailerUrl || '',
            price: Number(course.price || 0),
            level: course.level || 'beginner',
            status: course.status || 'draft',
            isFree: Boolean(course.isFree),
          })
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [courseId, isCreate])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const payload = {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        price: form.isFree ? 0 : Number(form.price || 0),
        isFree: Boolean(form.isFree),
      }

      if (isCreate) {
        await apiRequest('/manage/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setMessage('Tạo khóa học thành công')
      } else {
        await apiRequest(`/manage/courses/${courseId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setMessage('Cập nhật khóa học thành công')
      }

      router.push('/dashboard/courses')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Đang tải thông tin khóa học...
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      {message && (
        <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
        <Input
          label="Tên khóa học"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Nhập tên khóa học"
        />

        <Input
          label="Slug"
          name="slug"
          value={form.slug}
          onChange={handleChange}
          placeholder="lap-trinh-nodejs-tu-co-ban"
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Danh mục</label>
          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="">Chọn danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Giá tiền"
          type="number"
          name="price"
          value={form.price}
          onChange={handleChange}
          disabled={form.isFree}
          placeholder="0"
        />

        <div className="md:col-span-2">
          <Input
            label="Mô tả ngắn"
            name="shortDescription"
            value={form.shortDescription}
            onChange={handleChange}
            placeholder="Mô tả ngắn về khóa học"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-900">Mô tả chi tiết</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={6}
            className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            placeholder="Mô tả chi tiết khóa học"
          />
        </div>

        <Input
          label="URL ảnh bìa"
          name="coverImageUrl"
          value={form.coverImageUrl}
          onChange={handleChange}
          placeholder="https://..."
        />

        <Input
          label="URL trailer/Youtube embed"
          name="trailerUrl"
          value={form.trailerUrl}
          onChange={handleChange}
          placeholder="https://www.youtube.com/embed/..."
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Level</label>
          <select
            name="level"
            value={form.level}
            onChange={handleChange}
            className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Trạng thái</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="draft">Draft</option>
            <option value="public">Public</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <label className="md:col-span-2 inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isFree"
            checked={form.isFree}
            onChange={handleChange}
          />
          Đây là khóa học miễn phí
        </label>

        <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : isCreate ? 'Tạo khóa học' : 'Cập nhật khóa học'}
          </Button>

          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/courses')}>
            Quay lại
          </Button>
        </div>
      </form>
    </div>
  )
}