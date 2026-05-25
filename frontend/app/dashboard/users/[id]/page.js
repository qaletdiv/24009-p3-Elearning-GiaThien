'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Button from '../../../../components/Button'
import Input from '../../../../components/Input'
import { apiRequest, getStoredUser } from '../../../../lib/api'

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id

  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState([])
  const [allCourses, setAllCourses] = useState([]) // Danh sách tất cả khóa học trên hệ thống
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Biến dùng để ghi nhớ danh sách khóa học giảng viên đã có SẴN từ trước (phục vụ bộ lọc ẩn)
  const [initialAssignedIds, setInitialAssignedIds] = useState([])

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    roleId: '',
    status: 'active',
    assignedCourseIds: [], // Mảng ID các khóa học điều phối mới/đang chọn
  })

  useEffect(() => {
    const user = getStoredUser()

    if (!user) {
      router.replace(`/auth?redirect=/dashboard/users/${id}`)
      return
    }

    if (user.role !== 'admin') {
      router.replace('/')
      return
    }

    setAuthorized(true)
  }, [router, id])

  useEffect(() => {
    const fetchData = async () => {
      if (!authorized) return

      try {
        setLoading(true)
        setError('')

        // Gọi đồng thời thông tin Roles, User, và đổi sang API /manage/courses chuẩn xác của bạn
        const [rolesRes, userRes, coursesRes] = await Promise.all([
          apiRequest('/admin/roles'),
          apiRequest(`/admin/users/${id}`),
          apiRequest('/manage/courses?limit=100').catch(() => ({ data: [] })),
        ])

        setRoles(rolesRes.data)
        
        // Bóc tách mảng danh sách khóa học từ Backend
        const coursesList = coursesRes.data?.courses || coursesRes.data?.items || (Array.isArray(coursesRes.data) ? coursesRes.data : [])
        setAllCourses(coursesList)

        const user = userRes.data
        
        // Lấy ra danh sách các ID khóa học đang dạy sẵn có từ Database
        const currentAssignedIds = user.assignedCourses 
          ? user.assignedCourses.map(c => Number(c.id)) 
          : (user.assignedCourseIds ? user.assignedCourseIds.map(Number) : [])

        // Lưu vào cả 2 trạng thái: Trạng thái hiển thị form và Trạng thái gốc để làm bộ lọc ẩn
        setInitialAssignedIds(currentAssignedIds)
        setForm({
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          roleId: String(user.roleId || ''),
          status: user.status || 'active',
          assignedCourseIds: currentAssignedIds,
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [authorized, id])

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  // Xử lý bật/tắt chọn khóa học trong danh sách assign cho Giáo viên
  const handleCourseCheckChange = (courseId) => {
    setForm((prev) => {
      const currentIds = [...prev.assignedCourseIds].map(Number)
      const targetId = Number(courseId)
      const index = currentIds.indexOf(targetId)
      
      if (index > -1) {
        currentIds.splice(index, 1) // Bỏ chọn
      } else {
        currentIds.push(targetId) // Thêm chọn
      }
      return { ...prev, assignedCourseIds: currentIds }
    })
  }

  // Kiểm tra vai trò xem người đang được sửa có phải Giảng viên/Instructor không
  const isInstructor = () => {
    const selectedRole = roles.find(r => String(r.id) === String(form.roleId))
    return selectedRole?.code === 'instructor' || selectedRole?.name?.toLowerCase()?.includes('giáo viên') || selectedRole?.name?.toLowerCase()?.includes('instructor')
  }

  // BỘ LỌC TỐI ƯU: Loại bỏ các khóa học mà Giảng viên này đã sở hữu hoặc đang dạy từ trước
  const filteredCourses = useMemo(() => {
    return allCourses.filter((courseItem) => {
      // 1. Nếu giảng viên là người trực tiếp tạo khóa học này (khớp instructorId) -> ẨN
      if (Number(courseItem.instructorId) === Number(id)) {
        return false
      }
      // 2. Nếu khóa học này nằm trong danh sách đã gán (đang dạy rồi) từ trước -> ẨN
      if (initialAssignedIds.includes(Number(courseItem.id))) {
        return false
      }
      return true
    })
  }, [allCourses, initialAssignedIds, id])

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setSaving(true)
      setMessage('')
      setError('')

      await apiRequest(`/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || null,
          roleId: Number(form.roleId),
          status: form.status,
          // Gửi mảng danh sách ID khóa học lên cho Backend đồng bộ
          assignedCourseIds: isInstructor() ? form.assignedCourseIds.map(Number) : [],
        }),
      })

      setMessage('Cập nhật người dùng và phân bổ khóa học thành công')
      router.push('/dashboard/users')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!authorized) return null

  if (loading) {
    return (
      <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Đang tải dữ liệu người dùng...
        </div>
      </section>
    )
  }

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Cập nhật thông tin người dùng
        </h1>
      </div>

      {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <Input
            label="Họ tên"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
          />

          <Input
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            disabled
          />

          <Input
            label="Số điện thoại"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="0901234567"
            disabled
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">Vai trò</label>
            <select
              name="roleId"
              value={form.roleId}
              onChange={handleChange}
              className="block w-full rounded-xl border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="">Chọn vai trò</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
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
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>

        {/* HIỂN THỊ DANH SÁCH KHÓA HỌC CHƯA ĐƯỢC PHÂN PHỐI */}
        {isInstructor() && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            <label className="mb-3 block text-base font-bold text-slate-900">
              📚 Phân phối khóa học đảm nhận giảng dạy
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Dưới đây là danh sách những khóa học khả dụng khác trên hệ thống mà giáo viên này **chưa tham gia phụ trách**. Các khóa học do giáo viên tự tạo hoặc đã gán trước đó sẽ tự động được ẩn đi để tối ưu giao diện.
            </p>
            
            {filteredCourses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400 italic">
                ✨ Không có khóa học nào khác sẵn có để gán thêm (Giáo viên đã phụ trách toàn bộ hoặc hệ thống chưa có khóa mới).
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 max-h-60 overflow-y-auto p-2 border border-slate-100 bg-slate-50 rounded-2xl custom-scrollbar">
                {filteredCourses.map((courseItem) => {
                  const isChecked = form.assignedCourseIds.includes(Number(courseItem.id))
                  return (
                    <label 
                      key={courseItem.id} 
                      className={`flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCourseCheckChange(courseItem.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 truncate">
                        <p className="truncate text-xs font-semibold">{courseItem.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">Slug: {courseItem.slug}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Cập nhật'}
          </Button>

          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>
            Quay lại
          </Button>
        </div>
      </form>
    </section>
  )
}